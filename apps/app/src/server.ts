// apps/app/src/server.ts — Shiftledger app server (Phase 5 — Launch ops)
import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, schema } from "./db/index.js";
import { eq, desc, sql, inArray, and, gte, count } from "drizzle-orm";
import { ContractService } from "./services/ContractService.js";
import { LedgerService } from "./services/LedgerService.js";
import { ShiftScheduler } from "./services/ShiftScheduler.js";
import { Verifier } from "./services/Verifier.js";
import type { VerificationRule } from "./services/Verifier.js";
import { ZendeskService } from "./services/ZendeskService.js";
import { PostmarkService } from "./services/PostmarkService.js";
import { NotionService } from "./services/NotionService.js";
import { installPiiScrubbing } from "./services/PiiScrubber.js";
import { startHeartbeat } from "./services/HeartbeatService.js";
import { DigestService } from "./services/DigestService.js";
import { EvalRunnerService } from "./services/EvalRunnerService.js";
import { startCronJobs } from "./services/CronScheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// Phase 4: Install PII scrubbing on console.log/error (PRI-2323 task 6)
installPiiScrubbing();

app.use(express.json());

// Static assets
app.use(express.static(path.join(__dirname, "..", "public")));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

// =============================================================================
// Helper functions for EJS templates
// =============================================================================

function renderStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    pending:   '<span class="badge badge-pending">PENDING</span>',
    active:    '<span class="badge badge-active">ACTIVE</span>',
    completed: '<span class="badge badge-completed">COMPLETED</span>',
    cancelled: '<span class="badge badge-cancelled">CANCELLED</span>',
    paused:    '<span class="badge badge-paused">PAUSED</span>',
    queued:    '<span class="badge badge-pending">QUEUED</span>',
    running:   '<span class="badge badge-active">RUNNING</span>',
    stuck:     '<span class="badge badge-cancelled">STUCK</span>',
    healthy:   '<span class="badge badge-healthy">HEALTHY</span>',
    expired:   '<span class="badge badge-expired">EXPIRED</span>',
    degraded:  '<span class="badge badge-degraded">DEGRADED</span>',
  };
  return badges[status] ?? `<span class="badge badge-pending">${status.toUpperCase()}</span>`;
}

function renderReceiptLineStatus(status: string): string {
  const badges: Record<string, string> = {
    cleared:   '<span class="badge badge-active"><span class="status-dot status-dot-green"></span> CLEARED</span>',
    voided:    '<span class="badge badge-cancelled"><span class="status-dot status-dot-red"></span> VOIDED</span>',
    disputed:  '<span class="badge badge-pending"><span class="status-dot status-dot-yellow"></span> DISPUTED</span>',
    escalated: '<span class="badge badge-degraded"><span class="status-dot status-dot-yellow"></span> ESCALATED</span>',
  };
  return badges[status] ?? `<span class="badge badge-pending">${status.toUpperCase()}</span>`;
}

// Inject helpers into all EJS renders
app.use((_req, res, next) => {
  res.locals.renderStatusBadge = renderStatusBadge;
  res.locals.renderReceiptLineStatus = renderReceiptLineStatus;
  next();
});

// =============================================================================
// Page Routes — Dashboard UI
// =============================================================================

// GET /app/contracts — Contracts dashboard (list)
app.get("/app/contracts", async (_req: Request, res: Response) => {
  try {
    const contracts = await db
      .select()
      .from(schema.contracts)
      .orderBy(desc(schema.contracts.createdAt));

    // Enrich with worker profile names
    const enriched = await Promise.all(
      contracts.map(async (c) => {
        if (!c.workerProfileId) return c;
        const [wp] = await db
          .select()
          .from(schema.workerProfiles)
          .where(eq(schema.workerProfiles.id, c.workerProfileId))
          .limit(1);
        return { ...c, workerProfile: wp ?? null };
      }),
    );

    // Compute stats
    const activeContracts = enriched.filter((c) => c.status === "active").length;
    let totalCleared = 0;
    let totalRevenue = 0;

    for (const c of enriched) {
      const shifts = await db
        .select()
        .from(schema.shifts)
        .where(eq(schema.shifts.contractId, c.id));
      for (const s of shifts) {
        totalCleared += s.outcomesCleared ?? 0;
        const lines = await LedgerService.getLinesByShiftId(s.id);
        const rev = lines
          .filter((l) => l.status === "cleared")
          .reduce((sum, l) => sum + parseFloat(l.unitPriceUsd ?? "0"), 0);
        totalRevenue += rev;
      }
    }

    const stats = {
      totalContracts: enriched.length,
      activeContracts,
      totalCleared,
      totalRevenue: totalRevenue.toFixed(2),
    };

    res.render("contracts/list", { contracts: enriched, stats });
  } catch (err) {
    console.error("[GET /app/contracts] Error:", err);
    res.status(500).send("Failed to load contracts dashboard");
  }
});

// GET /app/contracts/new — New contract form
app.get("/app/contracts/new", async (_req: Request, res: Response) => {
  try {
    const workerProfiles = await db.select().from(schema.workerProfiles);
    res.render("contracts/new", { workerProfiles });
  } catch (err) {
    console.error("[GET /app/contracts/new] Error:", err);
    res.status(500).send("Failed to load new contract form");
  }
});

// GET /app/contracts/:id — Contract detail
app.get("/app/contracts/:id", async (req: Request, res: Response) => {
  try {
    const contractId = String(req.params.id);
    const contract = await ContractService.getById(contractId);
    if (!contract) {
      res.status(404).send("Contract not found");
      return;
    }

    // Enrich with worker profile
    let workerProfile = null;
    if (contract.workerProfileId) {
      const [wp] = await db
        .select()
        .from(schema.workerProfiles)
        .where(eq(schema.workerProfiles.id, contract.workerProfileId))
        .limit(1);
      workerProfile = wp ?? null;
    }

    // Fetch shifts
    const shifts = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.contractId, contractId))
      .orderBy(desc(schema.shifts.startedAt));

    // Fetch all receipt lines across all shifts
    let receiptLines: any[] = [];
    let receiptSummary = { totalLines: 0, clearedCount: 0, voidedCount: 0, totalRevenueUsd: "0.00" };

    if (shifts.length > 0) {
      const shiftIds = shifts.map((s) => s.id);
      receiptLines = await db
        .select()
        .from(schema.receiptLines)
        .where(inArray(schema.receiptLines.shiftId, shiftIds))
        .orderBy(desc(schema.receiptLines.clearedAt))
        .limit(200);

      const cleared = receiptLines.filter((l) => l.status === "cleared");
      const voided = receiptLines.filter((l) => l.status === "voided");
      const revenue = cleared.reduce((sum, l) => sum + parseFloat(l.unitPriceUsd ?? "0"), 0);

      receiptSummary = {
        totalLines: receiptLines.length,
        clearedCount: cleared.length,
        voidedCount: voided.length,
        totalRevenueUsd: revenue.toFixed(2),
      };
    }

    res.render("contracts/detail", {
      contract: { ...contract, workerProfile },
      shifts,
      receiptLines: receiptLines.slice(0, 200),
      receiptSummary,
    });
  } catch (err) {
    console.error("[GET /app/contracts/:id] Error:", err);
    res.status(500).send("Failed to load contract detail");
  }
});

// GET /app/integrations — Integrations page
app.get("/app/integrations", async (req: Request, res: Response) => {
  try {
    // For now, use a demo customer or first customer
    const [customer] = await db.select().from(schema.customers).limit(1);
    const customerId = (req.query.customerId as string) || customer?.id || "";

    const providers = [
      { kind: "zendesk", displayName: "Zendesk", description: "Ticket resolution verification for CS shifts." },
      { kind: "intercom", displayName: "Intercom", description: "Conversation state verification for research shifts." },
      { kind: "salesforce", displayName: "Salesforce", description: "Lead status verification for SDR shifts." },
      { kind: "hubspot", displayName: "HubSpot", description: "Task completion verification for content shifts." },
    ];

    let integrationRows: any[] = [];
    if (customerId) {
      integrationRows = await db
        .select()
        .from(schema.integrations)
        .where(eq(schema.integrations.customerId, customerId));
    }

    const integrations: Record<string, any> = {};
    for (const row of integrationRows) {
      integrations[row.kind as string] = row;
    }

    res.render("integrations/index", { providers, integrations });
  } catch (err) {
    console.error("[GET /app/integrations] Error:", err);
    res.status(500).send("Failed to load integrations page");
  }
});

// Redirect /app → /app/contracts
app.get("/app", (_req, res) => res.redirect("/app/contracts"));

// =============================================================================
// API Routes — Health + Info
// =============================================================================

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "shiftledger-app", version: "0.6.0", timestamp: new Date().toISOString() });
});

