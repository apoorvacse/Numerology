import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { leadsApi, type ListLeadsParams, type ListLeadsResponse } from "@/api/leads";
import { leadKeys } from "@/api/queryKeys";
import type {
  CreateLeadInput,
  Lead,
  LeadStatus,
  UpdateLeadInput,
} from "@/domain/lead";

/**
 * One file holds list/detail/mutation hooks for leads. They share cache
 * keys via `leadKeys`, and mutations apply optimistic updates against the
 * list cache so the UI feels instant.
 *
 * Optimistic strategy:
 *  - update / status change: patch every active list cache entry by id.
 *  - delete: remove from every active list cache entry.
 *  - create: don't try to predict where it lands in the sorted list;
 *    just invalidate after success. Predicting introduces ordering bugs
 *    that aren't worth the latency win.
 */

export function useLeadsList(params: ListLeadsParams) {
  return useQuery<ListLeadsResponse>({
    queryKey: leadKeys.list(params),
    queryFn: () => leadsApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  });
}

export function useLead(id: string | undefined) {
  return useQuery<Lead>({
    queryKey: id ? leadKeys.detail(id) : leadKeys.detail("__none__"),
    queryFn: () => leadsApi.get(id!),
    enabled: Boolean(id),
  });
}

/** Patch a lead in every list cache page. Returns a snapshot for rollback. */
function patchLeadInListCaches(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  updater: (prev: Lead) => Lead,
) {
  const snapshots: Array<[unknown, ListLeadsResponse | undefined]> = [];
  qc.getQueriesData<ListLeadsResponse>({ queryKey: leadKeys.lists() }).forEach(
    ([key, data]) => {
      snapshots.push([key, data]);
      if (!data) return;
      const next: ListLeadsResponse = {
        ...data,
        items: data.items.map((l) => (l.id === id ? updater(l) : l)),
      };
      qc.setQueryData(key, next);
    },
  );
  return snapshots;
}

function removeLeadFromListCaches(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
) {
  const snapshots: Array<[unknown, ListLeadsResponse | undefined]> = [];
  qc.getQueriesData<ListLeadsResponse>({ queryKey: leadKeys.lists() }).forEach(
    ([key, data]) => {
      snapshots.push([key, data]);
      if (!data) return;
      const filtered = data.items.filter((l) => l.id !== id);
      const next: ListLeadsResponse = {
        ...data,
        items: filtered,
        total: Math.max(0, data.total - (data.items.length - filtered.length)),
      };
      qc.setQueryData(key, next);
    },
  );
  return snapshots;
}

function restoreSnapshots(
  qc: ReturnType<typeof useQueryClient>,
  snapshots: Array<[unknown, ListLeadsResponse | undefined]>,
) {
  for (const [key, data] of snapshots) {
    qc.setQueryData(key as ReturnType<typeof leadKeys.list>, data);
  }
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => leadsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

interface UpdateContext {
  snapshots: Array<[unknown, ListLeadsResponse | undefined]>;
  prevDetail?: Lead;
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation<Lead, Error, { id: string; input: UpdateLeadInput }, UpdateContext>(
    {
      mutationFn: ({ id, input }) => leadsApi.update(id, input),
      onMutate: async ({ id, input }) => {
        await qc.cancelQueries({ queryKey: leadKeys.lists() });
        await qc.cancelQueries({ queryKey: leadKeys.detail(id) });

        const prevDetail = qc.getQueryData<Lead>(leadKeys.detail(id));
        const snapshots = patchLeadInListCaches(qc, id, (prev) => ({
          ...prev,
          ...input,
          updated_at: new Date().toISOString(),
        }));
        if (prevDetail) {
          qc.setQueryData<Lead>(leadKeys.detail(id), {
            ...prevDetail,
            ...input,
            updated_at: new Date().toISOString(),
          });
        }
        return { snapshots, prevDetail };
      },
      onError: (_err, vars, ctx) => {
        if (ctx) {
          restoreSnapshots(qc, ctx.snapshots);
          if (ctx.prevDetail) {
            qc.setQueryData(leadKeys.detail(vars.id), ctx.prevDetail);
          }
        }
      },
      onSettled: (_data, _err, vars) => {
        qc.invalidateQueries({ queryKey: leadKeys.detail(vars.id) });
        qc.invalidateQueries({ queryKey: leadKeys.lists() });
      },
    },
  );
}

interface DeleteContext {
  snapshots: Array<[unknown, ListLeadsResponse | undefined]>;
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, DeleteContext>({
    mutationFn: (id) => leadsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: leadKeys.lists() });
      const snapshots = removeLeadFromListCaches(qc, id);
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) restoreSnapshots(qc, ctx.snapshots);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

export interface BulkResult {
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

/** Bulk delete: runs requests in parallel and reports per-id success/failure. */
export function useBulkDelete() {
  const qc = useQueryClient();
  return useMutation<BulkResult, Error, string[]>({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(
        ids.map((id) => leadsApi.remove(id)),
      );
      const succeeded: string[] = [];
      const failed: BulkResult["failed"] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") succeeded.push(ids[i]);
        else failed.push({ id: ids[i], reason: String(r.reason?.message ?? r.reason) });
      });
      return { succeeded, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient();
  return useMutation<
    BulkResult,
    Error,
    { ids: string[]; status: LeadStatus }
  >({
    mutationFn: async ({ ids, status }) => {
      const results = await Promise.allSettled(
        ids.map((id) => leadsApi.update(id, { status })),
      );
      const succeeded: string[] = [];
      const failed: BulkResult["failed"] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") succeeded.push(ids[i]);
        else failed.push({ id: ids[i], reason: String(r.reason?.message ?? r.reason) });
      });
      return { succeeded, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}
