/**
 * [SHIFTLEDGER_NOWPAYMENTS_CHECKOUT] POST /api/checkout/nowpayments
 *
 * Phase 3: Persists contracts in DB before creating the NOWPayments invoice.
 * Phase 4: Idempotency middleware — same (email, workerProfile, tier, hour) returns existing invoice.
 *
 * Body: {
 *   plan: "trial" | "standard" | "enterprise",
 *   workerProfile: string,      // e.g. "cs-shift"
 *   email: string,              // customer email (for upsert + magic-link)
 *   orgName?: string,           // optional company name
 *   referralCode?: string,      // optional partner referral code
 * }
 *
 * Returns: { invoice_url, invoice_id, contractId, plan, deposit_usd } on success.
 *
 * Flow:
 *   0. Idempotency check — same (email, workerProfile, tier, hour) → return cached
 *   1. Validate plan + worker profile
 *   2. Upsert customer (by email)
 *   3. Create contract (pending) in DB with order_id = contractId
 *   4. Create NOWPayments invoice with same order_id
 *   5. Cache result and return checkout URL
 *
 * Errors:
 *   HTTP 400  for unknown plan ids / missing fields
 *   HTTP 404  for unknown worker profile
 *   HTTP 503  for missing env
 *   HTTP 502  for upstream NOWPayments failures
 */