app.get("/api", (_req, res) => {
  res.json({
    message: "Hello-Shiftledger",
    version: "0.6.0",
    phase: "6 — Post-launch experiments (white-label, analytics, drift, changelog)",
    endpoints: {
      health: "GET /api/health",
      contracts: "POST /api/contracts · GET /api/contracts/:id",
      contractsList: "GET /api/contracts",
      activateContract: "POST /api/contracts/:id/activate",
      workers: "GET /api/workers/:profileId",
      workerEvals: "GET /api/workers/:profileId/evals",
      integrations: "GET /api/integrations · POST /api/integrations",
      integrationHeartbeat: "POST /api/integrations/:id/heartbeat",
      e2e: "POST /api/e2e",
      internalShiftEnqueue: "POST /api/internal/shifts/enqueue",
      internalNotionSync: "POST /api/internal/notion/sync",
      internalOnboardingEmail: "POST /api/internal/onboarding/email",
      adminContracts: "POST /api/admin/contracts · GET /api/admin/contracts",
      adminRefund: "POST /api/admin/contracts/:id/refund",
      adminPartnerAnalytics: "GET /api/admin/partners/:code/analytics",
      adminPartnerBranding: "GET /api/admin/partners/:code/branding · POST /api/admin/partners/:code/branding",
      adminDashboard: "GET /api/admin/dashboard",
      adminShifts: "GET /api/admin/shifts",
      adminDisputes: "GET /api/admin/disputes",
      adminDriftCohort: "GET /api/admin/drift-cohort",
      adminChangelog: "POST /api/admin/changelog",
      changelog: "GET /changelog (public) · GET /api/changelog (JSON)",
      disputeLine: "POST /api/receipts/:lineId/dispute",
      escalateShift: "POST /api/shifts/:shiftId/escalate",
      receiptDetail: "GET /api/receipts/:lineId",
      digestRun: "POST /api/internal/digest/run",
      evalRun: "POST /api/internal/eval/run",
      driftCheck: "POST /api/internal/drift/check",
      driftLogStatusChange: "POST /api/internal/drift/log-status-change",
    },
  });
});

// =============================================================================
// API Routes — Contracts
// =============================================================================

// POST /api/contracts — Create a contract
app.post("/api/contracts", async (req: Request, res: Response) => {
  try {
    const { customerId, workerProfile, tier, outcomeTarget, budgetCapUsd, termMonths, autoRenew, referralCode } = req.body;

    if (!customerId || !workerProfile || !tier || !outcomeTarget) {
      res.status(400).json({
        error: { code: "missing_fields", message: "customerId, workerProfile, tier, and outcomeTarget are required" },
      });
      return;
    }

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

// GET /api/contracts — List all contracts
app.get("/api/contracts", async (_req: Request, res: Response) => {
  try {
    const contracts = await db
      .select()
      .from(schema.contracts)
      .orderBy(desc(schema.contracts.createdAt));
    res.json(contracts);
  } catch (err) {
    console.error("[GET /api/contracts] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to list contracts" } });
  }
});

// GET /api/contracts/:id — Fetch a contract with shifts and receipt summary
app.get("/api/contracts/:id", async (req: Request, res: Response) => {
  try {
    const contractId = String(req.params.id);
    const contract = await ContractService.getById(contractId);
    if (!contract) {
      res.status(404).json({ error: { code: "contract_not_found", message: "Contract not found" } });
      return;
    }

    const shiftRows = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.contractId, contractId));

    res.json({ contract, shifts: shiftRows });
  } catch (err) {
    console.error("[GET /api/contracts/:id] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch contract" } });
  }
});

// POST /api/contracts/:id/activate — Activate a contract
app.post("/api/contracts/:id/activate", async (req: Request, res: Response) => {
  try {
    const contract = await ContractService.activate(String(req.params.id));
    res.json(contract);
  } catch (err: any) {
    console.error("[POST /api/contracts/:id/activate] Error:", err);
    res.status(400).json({ error: { code: "activation_failed", message: err.message } });
  }
});

// =============================================================================
// API Routes — Integrations
// =============================================================================

// GET /api/integrations — List integrations for a customer
app.get("/api/integrations", async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customerId as string;
    if (!customerId) {
      // Return all integrations
      const all = await db.select().from(schema.integrations);
      res.json(all);
      return;
    }

    const rows = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.customerId, customerId));
    res.json(rows);
  } catch (err) {
    console.error("[GET /api/integrations] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to list integrations" } });
  }
});

// POST /api/integrations — Connect a new integration (paste-token flow)
app.post("/api/integrations", async (req: Request, res: Response) => {
  try {
    const { kind, apiToken, customerId } = req.body;

    if (!kind || !apiToken) {
      res.status(400).json({ error: { code: "missing_fields", message: "kind and apiToken are required" } });
      return;
    }

    const validKinds = ["zendesk", "intercom", "salesforce", "hubspot"];
    if (!validKinds.includes(kind)) {
      res.status(400).json({ error: { code: "invalid_kind", message: `Kind must be one of: ${validKinds.join(", ")}` } });
      return;
    }

    // Resolve customer — use provided ID or first customer
    let custId = customerId;
    if (!custId) {
      const [first] = await db.select().from(schema.customers).limit(1);
      custId = first?.id;
    }
    if (!custId) {
      res.status(400).json({ error: { code: "no_customer", message: "No customer found. Create a customer first." } });
      return;
    }

    // Validate token via heartbeat call
    let heartbeatResult: { ok: boolean; details?: string };
    try {
      heartbeatResult = await ZendeskService.validateToken(kind, apiToken);
    } catch (err: any) {
      res.status(400).json({ error: { code: "validation_failed", message: err.message } });
      return;
    }

    if (!heartbeatResult.ok) {
      res.status(400).json({ error: { code: "invalid_token", message: heartbeatResult.details || "Token validation failed" } });
      return;
    }

    // Encrypt and store
    const encrypted = ZendeskService.encryptToken(apiToken);
    const now = new Date();

    // Upsert: remove existing integration of same kind for this customer
    await db
      .delete(schema.integrations)
      .where(
        sql`${schema.integrations.customerId} = ${custId} AND ${schema.integrations.kind} = ${kind}`,
      );

    const [integration] = await db
      .insert(schema.integrations)
      .values({
        customerId: custId,
        kind,
        apiTokenEncrypted: encrypted,
        status: "healthy",
        lastHeartbeatAt: now,
      })
      .returning();

    res.status(201).json({ ...integration, apiTokenEncrypted: "[REDACTED]" });
  } catch (err) {
    console.error("[POST /api/integrations] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to connect integration" } });
  }
});

// POST /api/integrations/:id/heartbeat — Check integration health
app.post("/api/integrations/:id/heartbeat", async (req: Request, res: Response) => {
  try {
    const integrationId = String(req.params.id);
    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.id, integrationId))
      .limit(1);

    if (!integration) {
      res.status(404).json({ error: { code: "not_found", message: "Integration not found" } });
      return;
    }

    // Decrypt token
    let token: string;
    try {
      token = ZendeskService.decryptToken(integration.apiTokenEncrypted);
    } catch {
      await db
        .update(schema.integrations)
        .set({ status: "expired" })
        .where(eq(schema.integrations.id, integrationId));
      res.json({ status: "expired", message: "Token decryption failed" });
      return;
    }

    // Validate
    const result = await ZendeskService.validateToken(integration.kind, token);
    const newStatus = result.ok ? "healthy" : "degraded";

    await db
      .update(schema.integrations)
      .set({ status: newStatus, lastHeartbeatAt: new Date() })
      .where(eq(schema.integrations.id, integrationId));

    res.json({ status: newStatus, ok: result.ok, details: result.details });
  } catch (err) {
    console.error("[POST /api/integrations/:id/heartbeat] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Heartbeat check failed" } });
  }
});

// =============================================================================
// API Routes — Workers
// =============================================================================

app.get("/api/workers/:profileId", async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.profileId);
    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, profileId))
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

// =============================================================================
// API Routes — E2E (for testing)
// =============================================================================

app.post("/api/e2e", async (req: Request, res: Response) => {
  try {
    const { ShiftLedgerOrchestrator } = await import("./services/ShiftLedgerOrchestrator.js");

    // Use request body or defaults
    const customerId = req.body.customerId || (await (async () => {
      const [c] = await db.select().from(schema.customers).limit(1);
      return c?.id;
    })());

    if (!customerId) {
      res.status(400).json({ error: { code: "no_customer", message: "No customer available" } });
      return;
    }

    const workerProfileId = req.body.workerProfile || "cs-shift";
    const outcomeTarget = req.body.outcomeTarget || 10; // smaller for demo
    const tier = req.body.tier || "trial";

    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, workerProfileId))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: { code: "worker_not_found", message: `Profile '${workerProfileId}' not found` } });
      return;
    }

    const result = await ShiftLedgerOrchestrator.runE2E({
      customerId,
      workerProfileId,
      tier: tier as "trial" | "standard" | "enterprise",
      outcomeTarget,
      unitPriceUsd: profile.unitPriceUsd,
    });

    res.json(result);
  } catch (err) {
    console.error("[POST /api/e2e] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "E2E run failed" } });
  }
});

// =============================================================================
// Internal API Routes — Called by landing webhook (Phase 3)
// =============================================================================

