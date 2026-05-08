import { WORKERS } from "@/lib/workers";

/**
 * [SHIFTLEDGER_WORKER_CATALOG] Six pre-trained worker profile cards arranged
 * in a zebra-striped grid (alternating paper / paper-2). Hover only
 * shifts border to audit; no transform, no shadow per DESIGN.md section 11.
 */
export function WorkerCatalog() {
  return (
    <section id="workers" className="border-y border-ink/15 bg-paper-2/40" aria-labelledby="workers-heading">
      <div className="container py-20">
        <div className="flex items-baseline justify-between flex-wrap gap-4 mb-12">
          <div>
            <p className="label-mono mb-3">Catalog / Six profiles, one unit price each</p>
            <h2 id="workers-heading" className="font-display text-h1 text-ink">
              Pre-trained worker profiles.
            </h2>
          </div>
          <p className="font-mono text-mono-xs text-ink-2 tracking-ledger uppercase">
            All units USD / cleared outcome
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-ink">
          {WORKERS.map((worker, i) => (
            <li
              key={worker.id}
              className={
                "p-7 border-ink border-b lg:border-r " +
                ((i + 1) % 3 === 0 ? "lg:border-r-0 " : "") +
                (i % 2 === 0 ? "bg-paper " : "bg-paper-2/70 ") +
                (i >= WORKERS.length - 1 ? "border-b-0 md:border-b-0 " : "") +
                (i === WORKERS.length - 2 ? "md:border-b-0 " : "")
              }
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-mono text-[11px] text-ink-2 tracking-ledger uppercase">
                  Worker / {String(i + 1).padStart(2, "0")}
                </p>
                <p className="font-mono tabular-nums text-2xl text-ink leading-none">
                  ${worker.unitPriceUsd}
                </p>
              </div>
              <h3 className="font-display text-h2 text-ink mt-3">{worker.name}</h3>
              <p className="font-mono text-[12px] text-ink-2 tracking-ledger uppercase mt-1">
                Unit: {worker.unit}
              </p>
              <p className="text-[16px] text-ink-2 mt-4 leading-snug">{worker.oneLiner}</p>

              <dl className="border-t border-ink/15 mt-6 pt-4 font-mono text-[12px] tabular-nums">
                <div className="flex justify-between py-1">
                  <dt className="text-ink-2 uppercase tracking-ledger">Verification</dt>
                  <dd className="text-ink text-right max-w-[55%]">{worker.verificationRule}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-ink-2 uppercase tracking-ledger">Sample line</dt>
                  <dd className="text-ink text-right max-w-[55%] truncate" title={worker.exampleOutcome}>
                    {worker.exampleOutcome}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
