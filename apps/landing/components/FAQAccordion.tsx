/**
 * [SHIFTLEDGER_FAQ] Native <details>/<summary> accordion. Numbered ledger entries.
 * No JS — uses the browser's native open/close. The chevron rotates 90deg
 * via CSS when [open] is set. See DESIGN.md section 11.
 */
export function FAQAccordion() {
  return (
    <section className="border-y border-ink/15 bg-paper-2/30" aria-labelledby="faq-heading">
      <div className="container py-20">
        <div className="max-w-3xl mb-10">
          <p className="label-mono mb-3">FAQ / Plain-spoken answers</p>
          <h2 id="faq-heading" className="font-display text-h1 text-ink">
            What buyers ask before opening a pool.
          </h2>
        </div>

        <ol className="border border-ink bg-paper">
          {FAQ_ITEMS.map((item, i) => (
            <li key={item.q} className={i > 0 ? "border-t border-ink/15" : ""}>
              <details className="group">
                <summary
                  className="cursor-pointer list-none flex items-center justify-between gap-4 py-5 px-6 hover:bg-paper-2/60"
                  aria-label={item.q}
                >
                  <span className="flex items-baseline gap-5">
                    <span className="font-mono tabular-nums text-[13px] text-audit tracking-ledger">
                      Q{String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[20px] text-ink leading-snug">
                      {item.q}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-ink-2 transition-transform duration-150 group-open:rotate-90 select-none"
                  >
                    {">"}
                  </span>
                </summary>
                <div className="px-6 pb-6 pl-[64px] text-[15px] text-ink-2 leading-snug max-w-3xl">
                  {item.a.map((p, idx) => (
                    <p key={idx} className={idx > 0 ? "mt-3" : ""}>{p}</p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "Is this an AI agent?",
    a: [
      "It's an AI worker. The difference is what you're billed for: agents bill compute, hours, or seats; Shiftledger bills cleared lines.",
      "Buyers who have already burned a budget on per-token agents tell us this distinction is the whole point — they want a unit price they can defend internally."
    ]
  },
  {
    q: "What if a line fails verification?",
    a: [
      "It voids on the receipt. You don't pay for it. Shiftledger does not auto-retry voided lines without your approval — the infinite-retry loop is one of the failure modes per-token billing rewards, and we don't replicate it.",
      "You see the void on the receipt with the failed rule attached, so an exception triage takes minutes, not days."
    ]
  },
  {
    q: "Can I cancel?",
    a: [
      "Yes, any time. Unused balance in the pool refunds at the contracted unit rate, minus a 4% NOWPayments settlement fee. There is no minimum term and no auto-renew clause."
    ]
  },
  {
    q: "Why crypto checkout?",
    a: [
      "NOWPayments issues a USD-denominated invoice; settlement is USDT or USDC. The receipt is the audit artifact, not the rail.",
      "Fiat invoicing (Stripe / FastSpring as merchant of record) ships in 2026 H2 once KYC and tax flows are complete. Until then, stablecoin or no contract — and we'll tell procurement upfront."
    ]
  },
  {
    q: "Do you fine-tune on our data?",
    a: [
      "No. Each worker reads your source of truth at run time — your help-desk, your CRM, your doc store — over its API, and persists nothing model-side. There is no data gravity lock-in; switching to a competitor that supports the same outcome contract is a cancellation away.",
      "Architecture diagram is in /docs/02-architecture.md."
    ]
  },
  {
    q: "What about SOC 2 / HIPAA / EU residency?",
    a: [
      "Wave 2 does not have those certifications. We will tell you so on the first call. The Enterprise track gets a written sub-processor list and a one-call security review against the data flow diagram in /docs/02-architecture.md.",
      "Formal certifications ship in 2026 H2."
    ]
  },
  {
    q: "Can my agency white-label receipts?",
    a: [
      "Yes — Enterprise / partner program. The receipt PDF carries your agency logo instead of Shiftledger's, and we'll give you a partner unit rate to mark up.",
      "Reply to desk@ai-worker-as-a-service.prin7r.com with 'partner' and we'll send the agreement template."
    ]
  }
];
