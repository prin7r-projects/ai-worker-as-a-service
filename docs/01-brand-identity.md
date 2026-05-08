# 01 — Brand identity: Tally

## Brand pyramid

- **Essence (1 word):** *Receipt.*
- **Personality (3 traits):** Auditable. Unhurried. Plainspoken.
- **Values (3):** (1) Outcomes are billable, hours are not. (2) The buyer's spend column is sacred. (3) An unverified outcome is not an outcome.
- **Attributes (5):** Ledger-grade. Mono-spaced. Plain English. Refundable. Numbered.

## Positioning statement

For COOs and operations leaders who have queues that don't fit headcount and who have already burned a budget on hour-billed AI vendors, **Tally** is the **outcome-billed AI worker service** that delivers contracted outcomes (tickets resolved, leads contacted, articles drafted) with a per-outcome receipt — unlike Manus, Lindy, Devin, or Cognition (who bill compute) and unlike traditional AI consultancies (who bill hours), because Tally is the only AI runtime that prices the way operators procure: by the cleared line item.

## Audience persona — primary

**"Maya, COO at a 240-person SaaS"**
- 41, ten years in ops, runs Customer Success + Sales Ops + Vendor Management.
- Goals: clear the ticket backlog without adding heads; get usable lead lists into reps' hands by Tuesday standup; make the AI line item legible to the CFO.
- Frustrations: vendors who bill in tokens she cannot forecast; vendors who bill in hours and underdeliver; "AI agents" that need 3 weeks of fine-tuning to do one thing.
- Channels: LinkedIn (skim daily), CFO/COO Slack groups, Operations Nation, in-person at SaaStr or HumanX, vendor newsletters in inbox 0/1.
- Buying behaviour: needs **a fixed price per cleared outcome** to defend the spend internally. Will pay a deposit; refuses retainers without a clear deliverable.

## Audience persona — secondary

**"Devon, founder/CEO at a 28-person bootstrapped agency"**
- 36, runs a digital agency that resells productized SaaS to its own clients.
- Goals: white-label outcome workers (SDR-as-a-shift, support-as-a-shift) into existing agency contracts.
- Frustrations: most "AI agent" platforms are seat-licensed, not outcome-priced; cannot mark up tokens to clients with a straight face.
- Channels: agency Slack networks, Indie Hackers, LinkedIn DMs, Bonjoro outreach.
- Buying behaviour: looks for **partner pricing** and white-label receipts.

## Voice & tone

**Do's**
1. Lead with the line item ("Resolved 423 tickets, charged $X").
2. Use ledger / payroll language ("shift", "receipt", "cleared", "void").
3. Be exact with money. Say "$X / outcome", not "low cost".

**Don'ts**
1. Don't say "agentic", "agent", "autonomous", "AI-powered", "AI-first".
2. Don't claim time-saved percentages; show outcomes.
3. Don't apologize. The buyer chose us because hours-billing failed them.

**Sample sentence.** "Last week your shift cleared 312 of 350 tickets. We charged $X. The 38 unfinished are voided on the receipt below."

## Visual system (summary; full spec in /DESIGN.md)

- Palette: `paper #F5F1E8` / `paper-2 #ECE6D5` / `ink #0E0E0C` / `ink-2 #3A3A36` / `audit #1F4F8A` / `payday #2E6F40` / `flag #B5371F`.
- Type pair: **Cardo** (display serif) + **Inter** (body) + **IBM Plex Mono** (numerics & ledger).
- Spacing: 4px base, 96/128px section rhythm.
- Radius: 0 / 2px on inputs only.
- Shadows: forbidden, except a 1px hairline used as a row underline.

## Logo concept

Wordmark "**Tally**" set in Cardo italic, lowercase, rendered black on paper, with a circular **audit-stamp** glyph to the right ("PAID — TALLY — OUTCOMES VERIFIED — [DATE]"). The stamp is a separate SVG so it can rotate slightly off-axis for receipts in the hero card without looking like a logo bug. No mascot, no abbreviation mark, no isotype.

```svg
<!-- inline reference, see /apps/landing/components/Logo.tsx -->
<svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg">
  <title>Tally</title>
  <text x="0" y="44" font-family="Cardo, Georgia, serif" font-style="italic" font-size="44" fill="#0E0E0C">tally</text>
  <g transform="translate(150 4) rotate(-7)">
    <circle cx="22" cy="22" r="22" fill="none" stroke="#1F4F8A" stroke-width="1.4"/>
    <circle cx="22" cy="22" r="17" fill="none" stroke="#1F4F8A" stroke-width="1"/>
    <text x="22" y="20" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="6" fill="#1F4F8A" letter-spacing=".2">PAID</text>
    <text x="22" y="28" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="4.5" fill="#1F4F8A">OUTCOMES</text>
    <text x="22" y="34" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="4.5" fill="#1F4F8A">VERIFIED</text>
  </g>
</svg>
```

## Forbidden in the brand

- Robot or brain icons of any kind.
- Purple/teal "AI gradient" backgrounds.
- The words "agent", "agentic", "automate", "automation", "automagic" in marketing copy.
- Headlines that promise time saved (`X% faster`).
- Any visual that competes with the receipt as the page's primary object.
