"use client";

import { useState, type FormEvent } from "react";

/**
 * [SHIFTLEDGER_TIER_PRICING] Three deposit tiers (Trial / Standard / Enterprise),
 * each one with a "BUY" CTA that POSTs to /api/checkout/nowpayments and
 * redirects to the returned NOWPayments hosted-invoice URL.
 *
 * A pre-checkout form collects email + worker profile above the tier grid.
 * The BUY button validates both fields before POSTing.  503 from the server
 * (missing env) is rendered as a brand-voice fallback message under the
 * clicked button instead of swallowing the error.
 */

const WORKER_PROFILES = [
  { id: "cs-shift", label: "CS Shift — Customer support ticket resolution" },
  { id: "sdr-shift", label: "SDR Shift — Lead qualification & outreach" },
  { id: "research-shift", label: "Research Shift — Market & competitive research" },
  { id: "content-shift", label: "Content Shift — Writing & editorial outcomes" },
] as const;

type PlanId = "trial" | "standard" | "enterprise";

type WorkerProfileId = "cs-shift" | "sdr-shift" | "research-shift" | "content-shift";

type Plan = {
  id: PlanId;
  name: string;
  deposit: number;
  cadence: string;
  pitch: string;
  bullets: string[];
  emphasis: boolean;
};

function isValidEmail(v: string): boolean {
  return v.length > 0 && v.includes("@");
}

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
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [errorBy, setErrorBy] = useState<Record<string, string | null>>({});

  // Pre-checkout form state
  const [email, setEmail] = useState("");
  const [workerProfile, setWorkerProfile] = useState<WorkerProfileId | "">("");
  const [orgName, setOrgName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    workerProfile?: string;
    general?: string;
  }>({});

  function clearFieldErrors() {
    setFieldErrors({});
  }

  /** Validate pre-checkout fields and return true if they pass. */
  function validateFields(): boolean {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!isValidEmail(email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!workerProfile) {
      errs.workerProfile = "Select a worker profile.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function buy(plan: PlanId) {
    setBusy(plan);
    setErrorBy((s) => ({ ...s, [plan]: null }));
    clearFieldErrors();

    if (!validateFields()) {
      setBusy(null);
      return;
    }

    try {
      const response = await fetch("/api/checkout/nowpayments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          email: email.trim(),
          workerProfile,
          orgName: orgName.trim() || undefined,
        }),
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
        "Shiftledger couldn't open the receipt printer. Try again, or email desk@ai-worker-as-a-service.prin7r.com.";
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

      {/* Pre-checkout fields — email + worker profile required before BUY */}
      <form
        className="border border-ink p-6 md:p-8 mb-8 max-w-3xl bg-paper"
        onSubmit={(e: FormEvent) => e.preventDefault()}
        noValidate
        aria-label="Checkout details"
      >
        <p className="font-mono text-mono-xs text-ink-2 tracking-ledger uppercase mb-5">
          Who&rsquo;s opening the pool?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Email */}
          <div>
            <label
              htmlFor="checkout-email"
              className="block font-mono text-mono-xs text-ink-2 tracking-ledger uppercase mb-1.5"
            >
              Email <span className="text-flag">*</span>
            </label>
            <input
              id="checkout-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((s) => ({ ...s, email: undefined }));
              }}
              placeholder="you@company.com"
              className={
                "w-full px-3.5 py-2.5 font-sans text-[15px] text-ink bg-paper " +
                "border border-ink-2 placeholder:text-slate " +
                "focus:outline-none focus:border-audit focus:ring-2 focus:ring-audit/20 " +
                (fieldErrors.email ? "border-flag" : "")
              }
              aria-invalid={fieldErrors.email ? "true" : undefined}
              aria-describedby={fieldErrors.email ? "checkout-email-err" : undefined}
            />
            {fieldErrors.email ? (
              <p
                id="checkout-email-err"
                role="alert"
                className="font-mono text-[12px] text-flag mt-1.5 leading-snug"
              >
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          {/* Worker profile */}
          <div>
            <label
              htmlFor="checkout-profile"
              className="block font-mono text-mono-xs text-ink-2 tracking-ledger uppercase mb-1.5"
            >
              Worker profile <span className="text-flag">*</span>
            </label>
            <select
              id="checkout-profile"
              value={workerProfile}
              onChange={(e) => {
                setWorkerProfile(e.target.value as WorkerProfileId);
                if (fieldErrors.workerProfile)
                  setFieldErrors((s) => ({ ...s, workerProfile: undefined }));
              }}
              className={
                "w-full px-3.5 py-2.5 font-sans text-[15px] text-ink bg-paper " +
                "border border-ink-2 focus:outline-none focus:border-audit focus:ring-2 focus:ring-audit/20 " +
                "appearance-none " +
                (fieldErrors.workerProfile ? "border-flag" : "")
              }
              aria-invalid={fieldErrors.workerProfile ? "true" : undefined}
              aria-describedby={
                fieldErrors.workerProfile ? "checkout-profile-err" : undefined
              }
            >
              <option value="" disabled>
                Select a profile&hellip;
              </option>
              {WORKER_PROFILES.map((wp) => (
                <option key={wp.id} value={wp.id}>
                  {wp.label}
                </option>
              ))}
            </select>
            {fieldErrors.workerProfile ? (
              <p
                id="checkout-profile-err"
                role="alert"
                className="font-mono text-[12px] text-flag mt-1.5 leading-snug"
              >
                {fieldErrors.workerProfile}
              </p>
            ) : null}
          </div>

          {/* Org name (optional) */}
          <div>
            <label
              htmlFor="checkout-org"
              className="block font-mono text-mono-xs text-ink-2 tracking-ledger uppercase mb-1.5"
            >
              Organization <span className="text-slate">(optional)</span>
            </label>
            <input
              id="checkout-org"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Inc."
              className={
                "w-full px-3.5 py-2.5 font-sans text-[15px] text-ink bg-paper " +
                "border border-ink-2 placeholder:text-slate " +
                "focus:outline-none focus:border-audit focus:ring-2 focus:ring-audit/20"
              }
            />
          </div>
        </div>
      </form>

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
