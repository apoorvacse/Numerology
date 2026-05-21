import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/domain/lead";
import { isValidTransition, isTerminalStatus } from "@/domain/statusRules";
import { leadFormSchema, leadPatchSchema } from "@/domain/schemas";
import * as db from "./db";

/**
 * MSW handlers — same contract as json-server (`/leads`), prefixed with
 * `/api` so it's obvious where the mock boundary is. Three things that
 * matter:
 *  1. We validate payloads with the same zod schema the form uses, and
 *     return a 400 with field-level errors so the UI can render them.
 *  2. We enforce status transition rules server-side too — a misbehaving
 *     client (or a stale tab) cannot put a lead in an invalid state.
 *  3. We add a small artificial latency so loading states are visible
 *     during a demo. Toggle via `MOCK_LATENCY_MS`.
 */

const MOCK_LATENCY_MS = 220;
// One-in-N requests fail randomly to exercise error states / rollback paths.
// Set to 0 to disable. Kept low so a demo doesn't feel broken.
const MOCK_FAIL_RATIO = 0;

async function maybeFail(): Promise<HttpResponse<{ error: string }> | null> {
  if (MOCK_FAIL_RATIO > 0 && Math.random() < 1 / MOCK_FAIL_RATIO) {
    return HttpResponse.json(
      { error: "Simulated transient failure" },
      { status: 500 },
    );
  }
  return null;
}

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(), // comma-separated
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(10000).optional(),
  sort: z.enum(["updated_at", "created_at", "name"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function applyListQuery(
  all: Lead[],
  query: z.infer<typeof listQuerySchema>,
): { items: Lead[]; total: number } {
  let result = all;

  if (query.status) {
    const statuses = new Set(
      query.status.split(",").filter(Boolean) as LeadStatus[],
    );
    if (statuses.size > 0) {
      result = result.filter((l) => statuses.has(l.status));
    }
  }

  if (query.q) {
    const q = query.q.toLowerCase();
    result = result.filter(
      (l) =>
        l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q),
    );
  }

  const sortKey = query.sort ?? "updated_at";
  const order = query.order ?? "desc";
  result = [...result].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return 0;
    const cmp = av < bv ? -1 : 1;
    return order === "asc" ? cmp : -cmp;
  });

  const total = result.length;
  if (query.page && query.pageSize) {
    const start = (query.page - 1) * query.pageSize;
    result = result.slice(start, start + query.pageSize);
  }
  return { items: result, total };
}

export const handlers = [
  http.get("/api/leads", async ({ request }) => {
    await delay(MOCK_LATENCY_MS);
    const fail = await maybeFail();
    if (fail) return fail;

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Invalid query", fields: fieldErrors(parsed.error) },
        { status: 400 },
      );
    }

    const { items, total } = applyListQuery(db.getAll(), parsed.data);
    return HttpResponse.json({ items, total });
  }),

  http.get("/api/leads/:id", async ({ params }) => {
    await delay(MOCK_LATENCY_MS);
    const lead = db.getById(String(params.id));
    if (!lead) {
      return HttpResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return HttpResponse.json(lead);
  }),

  http.post("/api/leads", async ({ request }) => {
    await delay(MOCK_LATENCY_MS);
    const fail = await maybeFail();
    if (fail) return fail;

    const body = await request.json();
    const parsed = leadFormSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        {
          error: "Validation failed",
          fields: fieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const created = db.insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      source: parsed.data.source || undefined,
      status: parsed.data.status ?? "NEW",
    });
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch("/api/leads/:id", async ({ request, params }) => {
    await delay(MOCK_LATENCY_MS);
    const fail = await maybeFail();
    if (fail) return fail;

    const id = String(params.id);
    const existing = db.getById(id);
    if (!existing) {
      return HttpResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = leadPatchSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        {
          error: "Validation failed",
          fields: fieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    // Guard the status transition rule on the server side too.
    if (parsed.data.status && parsed.data.status !== existing.status) {
      if (isTerminalStatus(existing.status)) {
        return HttpResponse.json(
          {
            error: `Lead is ${existing.status} and cannot change status.`,
            fields: { status: "Status is terminal" },
          },
          { status: 422 },
        );
      }
      if (!isValidTransition(existing.status, parsed.data.status)) {
        return HttpResponse.json(
          {
            error: `Invalid transition: ${existing.status} → ${parsed.data.status}`,
            fields: { status: "Invalid status transition" },
          },
          { status: 422 },
        );
      }
    }

    const updated = db.update(id, {
      name: parsed.data.name ?? existing.name,
      email: parsed.data.email ?? existing.email,
      phone:
        parsed.data.phone === ""
          ? undefined
          : parsed.data.phone ?? existing.phone,
      source:
        parsed.data.source === ""
          ? undefined
          : parsed.data.source ?? existing.source,
      status: parsed.data.status ?? existing.status,
    });
    return HttpResponse.json(updated);
  }),

  http.put("/api/leads/:id", async ({ request, params }) => {
    // PUT mirrors PATCH for our purposes (full replace minus id/timestamps).
    await delay(MOCK_LATENCY_MS);
    const fail = await maybeFail();
    if (fail) return fail;

    const id = String(params.id);
    const existing = db.getById(id);
    if (!existing) {
      return HttpResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = leadFormSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Validation failed", fields: fieldErrors(parsed.error) },
        { status: 400 },
      );
    }
    const updated = db.update(id, {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      source: parsed.data.source || undefined,
      status: parsed.data.status ?? existing.status,
    });
    return HttpResponse.json(updated);
  }),

  http.delete("/api/leads/:id", async ({ params }) => {
    await delay(MOCK_LATENCY_MS);
    const fail = await maybeFail();
    if (fail) return fail;

    const ok = db.remove(String(params.id));
    if (!ok) {
      return HttpResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/_reset", async () => {
    db.resetDb();
    return HttpResponse.json({ ok: true });
  }),

  http.get("/api/_meta", () => {
    return HttpResponse.json({
      total: db.getAll().length,
      statuses: LEAD_STATUSES,
    });
  }),
];
