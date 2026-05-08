/**
 * [SHIFTLEDGER_NOWPAYMENTS_IPN] POST /api/webhooks/nowpayments
 *
 * Phase 3: Full payment processing — contract activation, rev-share, Notion sync.
 *
 * NOWPayments delivers payment status updates here. The body is JSON; the
 * `x-nowpayments-sig` header carries the HMAC-SHA512 signature over the
 * alphabetically sorted JSON payload, signed with NOWPAYMENTS_IPN_SECRET.
 *
 * Behaviour:
 *   HTTP 503 if `NOWPAYMENTS_IPN_SECRET` is unset (operator gap, not auth).
 *   HTTP 401 if signature verification fails.
 *   HTTP 400 if the body is not valid JSON.
 *   HTTP 200 + { ok, paid, order_id, status, activated } on a verified payload.
 *
 * Idempotent on (contractId, paymentStatus) — replaying the same IPN is safe.
 *
 * On payment_status = 'finished':
 *   1. Record payment event (idempotency guard)
 *   2. Mark contract active + set activatedAt
 *   3. Enqueue first shift (via app server)
 *   4. Accrue 25% rev-share if referralCode present
 *   5. Sync to Notion (async, best-effort)
 *   6. Return activation success
 *
 * Never trust an unverified payload.
 */

import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { verifyNowpaymentsIpn } from "@/lib/nowpayments";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = optionalEnv("NOWPAYMENTS_IPN_SECRET");
  if (!secret) {
    return NextResponse.json(
      {
        error: "missing_env",
        missing: "NOWPAYMENTS_IPN_SECRET",
        message: "Webhook handler is not configured yet.",
      },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_payload", message: "Body was not valid JSON." },
      { status: 400 },
    );
  }

  const signature = request.headers.get("x-nowpayments-sig");
  const verified = verifyNowpaymentsIpn(payload, signature, secret);
  if (!verified) {
    return NextResponse.json({ error: "signature_invalid" }, { status: 401 });
  }

  const paymentStatus = stringValue(payload.payment_status) ?? "";
  const paid = ["finished", "confirmed"].includes(paymentStatus.toLowerCase());
  const orderId =
    stringValue(payload.order_id) ?? stringValue(payload.payment_id) ?? "nowpayments_unknown";
  const invoiceId = stringValue(payload.invoice_id);

  console.log(
    `[SHIFTLEDGER_NOWPAYMENTS_IPN] verified=true order_id=${orderId} status=${paymentStatus} paid=${paid}`,
  );

  // Idempotency check: has this (contractId, paymentStatus) already been processed?
  const [existingEvent] = await db
    .select()
    .from(schema.paymentEvents)
    .where(
      and(
        eq(schema.paymentEvents.contractId, orderId),
        eq(schema.paymentEvents.paymentStatus, paymentStatus),
      ),
    )
    .limit(1);

  if (existingEvent) {
    console.log(
      `[SHIFTLEDGER_NOWPAYMENTS_IPN] idempotent_replay order_id=${orderId} status=${paymentStatus}`,
    );
    return NextResponse.json({
      ok: true,
      verified: true,
      paid,
      order_id: orderId,
      status: paymentStatus,
      idempotent: true,
    });
  }

  // Record payment event for idempotency
  await db.insert(schema.paymentEvents).values({
    contractId: orderId,
    paymentStatus,
    nowpaymentsInvoiceId: invoiceId ?? null,
    rawPayload: payload,
  });

  // On finished/confirmed payment, activate the contract
  let activated = false;
  if (paid) {
    try {
      // 1. Activate contract
      const now = new Date();
      await db
        .update(schema.contracts)
        .set({
          status: "active",
          activatedAt: now,
        })
        .where(eq(schema.contracts.id, orderId));

      // 2. Look up the contract for referralCode
      const [contract] = await db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, orderId))
        .limit(1);

      // 3. Accrue rev-share if referralCode present
      if (contract?.referralCode) {
        const contractRevenue = contract.budgetCapUsd ?? contract.unitPriceUsd;
        await db.insert(schema.revShareLedger).values({
          contractId: orderId,
          referralCode: contract.referralCode,
          shareRate: "0.2500",
          contractRevenueUsd: String(contractRevenue),
          accruedUsd: String(parseFloat(String(contractRevenue)) * 0.25),
          status: "accruing",
        });
        console.log(
          `[SHIFTLEDGER_NOWPAYMENTS_IPN] rev_share_accrued contractId=${orderId} referral=${contract.referralCode}`,
        );
      }

      // 4. Enqueue first shift via the app server (internal API call)
      const appServerUrl = process.env.APP_SERVER_URL ?? "http://localhost:3001";
      try {
        const shiftResponse = await fetch(`${appServerUrl}/api/internal/shifts/enqueue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId: orderId }),
          signal: AbortSignal.timeout(10_000),
        });
        if (shiftResponse.ok) {
          console.log(`[SHIFTLEDGER_NOWPAYMENTS_IPN] shift_enqueued contractId=${orderId}`);
        } else {
          console.error(
            `[SHIFTLEDGER_NOWPAYMENTS_IPN] shift_enqueue_failed contractId=${orderId} status=${shiftResponse.status}`,
          );
        }
      } catch (shiftErr) {
        console.error(
          `[SHIFTLEDGER_NOWPAYMENTS_IPN] shift_enqueue_error contractId=${orderId}: ${(shiftErr as Error).message}`,
        );
      }

      // 5. Notion sync (async, best-effort)
      const notionToken = process.env.NOTION_TOKEN;
      if (notionToken) {
        try {
          await fetch(`${appServerUrl}/api/internal/notion/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contractId: orderId }),
            signal: AbortSignal.timeout(15_000),
          });
        } catch (notionErr) {
          console.error(
            `[SHIFTLEDGER_NOWPAYMENTS_IPN] notion_sync_error contractId=${orderId}: ${(notionErr as Error).message}`,
          );
        }
      }

      // 6. Send onboarding email (async, best-effort)
      try {
        await fetch(`${appServerUrl}/api/internal/onboarding/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId: orderId }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (emailErr) {
        console.error(
          `[SHIFTLEDGER_NOWPAYMENTS_IPN] onboarding_email_error contractId=${orderId}: ${(emailErr as Error).message}`,
        );
      }

      activated = true;
      console.log(
        `[SHIFTLEDGER_NOWPAYMENTS_IPN] contract_activated order_id=${orderId} payment=${paymentStatus}`,
      );
    } catch (err) {
      console.error(
        `[SHIFTLEDGER_NOWPAYMENTS_IPN] activation_error order_id=${orderId}: ${(err as Error).message}`,
      );
      // Don't fail the webhook response — NOWPayments will retry
    }
  }

  return NextResponse.json({
    ok: true,
    verified: true,
    paid,
    order_id: orderId,
    status: paymentStatus,
    activated,
  });
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return undefined;
}