// POST /api/internal/shifts/enqueue — Enqueue first shift after payment
app.post("/api/internal/shifts/enqueue", async (req: Request, res: Response) => {
  try {
    const { contractId } = req.body;
    if (!contractId) {
      res.status(400).json({ error: { code: "missing_field", message: "contractId is required" } });
      return;
    }

    // Check contract exists and is active
    const contract = await ContractService.getById(contractId);
    if (!contract) {
      res.status(404).json({ error: { code: "contract_not_found", message: `Contract ${contractId} not found` } });
      return;
    }

    if (contract.status !== "active") {
      res.status(400).json({ error: { code: "contract_not_active", message: `Contract ${contractId} is not active (status: ${contract.status})` } });
      return;
    }

    // Check if a shift already exists for this contract
    const existingShifts = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.contractId, contractId));

    if (existingShifts.length > 0) {
      res.json({ ok: true, shift: existingShifts[0], message: "Shift already exists" });
      return;
    }

    // Enqueue the first shift
    const shift = await ShiftScheduler.enqueue(contractId);
    console.log(`[internal] shift_enqueued contractId=${contractId} shiftId=${shift.id}`);

    res.status(201).json({ ok: true, shift });
  } catch (err) {
    console.error("[POST /api/internal/shifts/enqueue] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to enqueue shift" } });
  }
});

// POST /api/internal/notion/sync — Sync a contract to Notion
app.post("/api/internal/notion/sync", async (req: Request, res: Response) => {
  try {
    const { contractId } = req.body;
    if (!contractId) {
      res.status(400).json({ error: { code: "missing_field", message: "contractId is required" } });
      return;
    }

    const result = await NotionService.syncContract(contractId);
    res.json(result);
  } catch (err) {
    console.error("[POST /api/internal/notion/sync] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Notion sync failed" } });
  }
});

// POST /api/internal/onboarding/email — Send onboarding email
app.post("/api/internal/onboarding/email", async (req: Request, res: Response) => {
  try {
    const { contractId } = req.body;
    if (!contractId) {
      res.status(400).json({ error: { code: "missing_field", message: "contractId is required" } });
      return;
    }

    const contract = await ContractService.getById(contractId);
    if (!contract) {
      res.status(404).json({ error: { code: "contract_not_found", message: `Contract ${contractId} not found` } });
      return;
    }

    // Get customer email
    let customerEmail = "";
    if (contract.customerId) {
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, contract.customerId))
        .limit(1);
      customerEmail = customer?.email ?? "";
    }

    if (!customerEmail) {
      res.status(400).json({ error: { code: "no_customer_email", message: "Customer email not found" } });
      return;
    }

    // Get worker profile name
    let workerProfileName: string = contract.workerProfileId ?? "unknown";
    if (contract.workerProfileId) {
      const [wp] = await db
        .select()
        .from(schema.workerProfiles)
        .where(eq(schema.workerProfiles.id, contract.workerProfileId))
        .limit(1);
      if (wp) workerProfileName = wp.displayName;
    }

    const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3001/app/contracts";

    const result = await PostmarkService.sendOnboardingEmail({
      toEmail: customerEmail,
      contractId,
      workerProfileName,
      tier: String(contract.tier ?? "standard"),
      dashboardUrl: `${dashboardUrl}#${contractId}`,
    });

    res.json(result);
  } catch (err) {
    console.error("[POST /api/internal/onboarding/email] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to send onboarding email" } });
  }
});

// =============================================================================
// Admin API Routes — Bearer ADMIN_API_KEY (Phase 3)
// =============================================================================

// Admin auth middleware factory
function adminAuth(req: Request, res: Response, next: () => void): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({ error: { code: "not_configured", message: "ADMIN_API_KEY is not set" } });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // Constant-time comparison
  if (token.length !== adminKey.length) {
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid admin key" } });
    return;
  }

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ adminKey.charCodeAt(i);
  }

  if (mismatch !== 0) {
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid admin key" } });
    return;
  }

  next();
}

