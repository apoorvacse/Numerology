import type {
  CreateLeadInput,
  Lead,
  LeadStatus,
  UpdateLeadInput,
} from "@/domain/lead";
import { api } from "./client";

export interface ListLeadsParams {
  q?: string;
  status?: ReadonlyArray<LeadStatus>;
  page?: number;
  pageSize?: number;
  sort?: "updated_at" | "created_at" | "name";
  order?: "asc" | "desc";
}

export interface ListLeadsResponse {
  items: Lead[];
  total: number;
}

function toQueryString(params: ListLeadsParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status && params.status.length > 0) {
    sp.set("status", params.status.join(","));
  }
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const leadsApi = {
  list(params: ListLeadsParams = {}): Promise<ListLeadsResponse> {
    return api.get<ListLeadsResponse>(`/leads${toQueryString(params)}`);
  },
  get(id: string): Promise<Lead> {
    return api.get<Lead>(`/leads/${id}`);
  },
  create(input: CreateLeadInput): Promise<Lead> {
    return api.post<Lead>(`/leads`, input);
  },
  update(id: string, input: UpdateLeadInput): Promise<Lead> {
    return api.patch<Lead>(`/leads/${id}`, input);
  },
  remove(id: string): Promise<void> {
    return api.delete<void>(`/leads/${id}`);
  },
};
