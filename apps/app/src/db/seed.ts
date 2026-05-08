// apps/app/src/db/seed.ts — Seed worker profiles from data/seed/worker-profiles.json
import { db, schema } from "./index.js";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WorkerProfileSeed {
  id: string;
  displayName: string;
  category: string;
  unitPriceUsd: string;
  verificationRule: Record<string, unknown>;
  baselineClearRate: string;
  driftStatus?: string;
}

async function seed() {
  const seedPath = resolve(__dirname, "../../../data/seed/worker-profiles.json");
  const raw = readFileSync(seedPath, "utf-8");
  const profiles: WorkerProfileSeed[] = JSON.parse(raw);

  console.log(`[seed] Loading ${profiles.length} worker profiles from ${seedPath}`);

  for (const p of profiles) {
    const existing = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, p.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[seed] SKIP ${p.id} — already exists`);
      continue;
    }

    await db.insert(schema.workerProfiles).values({
      id: p.id,
      displayName: p.displayName,
      category: p.category,
      unitPriceUsd: p.unitPriceUsd,
      verificationRule: p.verificationRule,
      baselineClearRate: p.baselineClearRate,
      driftStatus: p.driftStatus ?? "green",
    });

    console.log(`[seed] INSERT ${p.id} — ${p.displayName}`);
  }

  console.log("[seed] Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
