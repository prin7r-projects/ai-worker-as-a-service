// apps/app/src/server.ts — Shiftledger app server (Phase 2 — UX surfaces)
import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, schema } from "./db/index.js";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { ContractService } from "./services/ContractService.js";
import { LedgerService } from "./services/LedgerService.js";
import { ShiftScheduler } from "./services/ShiftScheduler.js";
import { Verifier } from "./services/Verifier.js";
import type { VerificationRule } from "./services/Verifier.js";
import { ZendeskService } from "./services/ZendeskService.js";
import { PostmarkService } from "./services/PostmarkService.js";
import { NotionService } from "./services/NotionService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

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
  res.json({ status: "ok", service: "shiftledger-app", version: "0.3.0", timestamp: new Date().toISOString() });
});

app.get("/api", (_req, res) => {
  res.json({
    message: "Hello-Shiftledger",
    version: "0.3.0",
    phase: "3 — Payments + onboarding + Notion",
    endpoints: {
      health: "GET /api/health",
      contracts: "POST /api/contracts · GET /api/contracts/:id",
      contractsList: "GET /api/contracts",
      activateContract: "POST /api/contracts/:id/activate",
      workers: "GET /api/workers/:profileId",
      integrations: "GET /api/integrations · POST /api/integrations",
      integrationHeartbeat: "POST /api/integrations/:id/heartbeat",
      e2e: "POST /api/e2e",
      internalShiftEnqueue: "POST /api/internal/shifts/enqueue",
      internalNotionSync: "POST /api/internal/notion/sync",
      internalOnboardingEmail: "POST /api/internal/onboarding/email",
      adminContracts: "POST /api/admin/contracts · GET /api/admin/contracts",
      adminPartnerAnalytics: "GET /api/admin/partners/:code/analytics",
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

// GET /api/admin/partners/:code/analytics — Partner analytics (Phase 3)
app.get("/api/admin/partners/:code/analytics", adminAuth, async (req: Request, res: Response) => {
  try {
    const referralCode = String(req.params.code);

    const revRows = await db
      .select()
      .from(schema.revShareLedger)
      .where(eq(schema.revShareLedger.referralCode, referralCode));

    const totalAccrued = revRows.reduce((sum, r) => sum + parseFloat(r.accruedUsd ?? "0"), 0);
    const totalPaidOut = revRows.reduce((sum, r) => sum + parseFloat(r.paidOutUsd ?? "0"), 0);
    const contractCount = revRows.length;

    // Get contract statuses
    const contractIds = revRows.map((r) => r.contractId);
    let activeContracts = 0;
    if (contractIds.length > 0) {
      const contracts = await db
        .select()
        .from(schema.contracts)
        .where(inArray(schema.contracts.id, contractIds));
      activeContracts = contracts.filter((c) => c.status === "active").length;
    }

    res.json({
      referralCode,
      totalAccrued: totalAccrued.toFixed(2),
      totalPaidOut: totalPaidOut.toFixed(2),
      outstandingBalance: (totalAccrued - totalPaidOut).toFixed(2),
      contractCount,
      activeContracts,
      revShareRows: revRows,
    });
  } catch (err) {
    console.error("[GET /api/admin/partners/:code/analytics] Error:", err);
    res.status(500).json({ error: { code: "internal", message: "Failed to fetch partner analytics" } });
  }
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`[shiftledger-app] Phase 3 running on http://localhost:${PORT}`);
  console.log(`[shiftledger-app] Dashboard: http://localhost:${PORT}/app/contracts`);
  console.log(`[shiftledger-app] Admin: http://localhost:${PORT}/api/admin/contracts`);
});

export default app;