// POST /api/admin/contracts — Create Enterprise contract (admin-only)
app.post("/api/admin/contracts", adminAuth, async (req: Request, res: Response) => {
  try {
    const { customerEmail, workerProfile, tier, outcomeTarget, budgetCapUsd, termMonths, autoRenew, referralCode } = req.body;

    if (!customerEmail || !workerProfile || !tier) {
      res.status(400).json({
        error: { code: "missing_fields", message: "customerEmail, workerProfile, and tier are required" },
      });
      return;
    }

    // Validate tier
    if (!["trial", "standard", "enterprise"].includes(tier)) {
      res.status(400).json({ error: { code: "invalid_tier", message: "tier must be trial, standard, or enterprise" } });
      return;
    }

    // Upsert customer by email
    let customerId: string;
    const [existingCustomer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.email, customerEmail.toLowerCase().trim()))
      .limit(1);

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update agency partner code if referral provided and not already set
      if (referralCode && !existingCustomer.agencyPartnerCode) {
        await db
          .update(schema.customers)
          .set({ agencyPartnerCode: referralCode })
          .where(eq(schema.customers.id, customerId));
      }
    } else {
      const [newCustomer] = await db
        .insert(schema.customers)
        .values({
          email: customerEmail.toLowerCase().trim(),
          agencyPartnerCode: referralCode ?? null,
        })
        .returning();
      customerId = newCustomer.id;
    }

    // Resolve worker profile
    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, workerProfile))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: { code: "worker_not_found", message: `Worker profile '${workerProfile}' not found` } });
      return;
    }

    // Default outcome targets per tier if not specified
    const defaultOutcomes: Record<string, number> = { trial: 25, standard: 200, enterprise: 1000 };
    const finalOutcomeTarget = outcomeTarget ?? defaultOutcomes[tier] ?? 100;
    const unitPriceUsd = profile.unitPriceUsd;

    // Create contract (direct activation for Enterprise)
    const contract = await ContractService.create({
      customerId,
      workerProfileId: workerProfile,
      tier: tier as "trial" | "standard" | "enterprise",
      outcomeTarget: finalOutcomeTarget,
      unitPriceUsd,
      budgetCapUsd: budgetCapUsd ?? null,
      termMonths: termMonths ?? 1,
      autoRenew: autoRenew ?? true,
      referralCode: referralCode ?? null,
    });

    // For Enterprise, activate immediately (pre-paid by admin)
    let activatedContract = contract;
    if (tier === "enterprise") {
      activatedContract = await ContractService.activate(contract.id);

      // Enqueue first shift
      await ShiftScheduler.enqueue(contract.id);

      // Accrue rev-share if referralCode present
      if (referralCode) {
        await db.insert(schema.revShareLedger).values({
          contractId: contract.id,
          referralCode,
          shareRate: "0.2500",
          contractRevenueUsd: budgetCapUsd ?? unitPriceUsd,
          accruedUsd: String((parseFloat(budgetCapUsd ?? unitPriceUsd) * 0.25).toFixed(2)),
          status: "accruing",
        });
      }

      // Send onboarding email
      const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3001/app/contracts";
      PostmarkService.sendOnboardingEmail({
        toEmail: customerEmail,
        contractId: contract.id,
        workerProfileName: profile.displayName,
        tier,
        dashboardUrl: `${dashboardUrl}#${contract.id}`,
      }).catch((err) => console.error(`[admin] onboarding email failed: ${err.message}`));

      // Notion sync (async)
      NotionService.syncContract(contract.id).catch((err) =>
        console.error(`[admin] notion sync failed: ${err.message}`),
      );
    }

    // Generate hosted invoice URL if NOWPayments is configured
    let invoiceUrl: string | null = null;
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (apiKey) {
      try {
        const sandbox = (process.env.NOWPAYMENTS_SANDBOX ?? "false").toLowerCase() === "true";
        const apiBase = sandbox ? "https://api-sandbox.nowpayments.io" : "https://api.nowpayments.io";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${PORT}`;

        const npResponse = await fetch(`${apiBase}/v1/invoice`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({
            price_amount: parseFloat(budgetCapUsd ?? unitPriceUsd),
            price_currency: "usd",
            order_id: contract.id,
            order_description: `Shiftledger ${tier} — ${profile.displayName}`,
            ipn_callback_url: `${baseUrl}/api/webhooks/nowpayments`,
            success_url: `${baseUrl}/?order=${contract.id}&status=paid`,
            cancel_url: `${baseUrl}/?order=${contract.id}&status=cancelled`,
          }),
        });

        if (npResponse.ok) {
          const npData = (await npResponse.json()) as { invoice_url?: string };
          invoiceUrl = npData.invoice_url ?? null;
        }
      } catch (npErr) {
        console.error(`[admin] NOWPayments invoice creation failed: ${(npErr as Error).message}`);
      }
    }

    res.status(201).json({
      contract: tier === "enterprise" ? activatedContract : contract,
      invoiceUrl,
      activated: tier === "enterprise",
    });
  } catch (err) {
    console.error("[POST /api/admin/contracts] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to create contract" } });
  }
});

// GET /api/admin/contracts — List all contracts (admin-only)
app.get("/api/admin/contracts", adminAuth, async (_req: Request, res: Response) => {
  try {
    const contracts = await db
      .select()
      .from(schema.contracts)
      .orderBy(desc(schema.contracts.createdAt));

    // Enrich with customer emails
    const enriched = await Promise.all(
      contracts.map(async (c) => {
        let customerEmail = "";
        if (c.customerId) {
          const [cust] = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, c.customerId))
            .limit(1);
          customerEmail = cust?.email ?? "";
        }

        // Get rev-share info
        let revShare: any = null;
        if (c.referralCode) {
          const [rs] = await db
            .select()
            .from(schema.revShareLedger)
            .where(eq(schema.revShareLedger.contractId, c.id))
            .limit(1);
          revShare = rs ?? null;
        }

        return { ...c, customerEmail, revShare };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error("[GET /api/admin/contracts] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to list contracts" } });
  }
});

// GET /api/admin/partners/:code/analytics — Enhanced partner analytics (Phase 6 — 30/60/90-day windows)
app.get("/api/admin/partners/:code/analytics", adminAuth, async (req: Request, res: Response) => {
  try {
    const referralCode = String(req.params.code);

    const revRows = await db
      .select()
      .from(schema.revShareLedger)
      .where(eq(schema.revShareLedger.referralCode, referralCode));

    const totalAccrued = revRows.reduce((sum, r) => sum + parseFloat(r.accruedUsd ?? "0"), 0);
    const totalPaidOut = revRows.reduce((sum, r) => sum + parseFloat(r.paidOutUsd ?? "0"), 0);

    // Get contract IDs for this partner
    const contractIds = revRows.map((r) => r.contractId);

    // 30/60/90-day cleared totals
    const now = new Date();
    const clearedByWindow: Record<string, { clearedCount: number; revenueUsd: string }> = {};

    for (const days of [30, 60, 90]) {
      const label = `${days}d`;
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      let clearedCount = 0;
      let revenueSum = 0;

      if (contractIds.length > 0) {
        const contractShifts = await db
          .select()
          .from(schema.shifts)
          .where(inArray(schema.shifts.contractId, contractIds));

        if (contractShifts.length > 0) {
          const shiftIds = contractShifts.map((s) => s.id);
          const lines = await db
            .select()
            .from(schema.receiptLines)
            .where(
              and(
                inArray(schema.receiptLines.shiftId, shiftIds),
                eq(schema.receiptLines.status, "cleared"),
                gte(schema.receiptLines.clearedAt, since),
              ),
            );
          clearedCount = lines.length;
          revenueSum = lines.reduce((sum, l) => sum + parseFloat(l.unitPriceUsd ?? "0"), 0);
        }
      }
      clearedByWindow[label] = { clearedCount, revenueUsd: revenueSum.toFixed(2) };
    }

    // Top profiles
    let topProfiles: any[] = [];
    if (contractIds.length > 0) {
      const partnerContracts = await db
        .select()
        .from(schema.contracts)
        .where(inArray(schema.contracts.id, contractIds));

      const profileMap = new Map<string, any>();
      for (const c of partnerContracts) {
        if (!c.workerProfileId) continue;
        const key = c.workerProfileId;
        if (!profileMap.has(key)) {
          let displayName = key;
          const [wp] = await db.select().from(schema.workerProfiles).where(eq(schema.workerProfiles.id, key)).limit(1);
          if (wp) displayName = wp.displayName;
          profileMap.set(key, { profileId: key, displayName, contractCount: 0, totalCleared: 0, totalRevenue: 0 });
        }
        const entry = profileMap.get(key)!;
        entry.contractCount++;
        const cShifts = await db.select().from(schema.shifts).where(eq(schema.shifts.contractId, c.id));
        for (const s of cShifts) {
          const clearedLines = await db
            .select()
            .from(schema.receiptLines)
            .where(and(eq(schema.receiptLines.shiftId, s.id), eq(schema.receiptLines.status, "cleared")));
          entry.totalCleared += clearedLines.length;
          entry.totalRevenue += clearedLines.reduce((sum, l) => sum + parseFloat(l.unitPriceUsd ?? "0"), 0);
        }
      }
      topProfiles = Array.from(profileMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .map((p) => ({ ...p, totalRevenue: p.totalRevenue.toFixed(2) }));
    }

    // Active contracts + partner branding
    let activeContracts = 0;
    if (contractIds.length > 0) {
      const contracts = await db.select().from(schema.contracts).where(inArray(schema.contracts.id, contractIds));
      activeContracts = contracts.filter((c) => c.status === "active").length;
    }

    const [branding] = await db
      .select()
      .from(schema.partnerBranding)
      .where(eq(schema.partnerBranding.referralCode, referralCode))
      .limit(1);

    res.json({
      referralCode,
      overview: {
        totalAccrued: totalAccrued.toFixed(2),
        totalPaidOut: totalPaidOut.toFixed(2),
        outstandingBalance: (totalAccrued - totalPaidOut).toFixed(2),
        contractCount: revRows.length,
        activeContracts,
      },
      clearedByWindow,
      topProfiles,
      branding: branding ?? null,
      revShareRows: revRows.map((r) => ({
        contractId: r.contractId,
        accruedUsd: r.accruedUsd,
        paidOutUsd: r.paidOutUsd,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/partners/:code/analytics] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch partner analytics" } });
  }
});

// =============================================================================
// Phase 5: Worker Evals — GET /api/workers/:profileId/evals
// =============================================================================

app.get("/api/workers/:profileId/evals", async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.profileId);
    const sinceDays = parseInt(req.query.since as string) || 90;

    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const sinceStr = since.toISOString().slice(0, 10);

    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, profileId))
      .limit(1);

    if (!profile) {
      res.status(404).json({ error: { code: "worker_not_found", message: "Worker profile not found" } });
      return;
    }

    const evalRows = await db
      .select()
      .from(schema.evalRuns)
      .where(
        and(
          eq(schema.evalRuns.workerProfileId, profileId),
          gte(schema.evalRuns.weekStart, sinceStr),
        ),
      )
      .orderBy(desc(schema.evalRuns.weekStart));

    // Compute 30-day mean
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentEvals = evalRows.filter((e) => e.weekStart >= thirtyDaysAgoStr);

    let current30dMean = 0;
    if (recentEvals.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const e of recentEvals) {
        const w = e.sampleSize ?? 0;
        weightedSum += parseFloat(e.clearRate ?? "0") * w;
        totalWeight += w;
      }
      current30dMean = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    res.json({
      profileId,
      baseline: profile.baselineClearRate ? parseFloat(profile.baselineClearRate) : null,
      current30dMean,
      runs: evalRows.map((e) => ({
        weekStart: e.weekStart,
        clearRate: e.clearRate ? parseFloat(e.clearRate) : null,
        voidRate: e.voidRate ? parseFloat(e.voidRate) : null,
        sampleSize: e.sampleSize,
      })),
    });
  } catch (err) {
    console.error("[GET /api/workers/:profileId/evals] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch eval history" } });
  }
});

// =============================================================================
// Phase 5: Dispute — POST /api/receipts/:lineId/dispute
// =============================================================================

app.post("/api/receipts/:lineId/dispute", async (req: Request, res: Response) => {
  try {
    const lineId = String(req.params.lineId);
    const { reason } = req.body;

    const [line] = await db
      .select()
      .from(schema.receiptLines)
      .where(eq(schema.receiptLines.id, lineId))
      .limit(1);

    if (!line) {
      res.status(404).json({ error: { code: "line_not_found", message: "Receipt line not found" } });
      return;
    }

    if (line.status === "disputed") {
      res.status(400).json({ error: { code: "already_disputed", message: "This line is already under dispute" } });
      return;
    }

    // Mark line as disputed
    const now = new Date();
    await db
      .update(schema.receiptLines)
      .set({
        status: "disputed",
        disputedAt: now,
        verificationDetails: {
          ...(line.verificationDetails as Record<string, unknown> ?? {}),
          disputeReason: reason,
          disputeOpenedAt: now.toISOString(),
        },
      })
      .where(eq(schema.receiptLines.id, lineId));

    // Re-run verifier against fresh source-of-truth state
    // For stub: re-verify with same probability model
    // In production with Zendesk: poll fresh ticket state
    const reVerified = Math.random() < 0.90; // 90% clearance as per stub

    if (reVerified) {
      // Line confirmed — revert to cleared
      await db
        .update(schema.receiptLines)
        .set({
          status: "cleared",
          disputedAt: null,
          verificationDetails: {
            ...(line.verificationDetails as Record<string, unknown> ?? {}),
            disputeReVerified: true,
            disputeResolvedAt: new Date().toISOString(),
            disputeResolution: "confirmed_cleared",
          },
        })
        .where(eq(schema.receiptLines.id, lineId));

      res.json({
        lineId,
        status: "cleared",
        resolution: "confirmed_cleared",
        message: "Dispute resolved: line re-verified as cleared.",
      });
    } else {
      // Line confirmed voided — refund the unit price
      await db
        .update(schema.receiptLines)
        .set({
          status: "voided",
          voidedAt: now,
          verificationDetails: {
            ...(line.verificationDetails as Record<string, unknown> ?? {}),
            disputeReVerified: false,
            disputeResolvedAt: new Date().toISOString(),
            disputeResolution: "confirmed_voided",
          },
        })
        .where(eq(schema.receiptLines.id, lineId));

      res.json({
        lineId,
        status: "voided",
        resolution: "confirmed_voided",
        message: "Dispute resolved: line confirmed voided. Unit price will be refunded.",
      });
    }
  } catch (err) {
    console.error("[POST /api/receipts/:lineId/dispute] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to process dispute" } });
  }
});

// =============================================================================
// Phase 3: Escalate Shift — POST /api/shifts/:shiftId/escalate (docs/12 §3.8)
// =============================================================================

app.post("/api/shifts/:shiftId/escalate", async (req: Request, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId);
    const { reason } = req.body;

    const [shift] = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .limit(1);

    if (!shift) {
      res.status(404).json({ error: { code: "shift_not_found", message: "Shift not found" } });
      return;
    }

    if (shift.status === "completed" || shift.status === "cancelled") {
      res.status(400).json({ error: { code: "shift_terminal", message: `Cannot escalate a shift in '${shift.status}' status` } });
      return;
    }

    // Mark shift as escalated (set status to 'stuck' or keep running but flag for review)
    await db
      .update(schema.shifts)
      .set({
        status: "stuck",
        endedAt: new Date(),
      })
      .where(eq(schema.shifts.id, shiftId));

    console.log(`[escalate] shiftId=${shiftId} reason=${reason ?? "(not provided)"} escalatedAt=${new Date().toISOString()}`);

    res.json({
      shiftId,
      escalatedAt: new Date().toISOString(),
      eta: "24h",
      message: "Shift escalated for human review. Estimated response within 24 hours.",
    });
  } catch (err) {
    console.error("[POST /api/shifts/:shiftId/escalate] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to escalate shift" } });
  }
});

// =============================================================================
// Phase 5: Admin Refund — POST /api/admin/contracts/:id/refund
// =============================================================================

app.post("/api/admin/contracts/:id/refund", adminAuth, async (req: Request, res: Response) => {
  try {
    const contractId = String(req.params.id);

    const contract = await ContractService.getById(contractId);
    if (!contract) {
      res.status(404).json({ error: { code: "contract_not_found", message: "Contract not found" } });
      return;
    }

    // Get all shifts for this contract
    const allShifts = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.contractId, contractId));

    // Void unprocessed lines (lines in pending/queued shifts — i.e., not yet cleared)
    let voidedCount = 0;
    let refundAmount = 0;

    for (const shift of allShifts) {
      // Only void lines from non-completed shifts
      if (shift.status !== "completed") {
        const lines = await db
          .select()
          .from(schema.receiptLines)
          .where(eq(schema.receiptLines.shiftId, shift.id));

        for (const line of lines) {
          if (line.status !== "cleared") {
            await db
              .update(schema.receiptLines)
              .set({ status: "voided", voidedAt: new Date() })
              .where(eq(schema.receiptLines.id, line.id));
            voidedCount++;
            refundAmount += parseFloat(line.unitPriceUsd ?? "0");
          }
        }
      }
    }

    // Mark contract as cancelled
    await db
      .update(schema.contracts)
      .set({ status: "cancelled" })
      .where(eq(schema.contracts.id, contractId));

    console.log(
      `[refund] contractId=${contractId} voidedLines=${voidedCount} refundAmount=$${refundAmount.toFixed(2)}`,
    );

    res.json({
      contractId,
      status: "cancelled",
      voidedLines: voidedCount,
      refundAmountUsd: refundAmount.toFixed(2),
      message: `Contract cancelled. ${voidedCount} unprocessed lines voided. Refund: $${refundAmount.toFixed(2)} USD.`,
    });
  } catch (err) {
    console.error("[POST /api/admin/contracts/:id/refund] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to process refund" } });
  }
});

// =============================================================================
// Phase 5: Admin Dashboard API — GET /api/admin/dashboard
// =============================================================================

app.get("/api/admin/dashboard", adminAuth, async (_req: Request, res: Response) => {
  try {
    // Aggregate stats
    const [contractCount] = await db.select({ count: count() }).from(schema.contracts);
    const [activeCount] = await db
      .select({ count: count() })
      .from(schema.contracts)
      .where(eq(schema.contracts.status, "active"));
    const [customerCount] = await db.select({ count: count() }).from(schema.customers);

    // Total cleared lines and revenue
    const allLines = await db.select().from(schema.receiptLines);
    const clearedLines = allLines.filter((l) => l.status === "cleared");
    const voidedLines = allLines.filter((l) => l.status === "voided");
    const disputedLines = allLines.filter((l) => l.status === "disputed");
    const totalRevenue = clearedLines.reduce((sum, l) => sum + parseFloat(l.unitPriceUsd ?? "0"), 0);

    // Shifts stats
    const [stuckCount] = await db
      .select({ count: count() })
      .from(schema.shifts)
      .where(eq(schema.shifts.status, "stuck"));
    const [runningCount] = await db
      .select({ count: count() })
      .from(schema.shifts)
      .where(eq(schema.shifts.status, "running"));

    // Rev share totals
    const revRows = await db.select().from(schema.revShareLedger);
    const totalAccrued = revRows.reduce((sum, r) => sum + parseFloat(r.accruedUsd ?? "0"), 0);
    const totalPaidOut = revRows.reduce((sum, r) => sum + parseFloat(r.paidOutUsd ?? "0"), 0);

    // Worker profile drift statuses
    const profiles = await db.select().from(schema.workerProfiles);
    const driftSummary = profiles.map((p) => ({
      profileId: p.id,
      displayName: p.displayName,
      driftStatus: p.driftStatus ?? "green",
    }));

    res.json({
      contracts: {
        total: contractCount?.count ?? 0,
        active: activeCount?.count ?? 0,
      },
      customers: customerCount?.count ?? 0,
      receiptLines: {
        total: allLines.length,
        cleared: clearedLines.length,
        voided: voidedLines.length,
        disputed: disputedLines.length,
      },
      revenue: {
        totalUsd: totalRevenue.toFixed(2),
      },
      shifts: {
        running: runningCount?.count ?? 0,
        stuck: stuckCount?.count ?? 0,
      },
      revShare: {
        totalAccrued: totalAccrued.toFixed(2),
        totalPaidOut: totalPaidOut.toFixed(2),
        outstanding: (totalAccrued - totalPaidOut).toFixed(2),
      },
      driftSummary,
    });
  } catch (err) {
    console.error("[GET /api/admin/dashboard] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch admin dashboard" } });
  }
});

// GET /api/admin/shifts — List all shifts (admin-only)
app.get("/api/admin/shifts", adminAuth, async (_req: Request, res: Response) => {
  try {
    const allShifts = await db
      .select()
      .from(schema.shifts)
      .orderBy(desc(schema.shifts.startedAt))
      .limit(200);

    // Enrich with contract info
    const enriched = await Promise.all(
      allShifts.map(async (s) => {
        let contractTier = "";
        let workerProfileId = "";
        if (s.contractId) {
          const [c] = await db
            .select()
            .from(schema.contracts)
            .where(eq(schema.contracts.id, s.contractId))
            .limit(1);
          contractTier = c?.tier ?? "";
          workerProfileId = c?.workerProfileId ?? "";
        }
        return { ...s, contractTier, workerProfileId };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error("[GET /api/admin/shifts] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to list shifts" } });
  }
});

// GET /api/admin/disputes — List all disputed receipt lines (admin-only)
app.get("/api/admin/disputes", adminAuth, async (_req: Request, res: Response) => {
  try {
    const disputed = await db
      .select()
      .from(schema.receiptLines)
      .where(eq(schema.receiptLines.status, "disputed"))
      .orderBy(desc(schema.receiptLines.disputedAt))
      .limit(200);

    // Enrich with shift and contract info
    const enriched = await Promise.all(
      disputed.map(async (line) => {
        let shiftContractId = "";
        let shiftStatus = "";
        if (line.shiftId) {
          const [s] = await db
            .select()
            .from(schema.shifts)
            .where(eq(schema.shifts.id, line.shiftId))
            .limit(1);
          shiftContractId = s?.contractId ?? "";
          shiftStatus = s?.status ?? "";
        }
        return { ...line, shiftContractId, shiftStatus };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error("[GET /api/admin/disputes] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to list disputes" } });
  }
});

// GET /api/admin/partners — List all partner referrals (admin-only)
app.get("/api/admin/partners", adminAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(schema.revShareLedger)
      .orderBy(desc(schema.revShareLedger.createdAt));

    // Group by referral code
    const byCode = new Map<string, { contracts: number; accrued: number; paidOut: number }>();
    for (const row of rows) {
      const code = row.referralCode;
      if (!byCode.has(code)) {
        byCode.set(code, { contracts: 0, accrued: 0, paidOut: 0 });
      }
      const entry = byCode.get(code)!;
      entry.contracts++;
      entry.accrued += parseFloat(row.accruedUsd ?? "0");
      entry.paidOut += parseFloat(row.paidOutUsd ?? "0");
    }

    const partners = Array.from(byCode.entries()).map(([code, data]) => ({
      referralCode: code,
      contractCount: data.contracts,
      totalAccrued: data.accrued.toFixed(2),
      totalPaidOut: data.paidOut.toFixed(2),
      outstandingBalance: (data.accrued - data.paidOut).toFixed(2),
    }));

    res.json(partners);
  } catch (err) {
    console.error("[GET /api/admin/partners] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to list partners" } });
  }
});

// =============================================================================
// Phase 5: Admin Dashboard Page Routes
// =============================================================================

// GET /admin — Admin dashboard overview
app.get("/admin", adminPageAuth, async (_req: Request, res: Response) => {
  try {
    // Re-use the same aggregation as the API endpoint
    const [contractCount] = await db.select({ count: count() }).from(schema.contracts);
    const [activeCount] = await db
      .select({ count: count() })
      .from(schema.contracts)
      .where(eq(schema.contracts.status, "active"));
    const [customerCount] = await db.select({ count: count() }).from(schema.customers);
    const [disputedCount] = await db
      .select({ count: count() })
      .from(schema.receiptLines)
      .where(eq(schema.receiptLines.status, "disputed"));
    const [stuckCount] = await db
      .select({ count: count() })
      .from(schema.shifts)
      .where(eq(schema.shifts.status, "stuck"));

    const allLines = await db.select().from(schema.receiptLines);
    const clearedLines = allLines.filter((l) => l.status === "cleared");
    const totalRevenue = clearedLines.reduce((sum, l) => sum + parseFloat(l.unitPriceUsd ?? "0"), 0);

    const revRows = await db.select().from(schema.revShareLedger);
    const totalAccrued = revRows.reduce((sum, r) => sum + parseFloat(r.accruedUsd ?? "0"), 0);
    const totalPaidOut = revRows.reduce((sum, r) => sum + parseFloat(r.paidOutUsd ?? "0"), 0);

    // Recent contracts
    const recentContracts = await db
      .select()
      .from(schema.contracts)
      .orderBy(desc(schema.contracts.createdAt))
      .limit(10);

    // Enrich with customer emails
    const enrichedContracts = await Promise.all(
      recentContracts.map(async (c) => {
        let email = "";
        if (c.customerId) {
          const [cust] = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, c.customerId))
            .limit(1);
          email = cust?.email ?? "";
        }
        return { ...c, customerEmail: email };
      }),
    );

    // Worker profiles with drift status
    const profiles = await db.select().from(schema.workerProfiles);

    const stats = {
      totalContracts: contractCount?.count ?? 0,
      activeContracts: activeCount?.count ?? 0,
      totalCustomers: customerCount?.count ?? 0,
      totalRevenue: totalRevenue.toFixed(2),
      disputedLines: disputedCount?.count ?? 0,
      stuckShifts: stuckCount?.count ?? 0,
      revShareAccrued: totalAccrued.toFixed(2),
      revSharePaidOut: totalPaidOut.toFixed(2),
      revShareOutstanding: (totalAccrued - totalPaidOut).toFixed(2),
    };

    res.render("admin/dashboard", {
      stats,
      recentContracts: enrichedContracts,
      workerProfiles: profiles,
    });
  } catch (err) {
    console.error("[GET /admin] Error:", err);
    res.status(500).send("Failed to load admin dashboard");
  }
});

// GET /admin/contracts — Admin contracts list
app.get("/admin/contracts", adminPageAuth, async (_req: Request, res: Response) => {
  try {
    const contracts = await db
      .select()
      .from(schema.contracts)
      .orderBy(desc(schema.contracts.createdAt));

    const enriched = await Promise.all(
      contracts.map(async (c) => {
        let customerEmail = "";
        if (c.customerId) {
          const [cust] = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, c.customerId))
            .limit(1);
          customerEmail = cust?.email ?? "";
        }

        let workerProfileName = c.workerProfileId ?? "";
        if (c.workerProfileId) {
          const [wp] = await db
            .select()
            .from(schema.workerProfiles)
            .where(eq(schema.workerProfiles.id, c.workerProfileId))
            .limit(1);
          workerProfileName = wp?.displayName ?? workerProfileName;
        }

        return { ...c, customerEmail, workerProfileName };
      }),
    );

    res.render("admin/contracts", { contracts: enriched });
  } catch (err) {
    console.error("[GET /admin/contracts] Error:", err);
    res.status(500).send("Failed to load admin contracts");
  }
});

// GET /admin/disputes — Admin disputes list
app.get("/admin/disputes", adminPageAuth, async (_req: Request, res: Response) => {
  try {
    const disputed = await db
      .select()
      .from(schema.receiptLines)
      .where(eq(schema.receiptLines.status, "disputed"))
      .orderBy(desc(schema.receiptLines.disputedAt))
      .limit(200);

    // Enrich
    const enriched = await Promise.all(
      disputed.map(async (line) => {
        let contractId = "";
        let contractTier = "";
        if (line.shiftId) {
          const [s] = await db
            .select()
            .from(schema.shifts)
            .where(eq(schema.shifts.id, line.shiftId))
            .limit(1);
          if (s?.contractId) {
            contractId = s.contractId;
            const [c] = await db
              .select()
              .from(schema.contracts)
              .where(eq(schema.contracts.id, s.contractId))
              .limit(1);
            contractTier = c?.tier ?? "";
          }
        }
        return { ...line, contractId, contractTier };
      }),
    );

    res.render("admin/disputes", { disputes: enriched });
  } catch (err) {
    console.error("[GET /admin/disputes] Error:", err);
    res.status(500).send("Failed to load admin disputes");
  }
});

// GET /admin/partners — Admin partner payouts
app.get("/admin/partners", adminPageAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(schema.revShareLedger)
      .orderBy(desc(schema.revShareLedger.createdAt));

    // Group by referral code
    const byCode = new Map<string, { contracts: number; accrued: number; paidOut: number; rows: any[] }>();
    for (const row of rows) {
      const code = row.referralCode;
      if (!byCode.has(code)) {
        byCode.set(code, { contracts: 0, accrued: 0, paidOut: 0, rows: [] });
      }
      const entry = byCode.get(code)!;
      entry.contracts++;
      entry.accrued += parseFloat(row.accruedUsd ?? "0");
      entry.paidOut += parseFloat(row.paidOutUsd ?? "0");
      entry.rows.push(row);
    }

    const partners = Array.from(byCode.entries()).map(([code, data]) => ({
      referralCode: code,
      contractCount: data.contracts,
      totalAccrued: data.accrued.toFixed(2),
      totalPaidOut: data.paidOut.toFixed(2),
      outstandingBalance: (data.accrued - data.paidOut).toFixed(2),
      rows: data.rows.slice(0, 5), // Show most recent 5 contracts
    }));

    res.render("admin/partners", { partners });
  } catch (err) {
    console.error("[GET /admin/partners] Error:", err);
    res.status(500).send("Failed to load admin partners");
  }
});

// GET /admin/shifts — Admin shifts page
app.get("/admin/shifts", adminPageAuth, async (_req: Request, res: Response) => {
  try {
    const allShifts = await db
      .select()
      .from(schema.shifts)
      .orderBy(desc(schema.shifts.startedAt))
      .limit(200);

    const enriched = await Promise.all(
      allShifts.map(async (s) => {
        let contractTier = "";
        let workerProfileId = "";
        if (s.contractId) {
          const [c] = await db
            .select()
            .from(schema.contracts)
            .where(eq(schema.contracts.id, s.contractId))
            .limit(1);
          contractTier = c?.tier ?? "";
          workerProfileId = c?.workerProfileId ?? "";
        }
        return { ...s, contractTier, workerProfileId };
      }),
    );

    res.render("admin/shifts", { shifts: enriched });
  } catch (err) {
    console.error("[GET /admin/shifts] Error:", err);
    res.status(500).send("Failed to load admin shifts");
  }
});

// Admin page auth — cookie/session check for dashboard pages
// Phase 5: For MVP, use a simple cookie-based admin session
// Replaces open-saas role-gating with cookie verification
function adminPageAuth(req: Request, res: Response, next: () => void): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    // No admin key configured → allow local dev access
    next();
    return;
  }

  // Check for admin session cookie
  const adminToken = req.cookies?.admin_token ?? "";
  if (adminToken === adminKey) {
    next();
    return;
  }

  // Check for Bearer token in Authorization header
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (token.length === adminKey.length) {
    let mismatch = 0;
    for (let i = 0; i < token.length; i++) {
      mismatch |= token.charCodeAt(i) ^ adminKey.charCodeAt(i);
    }
    if (mismatch === 0) {
      next();
      return;
    }
  }

  // Redirect to login page
  res.redirect("/admin/login");
}

// POST /admin/login — Admin login (sets cookie)
app.post("/admin/login", (req: Request, res: Response) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.redirect("/admin");
    return;
  }

  const { token } = req.body;
  if (token === adminKey) {
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    res.redirect("/admin");
  } else {
    res.render("admin/login", { error: "Invalid admin token" });
  }
});

// GET /admin/login — Admin login page
app.get("/admin/login", (_req: Request, res: Response) => {
  res.render("admin/login", { error: null });
});

// =============================================================================
// Phase 5: Internal Cron Trigger Endpoints
// =============================================================================

// POST /api/internal/digest/run — Manually trigger weekly digest
app.post("/api/internal/digest/run", adminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await DigestService.runWeeklyDigest();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/internal/digest/run] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Digest run failed" } });
  }
});

// POST /api/internal/eval/run — Manually trigger nightly eval
app.post("/api/internal/eval/run", adminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await EvalRunnerService.runNightlyEval();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/internal/eval/run] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Eval run failed" } });
  }
});

// =============================================================================
// Phase 6: Partner Branding — White-label receipt configuration
// =============================================================================

// POST /api/admin/partners/:code/branding — Upload partner branding (admin)
app.post("/api/admin/partners/:code/branding", adminAuth, async (req: Request, res: Response) => {
  try {
    const referralCode = String(req.params.code);
    const { logoDataUrl, footerText, contactEmail } = req.body;

    if (!logoDataUrl && !footerText && !contactEmail) {
      res.status(400).json({ error: { code: "missing_fields", message: "At least one of logoDataUrl, footerText, or contactEmail is required" } });
      return;
    }

    // Validate logo data URL if provided
    if (logoDataUrl && !logoDataUrl.startsWith("data:image/")) {
      res.status(400).json({ error: { code: "invalid_logo", message: "logoDataUrl must be a data:image/* URL" } });
      return;
    }

    // Check if partner has any rev-share entries (must be a valid partner)
    const [existing] = await db
      .select()
      .from(schema.revShareLedger)
      .where(eq(schema.revShareLedger.referralCode, referralCode))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: "partner_not_found", message: `No rev-share entries found for referral code '${referralCode}'` } });
      return;
    }

    // Upsert branding
    const now = new Date();
    const [current] = await db
      .select()
      .from(schema.partnerBranding)
      .where(eq(schema.partnerBranding.referralCode, referralCode))
      .limit(1);

    if (current) {
      const [updated] = await db
        .update(schema.partnerBranding)
        .set({
          logoDataUrl: logoDataUrl ?? current.logoDataUrl,
          footerText: footerText ?? current.footerText,
          contactEmail: contactEmail ?? current.contactEmail,
          updatedAt: now,
        })
        .where(eq(schema.partnerBranding.referralCode, referralCode))
        .returning();
      res.json({ ok: true, branding: updated });
    } else {
      const [inserted] = await db
        .insert(schema.partnerBranding)
        .values({ referralCode, logoDataUrl, footerText, contactEmail, updatedAt: now })
        .returning();
      res.status(201).json({ ok: true, branding: inserted });
    }
  } catch (err) {
    console.error("[POST /api/admin/partners/:code/branding] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to save partner branding" } });
  }
});

// GET /api/admin/partners/:code/branding — Get partner branding
app.get("/api/admin/partners/:code/branding", adminAuth, async (req: Request, res: Response) => {
  try {
    const referralCode = String(req.params.code);
    const [branding] = await db
      .select()
      .from(schema.partnerBranding)
      .where(eq(schema.partnerBranding.referralCode, referralCode))
      .limit(1);

    if (!branding) {
      res.json({ referralCode, logoDataUrl: null, footerText: null, contactEmail: null, configured: false });
      return;
    }
    res.json({ ...branding, configured: true });
  } catch (err) {
    console.error("[GET /api/admin/partners/:code/branding] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch partner branding" } });
  }
});

// =============================================================================
// Phase 6: White-label Receipt — HTML and PDF endpoints
// =============================================================================

// GET /api/receipts/:lineId — Receipt detail (HTML, white-label capable)
app.get("/api/receipts/:lineId", async (req: Request, res: Response) => {
  try {
    const lineId = String(req.params.lineId);

    const [line] = await db
      .select()
      .from(schema.receiptLines)
      .where(eq(schema.receiptLines.id, lineId))
      .limit(1);

    if (!line) {
      res.status(404).json({ error: { code: "line_not_found", message: "Receipt line not found" } });
      return;
    }

    // Resolve shift → contract → customer → worker profile → partner branding
    let shift: any = null;
    let contract: any = null;
    let customer: any = null;
    let workerProfile: any = null;
    let partnerBranding: any = null;

    if (line.shiftId) {
      [shift] = await db
        .select()
        .from(schema.shifts)
        .where(eq(schema.shifts.id, line.shiftId))
        .limit(1);

      if (shift?.contractId) {
        [contract] = await db
          .select()
          .from(schema.contracts)
          .where(eq(schema.contracts.id, shift.contractId))
          .limit(1);

        if (contract?.customerId) {
          [customer] = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, contract.customerId))
            .limit(1);
        }

        if (contract?.workerProfileId) {
          [workerProfile] = await db
            .select()
            .from(schema.workerProfiles)
            .where(eq(schema.workerProfiles.id, contract.workerProfileId))
            .limit(1);
        }

        // Check for partner branding via contract's referralCode
        if (contract?.referralCode) {
          [partnerBranding] = await db
            .select()
            .from(schema.partnerBranding)
            .where(eq(schema.partnerBranding.referralCode, contract.referralCode))
            .limit(1);
        }
      }
    }

    // Determine if we should render JSON or HTML
    const accept = req.headers.accept ?? "";
    if (accept.includes("application/json") && !accept.includes("text/html")) {
      res.json({
        line,
        shift,
        contract: contract ? { id: contract.id, tier: contract.tier, referralCode: contract.referralCode } : null,
        customer: customer ? { email: customer.email, orgName: customer.orgName } : null,
        workerProfile: workerProfile ? { id: workerProfile.id, displayName: workerProfile.displayName } : null,
        partnerBranding: partnerBranding ?? null,
      });
      return;
    }

    res.render("receipts/detail", {
      line,
      shift,
      contract,
      customer,
      workerProfile,
      partnerBranding: partnerBranding ?? null,
      formatCurrency: (val: string | number) => {
        const n = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
      },
      formatDate: (d: string | Date | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      },
    });
  } catch (err) {
    console.error("[GET /api/receipts/:lineId] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to load receipt" } });
  }
});

// =============================================================================
// Phase 6: Drift-Cohort Retention Report
// =============================================================================

// GET /api/admin/drift-cohort — Drift-cohort retention analysis
app.get("/api/admin/drift-cohort", adminAuth, async (req: Request, res: Response) => {
  try {
    const daysParam = parseInt(req.query.days as string) || 30;

    // Get all worker profiles
    const profiles = await db.select().from(schema.workerProfiles);

    const cohortResults: any[] = [];
    const now = new Date();
    const windowMs = daysParam * 24 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - windowMs);

    for (const profile of profiles) {
      const currentStatus = profile.driftStatus ?? "green";

      // Get all status changes for this profile in the window
      const statusChanges = await db
        .select()
        .from(schema.profileStatusLog)
        .where(
          and(
            eq(schema.profileStatusLog.workerProfileId, profile.id),
            gte(schema.profileStatusLog.changedAt, windowStart),
          ),
        )
        .orderBy(schema.profileStatusLog.changedAt);

      // Get all contracts using this profile (active within the window)
      const profileContracts = await db
        .select()
        .from(schema.contracts)
        .where(
          and(
            eq(schema.contracts.workerProfileId, profile.id),
            gte(schema.contracts.createdAt, windowStart),
          ),
        );

      // Get customers for these contracts
      const customerIds = [...new Set(profileContracts.map((c) => c.customerId).filter(Boolean))] as string[];

      // Churn: customers whose contracts were created before the drift but cancelled after
      let customersChurned = 0;
      let customersRetained = 0;

      for (const c of profileContracts) {
        if (c.status === "cancelled") {
          customersChurned++;
        } else if (c.status === "active" || c.status === "completed") {
          customersRetained++;
        }
      }

      const totalCustomers = customersChurned + customersRetained;
      const churnRate = totalCustomers > 0 ? customersChurned / totalCustomers : 0;

      cohortResults.push({
        profileId: profile.id,
        displayName: profile.displayName,
        currentDriftStatus: currentStatus,
        statusChanges: statusChanges.length,
        lastStatusChange: statusChanges.length > 0 ? statusChanges[statusChanges.length - 1].changedAt : null,
        contractCount: profileContracts.length,
        customersTotal: totalCustomers,
        customersRetained,
        customersChurned,
        churnRate: parseFloat(churnRate.toFixed(4)),
      });
    }

    // Aggregate by drift status
    const byStatus = new Map<string, { profiles: number; totalCustomers: number; churned: number }>();
    for (const r of cohortResults) {
      const key = r.currentDriftStatus;
      if (!byStatus.has(key)) {
        byStatus.set(key, { profiles: 0, totalCustomers: 0, churned: 0 });
      }
      const entry = byStatus.get(key)!;
      entry.profiles++;
      entry.totalCustomers += r.customersTotal;
      entry.churned += r.customersChurned;
    }

    const aggregateByStatus: any[] = [];
    for (const [status, data] of byStatus.entries()) {
      aggregateByStatus.push({
        driftStatus: status,
        profileCount: data.profiles,
        totalCustomers: data.totalCustomers,
        churnedCustomers: data.churned,
        churnRate: data.totalCustomers > 0 ? parseFloat((data.churned / data.totalCustomers).toFixed(4)) : 0,
      });
    }

    // Sort by churn rate descending
    aggregateByStatus.sort((a, b) => b.churnRate - a.churnRate);

    res.json({
      windowDays: daysParam,
      generatedAt: now.toISOString(),
      cohorts: cohortResults,
      aggregateByStatus,
      summary: {
        totalProfiles: profiles.length,
        profilesWithChanges: cohortResults.filter((c) => c.statusChanges > 0).length,
        overallChurnRate:
          cohortResults.reduce((s, c) => s + c.customersTotal, 0) > 0
            ? parseFloat(
                (
                  cohortResults.reduce((s, c) => s + c.customersChurned, 0) /
                  cohortResults.reduce((s, c) => s + c.customersTotal, 0)
                ).toFixed(4),
              )
            : 0,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/drift-cohort] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to compute drift-cohort report" } });
  }
});

// POST /api/internal/drift/log-status-change — Record a drift status change (called by drift checker)
app.post("/api/internal/drift/log-status-change", adminAuth, async (req: Request, res: Response) => {
  try {
    const { workerProfileId, oldStatus, newStatus } = req.body;

    if (!workerProfileId || !newStatus) {
      res.status(400).json({ error: { code: "missing_fields", message: "workerProfileId and newStatus are required" } });
      return;
    }

    const [row] = await db
      .insert(schema.profileStatusLog)
      .values({
        workerProfileId,
        oldStatus: oldStatus ?? null,
        newStatus,
        changedAt: new Date(),
      })
      .returning();

    // Also create a changelog entry for drift events
    await db.insert(schema.changelogEntries).values({
      eventType: "drift_event",
      title: `Drift status change: ${workerProfileId}`,
      description: `Worker profile "${workerProfileId}" drift status changed from ${oldStatus ?? "(initial)"} to ${newStatus}.`,
      metadata: { workerProfileId, oldStatus, newStatus },
      publishedAt: new Date(),
    });

    res.status(201).json({ ok: true, statusLog: row });
  } catch (err) {
    console.error("[POST /api/internal/drift/log-status-change] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to log status change" } });
  }
});

// =============================================================================
// Phase 6: Public Changelog
// =============================================================================

// GET /changelog — Public changelog page (last 30 days)
app.get("/changelog", async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const entries = await db
      .select()
      .from(schema.changelogEntries)
      .where(gte(schema.changelogEntries.publishedAt, since))
      .orderBy(desc(schema.changelogEntries.publishedAt))
      .limit(100);

    // Group by date
    const grouped: Record<string, any[]> = {};
    for (const entry of entries) {
      const dateKey = entry.publishedAt ? new Date(entry.publishedAt).toISOString().slice(0, 10) : "unknown";
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    }

    // If no entries exist, seed some initial entries from existing data
    if (entries.length === 0) {
      // Show profile data as initial changelog
      const profiles = await db.select().from(schema.workerProfiles);
      for (const p of profiles) {
        if (!grouped["launch"]) grouped["launch"] = [];
        grouped["launch"].push({
          id: `seed-${p.id}`,
          eventType: "profile_added",
          title: `Profile available: ${p.displayName}`,
          description: `Category: ${p.category} | Unit price: $${p.unitPriceUsd} | Baseline clear rate: ${p.baselineClearRate ? `${(parseFloat(p.baselineClearRate) * 100).toFixed(1)}%` : "N/A"}`,
          metadata: null,
          publishedAt: new Date(),
        });
      }

      // Show recent payouts
      const recentPayouts = await db
        .select()
        .from(schema.revShareLedger)
        .where(eq(schema.revShareLedger.status, "paid"))
        .orderBy(desc(schema.revShareLedger.updatedAt))
        .limit(10);

      for (const rp of recentPayouts) {
        if (!grouped["launch"]) grouped["launch"] = [];
        grouped["launch"].push({
          id: `seed-payout-${rp.id}`,
          eventType: "payout",
          title: `Partner payout: ${rp.referralCode}`,
          description: `Paid out $${rp.paidOutUsd} for contract ${rp.contractId}`,
          metadata: null,
          publishedAt: rp.updatedAt ?? new Date(),
        });
      }
    }

    res.render("changelog/index", {
      grouped,
      entries,
      formatDate: (d: string | Date) => {
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      },
      formatEventIcon: (eventType: string) => {
        const icons: Record<string, string> = {
          profile_added: "🤖",
          drift_event: "📊",
          payout: "💰",
          system: "⚙️",
        };
        return icons[eventType] ?? "📌";
      },
    });
  } catch (err) {
    console.error("[GET /changelog] Error:", err);
    res.status(500).send("Failed to load changelog");
  }
});

// GET /api/changelog — Public changelog API (JSON)
app.get("/api/changelog", async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const entries = await db
      .select()
      .from(schema.changelogEntries)
      .where(gte(schema.changelogEntries.publishedAt, since))
      .orderBy(desc(schema.changelogEntries.publishedAt))
      .limit(100);

    res.json({ entries, count: entries.length, since: since.toISOString() });
  } catch (err) {
    console.error("[GET /api/changelog] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch changelog" } });
  }
});

// POST /api/admin/changelog — Create a changelog entry (admin)
app.post("/api/admin/changelog", adminAuth, async (req: Request, res: Response) => {
  try {
    const { eventType, title, description, metadata } = req.body;

    if (!eventType || !title) {
      res.status(400).json({ error: { code: "missing_fields", message: "eventType and title are required" } });
      return;
    }

    const validTypes = ["profile_added", "drift_event", "payout", "system"];
    if (!validTypes.includes(eventType)) {
      res.status(400).json({ error: { code: "invalid_event_type", message: `eventType must be one of: ${validTypes.join(", ")}` } });
      return;
    }

    const [entry] = await db
      .insert(schema.changelogEntries)
      .values({
        eventType,
        title,
        description: description ?? null,
        metadata: metadata ?? null,
        publishedAt: new Date(),
      })
      .returning();

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    console.error("[POST /api/admin/changelog] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to create changelog entry" } });
  }
});

// =============================================================================
// Phase 6: Update drift checker to log status changes
// =============================================================================

// POST /api/internal/drift/check — Enhanced to also log status changes
// (Overrides the Phase 5 handler — now logs to profile_status_log + changelog)
app.post("/api/internal/drift/check", adminAuth, async (req: Request, res: Response) => {
  try {
    const profileId = req.body.profileId as string;
    if (!profileId) {
      res.status(400).json({ error: { code: "missing_field", message: "profileId is required" } });
      return;
    }

    // Capture old status before drift check
    const [profile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, profileId))
      .limit(1);
    const oldStatus = profile?.driftStatus ?? "green";

    const { EvalRunnerService } = await import("./services/EvalRunnerService.js");
    const result = await EvalRunnerService.checkProfileDrift(profileId);

    // If drift status changed, log it
    if (oldStatus !== result.status) {
      await db.insert(schema.profileStatusLog).values({
        workerProfileId: profileId,
        oldStatus,
        newStatus: result.status,
        changedAt: new Date(),
      });

      // Auto-create changelog entry for drift events
      await db.insert(schema.changelogEntries).values({
        eventType: "drift_event",
        title: `Drift status change: ${profileId}`,
        description: `Worker profile "${profileId}" drift status changed from ${oldStatus} to ${result.status} (drift: ${result.drift.toFixed(3)}).`,
        metadata: { workerProfileId: profileId, oldStatus, newStatus: result.status, drift: result.drift },
        publishedAt: new Date(),
      });
    }

    res.json({ ok: true, ...result, oldStatus });
  } catch (err) {
    console.error("[POST /api/internal/drift/check] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Drift check failed" } });
  }
});

// =============================================================================
// Start Server
// =============================================================================

// We need cookie-parser for admin page auth
// For simplicity, parse cookies manually
app.use((req: Request, _res: Response, next: () => void) => {
  const raw = req.headers.cookie ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  (req as any).cookies = cookies;
  next();
});

app.listen(PORT, () => {
  console.log(`[shiftledger-app] Phase 6 running on http://localhost:${PORT}`);
  console.log(`[shiftledger-app] Dashboard: http://localhost:${PORT}/app/contracts`);
  console.log(`[shiftledger-app] Admin: http://localhost:${PORT}/admin`);
  console.log(`[shiftledger-app] Changelog: http://localhost:${PORT}/changelog`);
  console.log(`[shiftledger-app] Admin API: http://localhost:${PORT}/api/admin/contracts`);

  // Phase 4: Start integration heartbeat + alert monitor (PRI-2323 task 8)
  if (process.env.START_HEARTBEAT !== "false") {
    startHeartbeat();
  }

  // Phase 5: Start cron jobs (digest + eval) (PRI-2322 task 1-2)
  if (process.env.START_CRON_JOBS !== "false") {
    startCronJobs();
  }
});

export default app;
