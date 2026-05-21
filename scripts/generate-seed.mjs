// Tiny script to emit a public/seed.json that mirrors the in-app seed
// generator's first 50 records. Mirrors src/mocks/seed.ts exactly so the
// shape on disk matches the shape in the app. We duplicate (instead of
// importing) to avoid pulling TS tooling into a build script.

import { writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FIRST_NAMES = [
  "Aarav","Aditi","Alex","Amelia","Ananya","Arjun","Aria",
  "Ben","Bianca","Cameron","Carlos","Chloe","Daniel","Diya",
  "Elena","Ethan","Fatima","Felix","Gabriel","Grace","Hannah",
  "Hiroshi","Ibrahim","Isabella","Jacob","Jaya","Kabir","Kai",
  "Lara","Liam","Maya","Mia","Nadia","Nikhil","Olivia","Omar",
  "Priya","Rahul","Riya","Sara","Sasha","Tanya","Theo",
  "Uma","Victor","Wei","Xavier","Yara","Zain","Zoe",
];
const LAST_NAMES = [
  "Anand","Bose","Carter","Chen","D'Souza","Davies","Evans",
  "Fernandez","Gupta","Hassan","Ibanez","Iyer","Jain","Kapoor",
  "Khan","Kumar","Lal","Lee","Mehra","Mukherjee","Nair",
  "Okafor","Patel","Quinn","Rao","Reddy","Sharma","Shah",
  "Singh","Tan","Thakur","Verma","Wilson","Yadav","Zhao",
];
const SOURCES = ["website","referral","campaign","linkedin","event","cold-outbound","partner","organic-search"];
const STATUS_DISTRIBUTION = [
  { s: "NEW", weight: 35 },
  { s: "CONTACTED", weight: 25 },
  { s: "QUALIFIED", weight: 15 },
  { s: "CONVERTED", weight: 10 },
  { s: "LOST", weight: 15 },
];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, r) => arr[Math.floor(r * arr.length)];
function pickStatus(r) {
  const total = STATUS_DISTRIBUTION.reduce((sum, x) => sum + x.weight, 0);
  let roll = r * total;
  for (const { s, weight } of STATUS_DISTRIBUTION) {
    roll -= weight;
    if (roll <= 0) return s;
  }
  return "NEW";
}

function generate(count, seed = 42) {
  const rand = rng(seed);
  const now = Date.now();
  const leads = [];
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST_NAMES, rand());
    const last = pick(LAST_NAMES, rand());
    const name = `${first} ${last}`;
    const emailHandle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
    const email = `${emailHandle}${i}@example.com`;
    const phone = rand() < 0.7
      ? `+1 (${Math.floor(200 + rand() * 700)}) ${Math.floor(100 + rand() * 900)}-${Math.floor(1000 + rand() * 9000)}`
      : undefined;
    const source = rand() < 0.85 ? pick(SOURCES, rand()) : undefined;
    const status = pickStatus(rand());
    const ageMs = Math.floor(rand() * 180 * 24 * 60 * 60 * 1000);
    const created = now - ageMs;
    const updateOffset = Math.floor(rand() * Math.min(ageMs, 30 * 24 * 60 * 60 * 1000));
    const updated = created + updateOffset;
    leads.push({
      id: randomUUID(),
      name,
      email,
      phone,
      status,
      source,
      created_at: new Date(created).toISOString(),
      updated_at: new Date(updated).toISOString(),
    });
  }
  leads.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return leads;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "../public/seed.json");
mkdirSync(dirname(out), { recursive: true });
const records = generate(50);
writeFileSync(out, JSON.stringify(records, null, 2) + "\n", "utf8");
console.log(`Wrote ${records.length} leads → ${out}`);
