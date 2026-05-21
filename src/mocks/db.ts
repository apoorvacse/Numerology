import { v4 as uuidv4 } from "uuid";
import type { Lead } from "@/domain/lead";
import { generateSeedLeads } from "./seed";

/**
 * A simple in-memory store backed by localStorage so the mock survives
 * page refreshes. We deliberately keep this dumb — no IndexedDB, no
 * schema migrations — because it's a mock.
 *
 * If localStorage isn't available (private mode, quota), we fall back
 * to a pure in-memory store and log once. The app still works; just
 * loses state on refresh.
 */

const STORAGE_KEY = "mini-lead-crm:leads:v1";
const SEED_COUNT = 5000;

let leads: Lead[] = [];
let storageOk = true;

function loadFromStorage(): Lead[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Lead[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    storageOk = false;
    return null;
  }
}

function saveToStorage(): void {
  if (!storageOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // Quota exceeded or denied. Demote to in-memory only and warn once.
    if (storageOk) {
      console.warn(
        "[mock-api] localStorage write failed; persisting in-memory only.",
      );
    }
    storageOk = false;
  }
}

export function initDb(): void {
  const existing = loadFromStorage();
  if (existing && existing.length > 0) {
    leads = existing;
  } else {
    leads = generateSeedLeads(SEED_COUNT);
    saveToStorage();
  }
}

export function getAll(): Lead[] {
  return leads;
}

export function getById(id: string): Lead | undefined {
  return leads.find((l) => l.id === id);
}

export function insert(input: Omit<Lead, "id" | "created_at" | "updated_at">): Lead {
  const now = new Date().toISOString();
  const lead: Lead = {
    ...input,
    id: uuidv4(),
    created_at: now,
    updated_at: now,
  };
  leads = [lead, ...leads];
  saveToStorage();
  return lead;
}

export function update(id: string, patch: Partial<Lead>): Lead | undefined {
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return undefined;
  const next: Lead = {
    ...leads[idx],
    ...patch,
    id: leads[idx].id,
    created_at: leads[idx].created_at,
    updated_at: new Date().toISOString(),
  };
  leads = [...leads.slice(0, idx), next, ...leads.slice(idx + 1)];
  saveToStorage();
  return next;
}

export function remove(id: string): boolean {
  const before = leads.length;
  leads = leads.filter((l) => l.id !== id);
  const removed = leads.length < before;
  if (removed) saveToStorage();
  return removed;
}

/** Test/demo helper. Resets to a fresh seed. */
export function resetDb(): void {
  leads = generateSeedLeads(SEED_COUNT);
  saveToStorage();
}
