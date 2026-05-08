import { Logo } from "./Logo";

/**
 * [SHIFTLEDGER_MASTHEAD] Top-of-page masthead. Logo + tagline + a single CTA-like
 * navigation link to the pricing tiers. Sits on a hairline-bottom border.
 * No sticky behavior per /DESIGN.md section 7.
 */
export function Masthead() {
  return (
    <header className="border-b border-ink/10">
      <div className="container flex items-center justify-between py-6">
        <a href="#hero" className="flex items-center gap-3" aria-label="Shiftledger home">
          <Logo />
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#workers"
            className="font-mono text-mono-xs uppercase tracking-ledger text-ink-2 hover:text-audit"
          >
            Workers
          </a>
          <a
            href="#verification"
            className="font-mono text-mono-xs uppercase tracking-ledger text-ink-2 hover:text-audit"
          >
            Verification
          </a>
          <a
            href="#tiers"
            className="font-mono text-mono-xs uppercase tracking-ledger text-ink-2 hover:text-audit"
          >
            Tiers
          </a>
          <a
            href="#tiers"
            className="border border-ink px-4 py-2 font-mono text-mono-xs uppercase tracking-ledger text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            Pay only when shipped
          </a>
        </div>
        <a
          href="#tiers"
          className="md:hidden border border-ink px-3 py-2 font-mono text-[11px] uppercase tracking-ledger text-ink"
        >
          Tiers
        </a>
      </div>
    </header>
  );
}
