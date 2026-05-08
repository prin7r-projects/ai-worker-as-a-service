/**
 * [SHIFTLEDGER_NOWPAYMENTS] Server-side helpers for the NOWPayments hosted invoice.
 *
 * Shiftledger maps three landing tiers to deposits paid into a buyer's outcome pool:
 *  - "trial"      — $199, capped, 25 outcome receipts
 *  - "standard"   — $999/month, 200 receipts refillable
 *  - "enterprise" — $5,000 starting deposit, custom pool
 *
 * The HMAC-SHA512 IPN verifier mirrors the canonical pattern from
 * /Users/keer/projects/prin7r/payments-prototypes/src/lib/signatures.ts —
 * sort the JSON keys alphabetically, JSON.stringify, HMAC-SHA512 with the
 * IPN secret, hex-encode, timing-safe-compare to the `x-nowpayments-sig`
 * header. Never trust an unverified payload.
 */

import crypto from "node:crypto";
import { MissingEnvError, optionalEnv } from "@/lib/env";

export type PlanId = "trial" | "standard" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  depositUsd: number;
  description: string;
  pitch: string;
};

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Shiftledger — Trial pool deposit",
    depositUsd: 199,
    description:
      "Shiftledger Trial — $199 capped pool. Up to 25 outcome receipts in any one worker profile. One channel. No SLA. Refund of unused balance on cancellation, minus a 4% NOWPayments settlement fee.",
    pitch: "First shift on us, up to $199. One worker profile, one channel."
  },
  standard: {
    id: "standard",
    name: "Shiftledger — Standard pool deposit",
    depositUsd: 999,
    description:
      "Shiftledger Standard — $999 monthly pool. 200 cleared outcome receipts refillable. 1-2 channels per profile. 8-hour exception response. NOWPayments USDT/USDC settlement; refund at the contracted unit rate, minus 4% settlement fee.",
    pitch: "200 cleared receipts a month. Refillable. The default tier."
  },
  enterprise: {
    id: "enterprise",
    name: "Shiftledger — Enterprise pool deposit (starter $5,000)",
    depositUsd: 5000,
    description:
      "Shiftledger Enterprise starter deposit — $5,000. Multiple worker profiles concurrent, partner / white-label receipts available, dedicated CSM, named verification rules. Annual purchase orders welcome (custom pool sizing thereafter).",
    pitch: "Custom pool, multiple profiles, white-label, dedicated CSM."
  }
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

export type CreateInvoiceInput = {
  plan: Plan;
  baseUrl: string;
  orderId?: string;  // Phase 3: optional pre-determined order_id (contract ID)
};

export type NowpaymentsInvoice = {
  id: string;
  invoice_url: string;
  raw: Record<string, unknown>;
};

/**
 * POST /v1/invoice on api.nowpayments.io. Returns the invoice id + the
 * hosted-checkout URL to redirect the buyer to. Never logs the API key.
 */
export async function createNowpaymentsInvoice(input: CreateInvoiceInput): Promise<NowpaymentsInvoice> {
  const apiKey = optionalEnv("NOWPAYMENTS_API_KEY");
  if (!apiKey) throw new MissingEnvError("NOWPAYMENTS_API_KEY");

  const sandbox = (optionalEnv("NOWPAYMENTS_SANDBOX") ?? "false").toLowerCase() === "true";
  const apiBase = sandbox ? "https://api-sandbox.nowpayments.io" : "https://api.nowpayments.io";

  const orderId = input.orderId ?? `shiftledger_${input.plan.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    price_amount: input.plan.depositUsd,
    price_currency: "usd",
    order_id: orderId,
    order_description: input.plan.description,
    ipn_callback_url: `${input.baseUrl}/api/webhooks/nowpayments`,
    success_url: `${input.baseUrl}/?order=${orderId}&status=paid#hero`,
    cancel_url: `${input.baseUrl}/?order=${orderId}&status=cancelled#hero`,
    is_fee_paid_by_user: false,
    is_fixed_rate: false
  };

  const response = await fetch(`${apiBase}/v1/invoice`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const text = await response.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`NOWPayments returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const invoiceUrl = typeof parsed.invoice_url === "string" ? parsed.invoice_url : "";
  const invoiceId =
    typeof parsed.id === "string" || typeof parsed.id === "number" ? String(parsed.id) : orderId;

  if (!invoiceUrl) {
    throw new Error("NOWPayments response did not include invoice_url");
  }

  return {
    id: invoiceId,
    invoice_url: invoiceUrl,
    raw: parsed
  };
}

/* ------------------------------------------------------------------ */
/* HMAC-SHA512 IPN verification — copied from payments-prototypes.    */
/* See /Users/keer/projects/prin7r/payments-prototypes/src/lib/        */
/*     signatures.ts for the canonical implementation.                 */
/* ------------------------------------------------------------------ */

function timingSafeEqualHex(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function verifyNowpaymentsIpn(payload: unknown, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const sorted = JSON.stringify(sortObject(payload));
  const expected = crypto.createHmac("sha512", secret.trim()).update(sorted).digest("hex");
  return timingSafeEqualHex(expected, signature);
}
