/**
 * [TALLY_NOWPAYMENTS_IPN] POST /api/webhooks/nowpayments
 *
 * NOWPayments delivers payment status updates here. The body is JSON; the
 * `x-nowpayments-sig` header carries the HMAC-SHA512 signature over the
 * alphabetically sorted JSON payload, signed with NOWPAYMENTS_IPN_SECRET.
 *
 * Behaviour:
 *   HTTP 503 if `NOWPAYMENTS_IPN_SECRET` is unset (operator gap, not auth).
 *   HTTP 401 if signature verification fails (no buyer-visible side effect).
 *   HTTP 400 if the body is not valid JSON.
 *   HTTP 200 + { ok, paid, order_id, status } on a verified payload.
 *
 * Wave 2 stub: order-state persistence is intentionally a journalctl log line
 * only. When apps/app/ ships next wave, this writes to the ledger DB.
 *
 * Never trust an unverified payload.
 */

import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { verifyNowpaymentsIpn } from "@/lib/nowpayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = optionalEnv("NOWPAYMENTS_IPN_SECRET");
  if (!secret) {
    return NextResponse.json(
      {
        error: "missing_env",
        missing: "NOWPAYMENTS_IPN_SECRET",
        message: "Webhook handler is not configured yet."
      },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_payload", message: "Body was not valid JSON." },
      { status: 400 }
    );
  }

  const signature = request.headers.get("x-nowpayments-sig");
  const verified = verifyNowpaymentsIpn(payload, signature, secret);
  if (!verified) {
    return NextResponse.json({ error: "signature_invalid" }, { status: 401 });
  }

  const status = stringValue(payload.payment_status) ?? "";
  const paid = ["finished", "confirmed"].includes(status.toLowerCase());
  const orderId =
    stringValue(payload.order_id) ?? stringValue(payload.payment_id) ?? "nowpayments_unknown";

  // Stub — when apps/app/ ships, this becomes a DB write that opens
  // (or refills) the buyer's pool and stamps the receipt.
  console.log(
    `[TALLY_NOWPAYMENTS_IPN] verified=true order_id=${orderId} status=${status} paid=${paid}`
  );

  return NextResponse.json({
    ok: true,
    verified: true,
    paid,
    order_id: orderId,
    status
  });
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return undefined;
}
