"use client";

import { useState } from "react";

/**
 * [TALLY_TIER_PRICING] Three deposit tiers (Trial / Standard / Enterprise),
 * each one with a "BUY" CTA that POSTs to /api/checkout/nowpayments and
 * redirects to the returned NOWPayments hosted-invoice URL.
 *
 * 503 from the server (missing env) is rendered as a brand-voice fallback
 * message under the clicked button instead of swallowing the error.
 */

type Plan = {
  id: "trial" | "standard" | "enterprise";
  name: string;
  deposit: number;
  cadence: string;
  pitch: string;
  bullets: string[];
  emphasis: boolean;
};

const PLANS: Plan[] = [
  {
    id: "trial",
    name: "Trial",
    deposit: 199,
    cadence: "capped, one-time",
    pitch: "First shift on us, up to $199.",
    bullets: [
      "Up to 25 outcome receipts",
      "One worker profile, one channel",
      "Refund of unused balance on cancel",
      "No SLA"
    ],
    emphasis: false
  },
  {
    id: "standard",
    name: "Standard",
    deposit: 999,
    cadence: "monthly pool, refillable",
    pitch: "200 cleared receipts a month. Refillable.",
    bullets: [
      "200 cleared outcome receipts / month",
      "1-2 channels per profile",
      "8-hour exception response",
      "All six worker profiles available"
    ],
    emphasis: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    deposit: 5000,
    cadence: "custom pool, starter deposit",
    pitch: "Custom pool. Multiple profiles. White-label.",
    bullets: [
      "Multiple profiles concurrent",
      "White-label receipts (PDF carries your logo)",
      "Dedicated CSM and named verification rules",
      "Annual purchase orders welcome"
    ],
    emphasis: false
  }
];

export function TierPricing() {
  const [busy, setBusy] = useState<string | null>(null);
  const [errorBy, setErrorBy] = useState<Record<string, string | null>>({});

  async function buy(plan: Plan["id"]) {
    setBusy(plan);
    setErrorBy((s) => ({ ...s, [plan]: null }));
    try {
      const response = await fetch("/api/checkout/nowpayments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan })
      });
      const data = (await response.json()) as {
        invoice_url?: string;
        error?: string;
        message?: string;
      };
      if (response.ok && data.invoice_url) {
        window.location.href = data.invoice_url;
        return;
      }
      const fallback =
        data.message ??
        "Tally couldn't open the receipt printer. Try again, or email desk@ai-worker-as-a-service.prin7r.com.";
      setErrorBy((s) => ({ ...s, [plan]: fallback }));
    } catch {
      setErrorBy((s) => ({
        ...s,
        [plan]:
          "Network error reaching the receipt printer. Check your connection or email desk@ai-worker-as-a-service.prin7r.com."
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="tiers" className="container py-20" aria-labelledby="tiers-heading">
      <div className="max-w-3xl mb-12">
        <p className="label-mono mb-3">Tiers / Deposit-into-pool</p>
        <h2 id="tiers-heading" className="font-display text-h1 text-ink">
          Three ways to open a pool.
        </h2>
        <p className="text-[17px] text-ink-2 mt-5 leading-snug max-w-2xl">
          Every tier deposits into a pool. Cleared lines draw down the pool, voided lines do not.
          Settlement is NOWPayments USDT/USDC; invoices are USD-denominated.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 border border-ink">
        {PLANS.map((plan, i) => (
          <article
            key={plan.id}
            className={
              (plan.emphasis ? "bg-paper-2 " : "bg-paper ") +
              "p-8 border-ink " +
              (i < PLANS.length - 1 ? "md:border-r " : "") +
              (i < PLANS.length - 1 ? "border-b md:border-b-0 " : "") +
              "flex flex-col"
            }
            aria-labelledby={`tier-${plan.id}-name`}
          >
            <div className="flex items-baseline justify-between mb-4">
              <p className="label-mono">Tier {String(i + 1).padStart(2, "0")} / 03</p>
              {plan.emphasis ? (
                <p className="font-mono text-[11px] tracking-ledger uppercase text-audit">
                  Recommended
                </p>
              ) : null}
            </div>
            <h3 id={`tier-${plan.id}-name`} className="font-display italic text-[40px] leading-none text-ink">
              {plan.name}
            </h3>
            <p className="font-mono text-[12px] text-ink-2 tracking-ledger uppercase mt-2">
              {plan.cadence}
            </p>

            <p className="font-mono tabular-nums text-[56px] leading-none text-ink mt-6">
              ${plan.deposit.toLocaleString()}
            </p>
            <p className="text-[14px] text-ink-2 mt-2">{plan.pitch}</p>

            <ul className="mt-6 space-y-2.5 text-[14px] text-ink-2 border-t border-ink/15 pt-5">
              {plan.bullets.map((b) => (
                <li key={b} className="flex gap-3 items-start">
                  <span aria-hidden="true" className="text-payday font-mono">+</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex-1 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => buy(plan.id)}
                disabled={busy === plan.id}
                className={
                  (plan.emphasis
                    ? "bg-payday text-paper hover:bg-ink "
                    : "bg-ink text-paper hover:bg-audit ") +
                  "w-full px-5 py-4 font-mono text-mono-xs tracking-ledger uppercase transition-colors disabled:opacity-60 disabled:cursor-wait"
                }
              >
                {busy === plan.id
                  ? "Opening receipt..."
                  : `Buy ${plan.name} — $${plan.deposit.toLocaleString()}`}
              </button>
              <p className="font-mono text-[11px] text-ink-2 tracking-ledger uppercase mt-3">
                NOWPayments hosted invoice / USDT or USDC
              </p>
              {errorBy[plan.id] ? (
                <p
                  role="alert"
                  className="font-mono text-[12px] text-flag mt-3 leading-snug"
                >
                  {errorBy[plan.id]}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
