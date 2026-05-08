import { Logo } from "./Logo";

/**
 * [SHIFTLEDGER_FOOTER] Three-column ledger foot. Wide bottom band on paper-2.
 * Final perforation rule above the copyright line.
 */
export function Footer() {
  return (
    <footer className="border-t border-ink bg-paper-2 mt-8">
      <div className="container py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <Logo className="h-12" />
            <p className="text-[15px] text-ink-2 max-w-md mt-5 leading-snug">
              Shiftledger is an outcome-billed AI worker service from{" "}
              <a href="https://www.notion.so/Prin7r-3543ceec261980bca5bed579315828fb" className="text-audit hover:underline">
                Prin7r
              </a>
              . Pre-trained worker profiles, unit-priced outcome contracts, per-shift receipts.
              You only pay when the shift ships.
            </p>
            <p className="font-mono text-[12px] text-ink-2 tracking-ledger uppercase mt-6">
              desk@ai-worker-as-a-service.prin7r.com
            </p>
          </div>

          <div className="md:col-span-3">
            <p className="label-mono mb-4">Shiftledger</p>
            <ul className="space-y-2 text-[14px] text-ink">
              <li><a href="#workers" className="hover:text-audit">Worker profiles</a></li>
              <li><a href="#verification" className="hover:text-audit">Verification</a></li>
              <li><a href="#tiers" className="hover:text-audit">Tier pricing</a></li>
              <li>
                <a href="https://github.com/prin7r-projects/ai-worker-as-a-service" className="hover:text-audit">
                  Source repo
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="label-mono mb-4">Documents</p>
            <ul className="space-y-2 text-[14px] text-ink">
              <li>
                <a href="https://github.com/prin7r-projects/ai-worker-as-a-service/blob/main/DESIGN.md" className="hover:text-audit">
                  DESIGN.md
                </a>
              </li>
              <li>
                <a href="https://github.com/prin7r-projects/ai-worker-as-a-service/blob/main/docs/02-architecture.md" className="hover:text-audit">
                  Architecture
                </a>
              </li>
              <li>
                <a href="https://github.com/prin7r-projects/ai-worker-as-a-service/blob/main/docs/07-sales-strategy.md" className="hover:text-audit">
                  Pricing & refunds
                </a>
              </li>
              <li>
                <a href="https://github.com/prin7r-projects/ai-worker-as-a-service/blob/main/docs/pitch-deck.html" className="hover:text-audit">
                  Pitch deck
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="label-mono mb-4">Receipt rails</p>
            <ul className="space-y-2 text-[14px] text-ink">
              <li>NOWPayments (live)</li>
              <li className="text-ink-2">Plisio (backup)</li>
              <li className="text-ink-2">Reown wallet (fallback)</li>
              <li className="text-ink-2">FastSpring fiat (2026 H2)</li>
            </ul>
          </div>
        </div>

        <hr className="perf my-10" aria-hidden="true" />

        <div className="flex flex-col md:flex-row justify-between gap-4 font-mono text-[11px] text-ink-2 tracking-ledger uppercase">
          <p>&copy; 2026 Prin7r / Shiftledger &middot; MIT licensed</p>
          <p>Wave 2 build / receipt printer 1.0</p>
          <p>Settled USDT / USDC &middot; USD-denominated invoices</p>
        </div>
      </div>
    </footer>
  );
}
