/**
 * A tiny fetch wrapper. Keeping this hand-rolled (rather than axios/ky) so
 * the dependency surface stays small. The wrapper does three things:
 *  - serializes JSON bodies
 *  - parses JSON responses
 *  - throws an `ApiError` with field-level details on non-2xx responses,
 *    so React Query callers can surface server messages without parsing
 *    the response themselves.
 */

export interface ApiErrorBody {
  error?: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, body: ApiErrorBody | string | undefined) {
    const message =
      typeof body === "object" && body && body.error
        ? body.error
        : typeof body === "string"
          ? body
          : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (typeof body === "object" && body) this.fields = body.fields;
  }
}

const BASE = "/api";

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(BASE + path, { ...init, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, payload as ApiErrorBody | string);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T = void>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
