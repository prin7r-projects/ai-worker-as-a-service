import { AuditStamp } from "./AuditStamp";

/**
 * [SHIFTLEDGER_HERO_RECEIPT] The hero. Two-column at >=768px:
 *   Left  - editorial copy + dual CTAs ("Open a receipt" -> #tiers ; "How a shift gets paid out" -> #verification).
 *   Right - the receipt card. A literal payday-stub: top band (worker, dates),
 *           middle band (line items with check-marks and one void), perforation,
 *           bottom band (total, audit stamp, receipt id).
 * Mobile: receipt stacks under the copy.
 */
export function HeroReceipt() {
  return (
    <section id="hero" className="container py-16 md:py-24" aria-labelledby="hero-headline">
      <div className="grid gap-14 md:gap-12 md:grid-cols-12 items-start">
        {/* Editorial copy */}
        <div className="md:col-span-6 lg:col-span-7">
          <p className="label-mono mb-6">Outcome ledger / Pay only when shipped</p>
          <h1
            id="hero-headline"
            className="font-display text-display text-ink"
          >
            Pay only when the <span className="italic">shift</span> ships.
          </h1>
          <p className="mt-8 max-w-2xl text-[19px] leading-snug text-ink-2">
            Shiftledger is the first AI worker service priced like payroll. Pick a pre-trained worker —
            <span className="text-ink"> support, SDR, research, content, ops, or QA</span> — sign a
            unit-priced outcome contract, and pay only for the cleared lines on a per-shift receipt.
          </p>
          <p className="mt-4 max-w-2xl text-[17px] text-ink-2">
            <span className="font-mono text-[15px] text-ink">No retainer.</span>{" "}
            <span className="font-mono text-[15px] text-ink">No tokens.</span>{" "}
            <span className="font-mono text-[15px] text-ink">No seats.</span>{" "}
            The receipt is the contract.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#tiers"
              className="bg-ink text-paper px-7 py-4 font-mono text-mono-xs uppercase tracking-ledger hover:bg-audit transition-colors"
            >
              Open a receipt — $199 trial
            </a>
            <a
              href="#verification"
              className="border border-ink px-7 py-4 font-mono text-mono-xs uppercase tracking-ledger text-ink hover:text-audit hover:border-audit transition-colors"
            >
              How a shift gets paid out
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 max-w-xl border-t border-ink/15 pt-6">
            <div>
              <dt className="label-mono">Worker profiles</dt>
              <dd className="font-mono tabular-nums text-2xl text-ink mt-1">06</dd>
            </div>
            <div>
              <dt className="label-mono">Unit price floor</dt>
              <dd className="font-mono tabular-nums text-2xl text-ink mt-1">$5</dd>
            </div>
            <div>
              <dt className="label-mono">Pilot length</dt>
              <dd className="font-mono tabular-nums text-2xl text-ink mt-1">0d</dd>
            </div>
          </dl>
        </div>

        {/* Receipt card */}
        <div className="md:col-span-6 lg:col-span-5 relative">
          <div className="bg-paper-2 border border-ink relative overflow-hidden">
            {/* Top band */}
            <div className="border-b border-ink px-6 py-5 flex items-center justify-between">
              <div>
                <p className="label-mono">Shiftledger — pay stub</p>
                <p className="font-display italic text-2xl text-ink leading-tight mt-1">
                  Customer Support / wk 19
                </p>
              </div>
              <p className="font-mono text-[11px] text-ink-2 tracking-ledger uppercase text-right leading-tight">
                Receipt<br/>
                <span className="text-ink text-[13px] tracking-normal normal-case">
                  SHL-CS-2025-W19
                </span>
              </p>
            </div>

            {/* Header strip for line items */}
            <div className="px-6 pt-5 pb-2 flex items-center justify-between">
              <p className="label-mono">Shift dates</p>
              <p className="font-mono text-[13px] text-ink tabular-nums">
                2026-05-04 / 2026-05-08
              </p>
            </div>

            {/* Line items */}
            <ul className="px-6 pb-2 divide-y divide-ink/10 font-mono text-[14px]">
              {LINE_ITEMS.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between py-3"
                >
                  <span className="flex items-baseline gap-3">
                    <span
                      aria-hidden="true"
                      className={
                        line.status === "voided"
                          ? "text-flag font-semibold w-5"
                          : "text-payday font-semibold w-5"
                      }
                    >
                      {line.status === "voided" ? "x" : "+"}
                    </span>
                    <span className="text-ink">{line.title}</span>
                  </span>
                  <span
                    className={
                      line.status === "voided"
                        ? "text-flag tabular-nums line-through"
                        : "text-ink tabular-nums"
                    }
                  >
                    ${line.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Perforation */}
            <div className="px-6 py-2">
              <hr className="perf" aria-hidden="true" />
            </div>

            {/* Subtotals */}
            <div className="px-6 py-3 font-mono text-[13px] tabular-nums">
              <div className="flex justify-between text-ink-2 py-1">
                <span>Resolved tickets</span>
                <span>312 / 350</span>
              </div>
              <div className="flex justify-between text-ink-2 py-1">
                <span>Voided lines</span>
                <span className="text-flag">38</span>
              </div>
              <div className="flex justify-between text-ink-2 py-1">
                <span>Unit rate</span>
                <span>$6.00 / outcome</span>
              </div>
            </div>

            {/* Total band */}
            <div className="border-t-2 border-ink px-6 py-5 flex items-end justify-between">
              <div>
                <p className="label-mono">Total charged</p>
                <p className="font-mono tabular-nums text-3xl text-payday mt-1 font-semibold">
                  $1,872.00
                </p>
                <p className="font-mono text-[11px] text-ink-2 tracking-ledger uppercase mt-1">
                  Settled USDT-TRC20
                </p>
              </div>
              <AuditStamp size={92} className="-mr-2" />
            </div>
          </div>

          <p className="font-mono text-[11px] text-ink-2 mt-4 tracking-ledger uppercase">
            Hero receipt is representative; live shift receipts ship with apps/app/.
          </p>
        </div>
      </div>
    </section>
  );
}

const LINE_ITEMS = [
  { id: 1, title: "Resolved ticket #84621 (refund)", amount: 6, status: "cleared" as const },
  { id: 2, title: "Resolved ticket #84622 (login)", amount: 6, status: "cleared" as const },
  { id: 3, title: "Resolved ticket #84623 (billing)", amount: 6, status: "cleared" as const },
  { id: 4, title: "Resolved ticket #84624 (export)", amount: 6, status: "cleared" as const },
  { id: 5, title: "Ticket #84625 — verification failed", amount: 6, status: "voided" as const },
  { id: 6, title: "Resolved ticket #84626 (sso)", amount: 6, status: "cleared" as const }
];
