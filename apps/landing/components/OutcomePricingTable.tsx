import { WORKERS } from "@/lib/workers";

/**
 * [TALLY_PRICING_TABLE] Literal price table per worker profile.
 * Two columns: "What we'll deliver" (the unit) / "What you'll pay" (per-cleared-outcome USD).
 * Hairline rules per row, mono numerics, right-aligned amounts.
 */
export function OutcomePricingTable() {
  return (
    <section className="container py-20" aria-labelledby="outcome-pricing-heading">
      <div className="max-w-3xl mb-10">
        <p className="label-mono mb-3">Outcome pricing / All units USD</p>
        <h2 id="outcome-pricing-heading" className="font-display text-h1 text-ink">
          What you pay per cleared line.
        </h2>
        <p className="text-[17px] text-ink-2 mt-5 leading-snug">
          Each worker has one unit price. You don&rsquo;t pay for the worker&rsquo;s thinking,
          the tokens, the runtime, or the failed attempts. You pay for cleared lines, voided
          lines refund automatically, and the receipt below is what your finance team files.
        </p>
      </div>

      <div className="border border-ink overflow-hidden">
        <table className="w-full text-left font-mono">
          <caption className="sr-only">Tally per-outcome unit prices by worker profile.</caption>
          <thead>
            <tr className="bg-ink text-paper">
              <th scope="col" className="py-4 px-5 label-mono text-paper/80 font-medium text-left w-[28%]">
                Worker
              </th>
              <th scope="col" className="py-4 px-5 label-mono text-paper/80 font-medium text-left">
                What we&rsquo;ll deliver
              </th>
              <th scope="col" className="py-4 px-5 label-mono text-paper/80 font-medium text-left hidden md:table-cell">
                Verification rule
              </th>
              <th scope="col" className="py-4 px-5 label-mono text-paper/80 font-medium text-right w-[18%]">
                Per outcome
              </th>
            </tr>
          </thead>
          <tbody>
            {WORKERS.map((w, i) => (
              <tr
                key={w.id}
                className={
                  (i % 2 === 0 ? "bg-paper " : "bg-paper-2/60 ") +
                  "border-t border-ink/10"
                }
              >
                <td className="py-4 px-5 align-top">
                  <p className="font-display italic text-[18px] text-ink leading-tight">{w.name}</p>
                  <p className="text-[11px] text-ink-2 tracking-ledger uppercase mt-1">
                    Profile #{String(i + 1).padStart(2, "0")}
                  </p>
                </td>
                <td className="py-4 px-5 align-top text-[14px] text-ink-2 leading-snug">
                  {w.unit}
                </td>
                <td className="py-4 px-5 align-top text-[13px] text-ink-2 hidden md:table-cell">
                  {w.verificationRule}
                </td>
                <td className="py-4 px-5 align-top text-right">
                  <span className="tabular-nums text-2xl text-ink font-medium">
                    ${w.unitPriceUsd}
                  </span>
                  <span className="block text-[11px] text-ink-2 tracking-ledger uppercase mt-1">
                    / cleared
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[12px] text-ink-2 mt-5 tracking-ledger uppercase max-w-3xl">
        Voided lines do not draw against your pool. Refund of unused balance on cancellation, at the
        contracted unit rate, minus a 4% NOWPayments settlement fee. Full policy in{" "}
        <a href="https://github.com/prin7r-projects/ai-worker-as-a-service/blob/main/docs/07-sales-strategy.md" className="text-audit hover:underline">
          docs/07-sales-strategy.md
        </a>.
      </p>
    </section>
  );
}