import { NextResponse } from "next/server";
import { MissingEnvError, appUrlFromRequest } from "@/lib/env";
import { PLANS, createNowpaymentsInvoice, isPlanId } from "@/lib/nowpayments";
import type { PlanId } from "@/lib/nowpayments";
import { db, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Outcome targets per tier (matching the plan structure)
const TIER_OUTCOMES: Record<PlanId, { outcomeTarget: number; unitPriceUsd: string }> = {
  trial:      { outcomeTarget: 25,  unitPriceUsd: "7.96" },   // $199 / 25
  standard:   { outcomeTarget: 200, unitPriceUsd: "4.995" },  // $999 / 200
  enterprise: { outcomeTarget: 1000, unitPriceUsd: "5.00" },  // $5000 / 1000
};

type CheckoutBody = {
  plan?: string;
  workerProfile?: string;
  email?: string;
  orgName?: string;
  referralCode?: string;
};

export async function POST(request: Request) {
  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    body = {};
  }

  const planId = body.plan;
  if (!isPlanId(planId)) {
    return NextResponse.json(
      {
        error: "unknown_plan",
        message: `Unknown plan: ${String(planId)}. Allowed: ${Object.keys(PLANS).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  // Phase 3: validate required fields
  const workerProfileId = body.workerProfile;
  const email = body.email;

  if (!workerProfileId) {
    return NextResponse.json(
      { error: "missing_field", message: "workerProfile is required" },
      { status: 400 },
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "missing_field", message: "email is required and must be valid" },
      { status: 400 },
    );
  }

  const plan = PLANS[planId];
  const baseUrl = appUrlFromRequest(request);
  const tierConfig = TIER_OUTCOMES[planId];

  // ── Phase 4: Idempotency check ──────────────────────────────────────────
  // Key: (customerEmail, workerProfile, tier, hour).
  // Duplicate checkout within the same hour returns the existing invoice.
  const normalizedEmail = email.toLowerCase().trim();
  const hourBucket = Math.floor(Date.now() / 3_600_000); // current hour as integer
  const idemKey = `${normalizedEmail}|${workerProfileId}|${planId}|${hourBucket}`;
  const idemHash = crypto.createHash("sha256").update(idemKey).digest("hex");

  try {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3_600_000);

    const [existingIdem] = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(
        and(
          eq(schema.idempotencyKeys.idemHash, idemHash),
          gte(schema.idempotencyKeys.createdAt, hourAgo),
        ),
      )
      .limit(1);

    if (existingIdem) {
      console.log(
        `[CHECKOUT] idempotent_replay hash=${idemHash.slice(0,12)} email=${normalizedEmail} plan=${planId}`,
      );
      return NextResponse.json(existingIdem.responsePayload as Record<string, unknown>, {
        status: 200,
        headers: { "X-Idempotent-Replay": "true" },
      });
    }
  } catch {
    // Idempotency check is a best-effort guard; DB failure should not block checkout.
    console.warn("[CHECKOUT] idempotency_check_db_error — proceeding without idempotency guard");
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // 1. Look up worker profile
    const [workerProfile] = await db
      .select()
      .from(schema.workerProfiles)
      .where(eq(schema.workerProfiles.id, workerProfileId))
      .limit(1);

    if (!workerProfile) {
      return NextResponse.json(
        { error: "worker_not_found", message: `Worker profile '${workerProfileId}' not found` },
        { status: 404 },
      );
    }

    // 2. Upsert customer by email
    let customerId: string;
    const [existingCustomer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Optionally update orgName if provided
      if (body.orgName && !existingCustomer.orgName) {
        await db
          .update(schema.customers)
          .set({ orgName: body.orgName })
          .where(eq(schema.customers.id, customerId));
      }
      // Update agency partner code if referral provided
      if (body.referralCode && !existingCustomer.agencyPartnerCode) {
        await db
          .update(schema.customers)
          .set({ agencyPartnerCode: body.referralCode })
          .where(eq(schema.customers.id, customerId));
      }
    } else {
      const [newCustomer] = await db
        .insert(schema.customers)
        .values({
          email: email.toLowerCase().trim(),
          orgName: body.orgName ?? null,
          agencyPartnerCode: body.referralCode ?? null,
        })
        .returning();
      customerId = newCustomer.id;
    }

    // 3. Create contract (pending) — use the same ID as the NOWPayments order_id
    const contractId = [
      "shiftledger",
      planId,
      Date.now(),
      Math.random().toString(36).slice(2, 8),
    ].join("_");

    const unitPriceUsd = tierConfig.unitPriceUsd;
    const outcomeTarget = tierConfig.outcomeTarget;

    await db.insert(schema.contracts).values({
      id: contractId,
      customerId,
      workerProfileId,
      tier: planId,
      status: "pending",
      outcomeTarget,
      unitPriceUsd,
      budgetCapUsd: String(plan.depositUsd),
      termMonths: planId === "enterprise" ? 1 : planId === "standard" ? 1 : 1,
      autoRenew: planId !== "trial",
      referralCode: body.referralCode ?? null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    console.log(
      `[CHECKOUT] contract_created id=${contractId} customerId=${customerId} plan=${planId} email=${email}`,
    );

    // 4. Create NOWPayments invoice with contractId as order_id
    const invoice = await createNowpaymentsInvoice({
      plan,
      baseUrl,
      orderId: contractId,
    });

    console.log(
      `[CHECKOUT] invoice_created invoice_id=${invoice.id} contractId=${contractId}`,
    );

    const responsePayload = {
      mode: "live",
      plan: plan.id,
      deposit_usd: plan.depositUsd,
      invoice_id: invoice.id,
      invoice_url: invoice.invoice_url,
      contractId,
    };

    // Phase 4: Cache the idempotency key so repeat requests return same invoice
    try {
      await db.insert(schema.idempotencyKeys).values({
        idemHash,
        idemKey,
        responsePayload: responsePayload as unknown as Record<string, unknown>,
      });
      console.log(`[CHECKOUT] idempotency_cached hash=${idemHash.slice(0,12)}`);
    } catch (cacheErr) {
      // Non-fatal: if the cache fails, checkout still succeeds.
      console.warn(`[CHECKOUT] idempotency_cache_failed: ${(cacheErr as Error).message}`);
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return NextResponse.json(
        {
          error: "missing_env",
          missing: error.envName,
          message:
            "The receipt printer is offline. Shiftledger's NOWPayments lane is not wired up on this deployment yet — the buyer's pool can't be opened until the operator finishes the env setup. Email desk@ai-worker-as-a-service.prin7r.com and we'll hand-issue the deposit receipt within one business day.",
        },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: "upstream_error", message }, { status: 502 });
  }
}
