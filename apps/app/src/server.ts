// apps/app/src/server.ts — Shiftledger app server entry (Phase 1)
import express, { type Express } from "express";
import { ContractService } from "./services/ContractService.js";
import { db, schema } from "./db/index.js";
import { eq } from "drizzle-orm";

const app: Express = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "shiftledger-app", version: "0.2.0", timestamp: new Date().toISOString() });
});

// Hello-Shiftledger
app.get("/api", (_req, res) => {
  res.json({
    message: "Hello-Shiftledger",
    version: "0.2.0",
    phase: "1 — Core domain",
    docs: "See docs/12-technical-specification.md and docs/13-implementation-plan.md",
    endpoints: {
      health: "GET /api/health",
      contracts: "POST /api/contracts · GET /api/contracts/:id",
      "workers": "GET /api/workers/:profileId",
      checkout: "POST /api/checkout/nowpayments (landing — already live)",
    },
  });
});

// POST /api/contracts — Create a contract
app.post("/api/contracts", async (req, res) => {
  try {
    const { customerId, workerProfile, tier, outcomeTarget, budgetCapUsd, termMonths, autoRenew, referralCode } = req.body;

    // Validate required fields
    if (!customerId || !workerProfile || !tier || !outcomeTarget) {
      res.status(400).json({
        error: { code: "missing_fields", message: "customerId, workerProfile, tier, and outcomeTarget are required" },
      });
      return;
    }

    // Look up worker profile to get unitPriceUsd
    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, workerProfile))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: { code: "worker_not_found", message: `Worker profile '${workerProfile}' not found` } });
      return;
    }

    const contract = await ContractService.create({
      customerId,
      workerProfileId: workerProfile,
      tier,
      outcomeTarget,
      unitPriceUsd: profile.unitPriceUsd,
      budgetCapUsd,
      termMonths,
      autoRenew,
      referralCode,
    });

    res.status(201).json(contract);
  } catch (err) {
    console.error("[POST /api/contracts] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to create contract" } });
  }
});

// GET /api/contracts/:id — Fetch a contract with linked shifts and receipt summary
app.get("/api/contracts/:id", async (req, res) => {
  try {
    const contract = await ContractService.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: { code: "contract_not_found", message: "Contract not found" } });
      return;
    }

    // Fetch linked shifts
    const shiftRows = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.contractId, req.params.id));

    res.json({ contract, shifts: shiftRows });
  } catch (err) {
    console.error("[GET /api/contracts/:id] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch contract" } });
  }
});

// GET /api/workers/:profileId — Fetch a worker profile
app.get("/api/workers/:profileId", async (req, res) => {
  try {
    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, req.params.profileId))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: { code: "worker_not_found", message: "Worker profile not found" } });
      return;
    }

    res.json(profile);
  } catch (err) {
    console.error("[GET /api/workers/:profileId] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch worker profile" } });
  }
});

app.listen(PORT, () => {
  console.log(`[shiftledger-app] Running on http://localhost:${PORT}`);
});

export default app;
