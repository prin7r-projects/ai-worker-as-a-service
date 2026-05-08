/**
 * [SHIFTLEDGER_NOWPAYMENTS_CHECKOUT] POST /api/checkout/nowpayments
 *
 * Body:    { plan: "trial" | "standard" | "enterprise" }
 * Returns: { invoice_url, invoice_id, plan, deposit_usd, mode: "live" } on success.
 *
 * Errors:
 *   HTTP 400  for unknown plan ids
 *   HTTP 503  for missing env (so operators see the gap without leaking secrets)
 *   HTTP 502  for upstream NOWPayments failures (provider error message bubbled)
 *
 * The buyer is redirected client-side to `invoice_url`. NOWPayments handles
 * USDT/USDC checkout and (when fiat partner routing is enabled on the
 * NOWPayments account) the card on-ramp. Never logs the API key.
 */

import { NextResponse } from "next/server";
import { MissingEnvError, appUrlFromRequest } from "@/lib/env";
import { PLANS, createNowpaymentsInvoice, isPlanId } from "@/lib/nowpayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = { plan?: string };

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
        message: `Unknown plan: ${String(planId)}. Allowed: ${Object.keys(PLANS).join(", ")}.`
      },
      { status: 400 }
    );
  }
  const plan = PLANS[planId];
  const baseUrl = appUrlFromRequest(request);

  try {
    const invoice = await createNowpaymentsInvoice({ plan, baseUrl });
    return NextResponse.json({
      mode: "live",
      plan: plan.id,
      deposit_usd: plan.depositUsd,
      invoice_id: invoice.id,
      invoice_url: invoice.invoice_url
    });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      // Brand-voice 503. Tells the operator which env var is missing, but
      // never leaks the key itself. The buyer-visible message reads as a
      // Shiftledger receipt-printer apology, not a generic backend error.
      return NextResponse.json(
        {
          error: "missing_env",
          missing: error.envName,
          message:
            "The receipt printer is offline. Shiftledger's NOWPayments lane is not wired up on this deployment yet — the buyer's pool can't be opened until the operator finishes the env setup. Email desk@ai-worker-as-a-service.prin7r.com and we'll hand-issue the deposit receipt within one business day."
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: "upstream_error", message }, { status: 502 });
  }
}
