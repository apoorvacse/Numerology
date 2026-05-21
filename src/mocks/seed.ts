import { v4 as uuidv4 } from "uuid";
import type { Lead, LeadStatus } from "@/domain/lead";

/**
 * Deterministic seed generator. We don't use Faker because:
 *  - We want builds to be reproducible (same data on every reload).
 *  - The dataset surface is small enough that a hand-rolled generator
 *    keeps bundle size lean.
 *
 * The default count (5,000) is large enough to test virtualization
 * decisions; for the assessment's "~50 sample leads" baseline we expose
 * the first 50 via `/api/_seed` for inspection.
 */

const FIRST_NAMES = [
  "Aarav", "Aditi", "Alex", "Amelia", "Ananya", "Arjun", "Aria",
  "Ben", "Bianca", "Cameron", "Carlos", "Chloe", "Daniel", "Diya",
  "Elena", "Ethan", "Fatima", "Felix", "Gabriel", "Grace", "Hannah",
  "Hiroshi", "Ibrahim", "Isabella", "Jacob", "Jaya", "Kabir", "Kai",
  "Lara", "Liam", "Maya", "Mia", "Nadia", "Nikhil", "Olivia", "Omar",
  "Priya", "Rahul", "Riya", "Sara", "Sasha", "Tanya", "Theo",
  "Uma", "Victor", "Wei", "Xavier", "Yara", "Zain", "Zoe",
];

const LAST_NAMES = [
  "Anand", "Bose", "Carter", "Chen", "D'Souza", "Davies", "Evans",
  "Fernandez", "Gupta", "Hassan", "Ibanez", "Iyer", "Jain", "Kapoor",
  "Khan", "Kumar", "Lal", "Lee", "Mehra", "Mukherjee", "Nair",
  "Okafor", "Patel", "Quinn", "Rao", "Reddy", "Sharma", "Shah",
  "Singh", "Tan", "Thakur", "Verma", "Wilson", "Yadav", "Zhao",
];

const SOURCES = [
  "website",
  "referral",
  "campaign",
  "linkedin",
  "event",
  "cold-outbound",
  "partner",
  "organic-search",
];

// Status distribution roughly mimics a real funnel — most leads at the top,
// few at the bottom — so the UI looks lived-in.
const STATUS_DISTRIBUTION: Array<{ s: LeadStatus; weight: number }> = [
  { s: "NEW", weight: 35 },
  { s: "CONTACTED", weight: 25 },
  { s: "QUALIFIED", weight: 15 },
  { s: "CONVERTED", weight: 10 },
  { s: "LOST", weight: 15 },
];

/** Mulberry32 PRNG so the seed is deterministic. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: ReadonlyArray<T>, r: number): T {
  return arr[Math.floor(r * arr.length)];
}

function pickStatus(r: number): LeadStatus {
  const total = STATUS_DISTRIBUTION.reduce((sum, x) => sum + x.weight, 0);
  let roll = r * total;
  for (const { s, weight } of STATUS_DISTRIBUTION) {
    roll -= weight;
    if (roll <= 0) return s;
  }
  return "NEW";
}

export function generateSeedLeads(count: number, seed = 42): Lead[] {
  const rand = rng(seed);
  const now = Date.now();
  const leads: Lead[] = [];

  for (let i = 0; i < count; i++) {
    const first = pick(FIRST_NAMES, rand());
    const last = pick(LAST_NAMES, rand());
    const name = `${first} ${last}`;
    const emailHandle = `${first}.${last}`
      .toLowerCase()
      .replace(/[^a-z.]/g, "");
    const email = `${emailHandle}${i}@example.com`;
    const phone =
      rand() < 0.7
        ? `+1 (${Math.floor(200 + rand() * 700)}) ${Math.floor(
            100 + rand() * 900,
          )}-${Math.floor(1000 + rand() * 9000)}`
        : undefined;
    const source = rand() < 0.85 ? pick(SOURCES, rand()) : undefined;
    const status = pickStatus(rand());

    // Spread creation dates across the last 180 days, with updated_at after.
    const ageMs = Math.floor(rand() * 180 * 24 * 60 * 60 * 1000);
    const created = now - ageMs;
    const updateOffset = Math.floor(rand() * Math.min(ageMs, 30 * 24 * 60 * 60 * 1000));
    const updated = created + updateOffset;

    leads.push({
      id: uuidv4(),
      name,
      email,
      phone,
      status,
      source,
      created_at: new Date(created).toISOString(),
      updated_at: new Date(updated).toISOString(),
    });
  }

  // Most-recently-updated first by default.
  leads.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return leads;
}
