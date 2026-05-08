/**
 * [SHIFTLEDGER_VERIFICATION_TRUST] Three numbered ledger panels:
 *   1. Worker runs against the queue
 *   2. Outcome is verified against the contract
 *   3. Receipt is issued; the line is charged
 *
 * Numbered, hairline-bordered. No card shadows. The numbers themselves are
 * displayed in big mono digits to read like accounting entries.
 */
export function VerificationTrust() {
  return (
    <section
      id="verification"
      className="border-t border-ink/15 bg-paper-2/30"
      aria-labelledby="verification-heading"
    >
      <div className="container py-20">
        <div className="max-w-3xl mb-12">
          <p className="label-mono mb-3">Trust block / How outcomes are verified</p>
          <h2 id="verification-heading" className="font-display text-h1 text-ink">
            How a shift gets paid out.
          </h2>
          <p className="text-[17px] text-ink-2 mt-5 leading-snug max-w-2xl">
            No chain-of-thought theatre, no &ldquo;agent transcripts&rdquo; for proof. Every line
            on a Shiftledger receipt clears against a buyer-side rule. If the rule fails, the line voids
            on the receipt and never charges your pool.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 border border-ink divide-y md:divide-y-0 md:divide-x divide-ink/15">
          {STEPS.map((step) => (
            <li key={step.n} className="p-8 bg-paper relative">
              <p
                className="font-mono tabular-nums text-[64px] leading-none text-audit"
                aria-hidden="true"
              >
                {step.n}
              </p>
              <p className="label-mono mt-4">Step {step.n} of 03</p>
              <h3 className="font-display text-h2 text-ink mt-2 leading-tight">{step.title}</h3>
              <p className="text-[15px] text-ink-2 mt-4 leading-snug">{step.body}</p>
              <p className="font-mono text-[12px] text-ink uppercase tracking-ledger mt-5">
                {step.tag}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-10 max-w-3xl border-l-2 border-audit pl-6">
          <p className="font-mono text-[13px] text-ink-2 tracking-ledger uppercase">
            What we will <span className="text-flag">not</span> do
          </p>
          <ul className="mt-3 text-[15px] text-ink-2 space-y-2">
            <li>&mdash; auto-retry voided lines without your approval (no infinite token-burn loops)</li>
            <li>&mdash; charge for &ldquo;the worker tried&rdquo; or for any line you can&rsquo;t audit</li>
            <li>&mdash; fine-tune on your data; the runtime reads your source-of-truth at run time</li>
            <li>&mdash; settle anything other than cleared lines against your NOWPayments pool</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "The worker runs the queue.",
    body: "Each profile reads your source of truth at run time — your help-desk, your CRM, your doc store — over its API. We do not fine-tune on your data and we do not store it model-side.",
    tag: "Run / read at run time"
  },
  {
    n: "02",
    title: "Each line is verified.",
    body: "Every attempted outcome runs against a buyer-side rule (e.g. CS = customer-set resolution status; SDR = personalized message + reply or non-bounce). If the rule fails, the line voids; you do not pay for it.",
    tag: "Verify / buyer-side rule"
  },
  {
    n: "03",
    title: "The receipt is issued.",
    body: "End of shift, the receipt lists cleared and voided lines. Cleared lines draw against your NOWPayments pool. Settlement is USDT or USDC; the invoice is USD-denominated. Unused pool refunds on cancellation.",
    tag: "Receipt / pool draws down"
  }
];
