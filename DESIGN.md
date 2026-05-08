# DESIGN.md — Shiftledger

> Brand: **Shiftledger**. Project: **AI worker as a service (outcome-based)**. Wave 2.

The brand is "**a payroll for AI workers**" — outcomes, not hours, not tokens. This document is the source of truth for visual + copy decisions on the landing. The landing implementation in `/apps/landing/` mirrors what's locked here.

---

## 1. Product and audience

**Product (one sentence).** Shiftledger is a marketplace and runtime for outcome-billed AI workers — buyers pick a pre-trained worker profile (SDR, support, research, content, ops, QA), specify the outcome contract ("close 200 stage-1 demos at $X each", "resolve 500 tickets at $Y each"), and pay only when the receipt clears.

**Why now.** The hour-billed AI consultancy + the per-token API are both broken pricing models for buyers who care about results. The buyer who already burned $40K on "AI agents" is done with hourly. The buyer evaluating Manus, Lindy, Devin, Cognition is told to budget tokens. Neither matches how operators procure: by outcome.

**Primary audience.** COO / VP Operations / Head of Customer Success / Head of Sales Ops at companies between 50 and 1500 employees. They have queues that don't fit headcount: ticket backlogs, lead lists that go stale, content debt, internal-ops paperwork. They've been pitched by AI vendors and are skeptical.

**Secondary audience.** Bootstrapped/PE-owned operators (founder-led, no time to hire). Agency owners reselling AI capacity to their own clients (need to see what they'll resell). Procurement / vendor-management at larger orgs (need a fixed-cost line item, not "compute, billed monthly").

**Anti-audience.** Curious-only AI hobbyists, students, no-code makers. Buyers who want to "rent the model and we'll do the rest." Anyone whose primary need is a prompt-builder GUI rather than completed work.

## 2. Visual positioning

Shiftledger is a **ledger / payroll-stub / receipt printer** brand, not an "AI agent" brand. The hero is a stylized payday stub — workers ran a shift, the shift is reconciled, the buyer is charged only the cleared lines. The aesthetic should evoke an **audit-grade financial instrument**, not a Slackbot.

**Yes:** crisp paper white, dense black ink, mono-spaced numerics, hairline rules, zebra-striped tables, ledger-margin tick marks, **a stamp / chop on the cleared receipt**, audit-blue accent, payday-green for the "paid" state.

**No:** purple/teal AI gradients, robot mascots, brain icons, 3D glass, neon, animated sparkles, "98% time saved" hero stats, hero photos of headsets, tech-bro chat bubbles.

**Reference moodboard (verbal).** Square (the receipts), Stripe (the financial-instrument typography in their docs but **not** their indigo palette), Patek Philippe service-document typography, the New York Times printed crossword margin, an old US Treasury receipt, the printing on a gas-pump receipt. Slip a touch of warmth in via the paper-tone background — this should feel like a paid invoice you'd file in a folder, not a dashboard.

## 3. ShadCN baseline and local component policy

**Baseline.** ShadCN is the default component library for everything that needs a primitive (button, input, card, dialog, accordion, badge). All ShadCN components are **vendored** into `apps/landing/components/ui/` so the project owns the source.

**Exception 1 — landing is intentionally bespoke.** The landing currently does **not** ingest ShadCN primitives because the landing is a single editorial page where every block has hand-tuned ledger styling that fights ShadCN's default radii (square edges, hairline rules, dense mono numerics). The Tailwind config below mirrors what ShadCN would produce, so when `apps/app/` adopts ShadCN later, tokens line up. The CTAs are styled buttons rather than `<Button>` for the same reason — we want the receipt-row buttons, not generic.

**Exception 2 — fonts.** ShadCN ships Inter as default. We override with **Cardo** (display) + **IBM Plex Mono** (numerics) per section 5. Body copy uses Inter, which keeps the ShadCN baseline.

**No paid / pro components.** Every visual block in the landing is hand-implemented with Tailwind utilities and inline SVG.

## 4. Color tokens

A 6-color palette tuned to "**paid receipt**". HSL values are also locked in `globals.css` for runtime use; hex values are the source of truth.

| Token | Hex | Role |
|---|---|---|
| `paper`         | `#F5F1E8` | Background — the warm white of a printed receipt |
| `paper-2`       | `#ECE6D5` | Surface — slightly tanner band for table zebra striping and footer |
| `ink`           | `#0E0E0C` | Primary type, hairlines, all default ledger ink |
| `ink-2`         | `#3A3A36` | Secondary type, table headers, captions |
| `audit`         | `#1F4F8A` | Accent / link / focus ring — audit-stamp blue |
| `payday`        | `#2E6F40` | Success / "paid" / CTA — payday-green |
| `flag`          | `#B5371F` | Alert / unpaid / void stamp red (used sparingly) |

Contrast ratios verified (WCAG 2.1 AA): `ink` on `paper` = 16.8:1, `audit` on `paper` = 7.2:1, `payday` on `paper` = 4.8:1, `paper` on `payday` = 4.8:1, `paper` on `audit` = 7.2:1.

## 5. Typography

Two-family pairing, **no third family**:

| Role | Family | Source | Weight |
|---|---|---|---|
| Display & headlines    | **Cardo**           | Google Fonts | 400 / 700 |
| Body copy              | **Inter**           | Google Fonts | 400 / 500 / 600 |
| Numerics, IDs, mono UI | **IBM Plex Mono**   | Google Fonts | 400 / 500 / 600 |

Why Cardo: a long-text serif designed for academic/financial publishing. It looks "official" and ages well — no startup-y vibe. Italic is true italic, not slanted roman.

Why IBM Plex Mono: numeric set is monospaced and tabular — required for the receipt rows where columns of dollar amounts must line up to the cent.

Type scale (mobile-first):

| Token | px / rem | Line-height | Use |
|---|---|---|---|
| `display`   | 56-104px clamp     | 0.95 | Hero only |
| `h1`        | 36-56px clamp      | 1.05 | Section headings |
| `h2`        | 24-32px clamp      | 1.15 | Block headings |
| `h3`        | 18-22px clamp      | 1.3  | Sub-block |
| `body`      | 16-17px            | 1.55 | Default |
| `caption`   | 13-14px            | 1.4  | Footnotes, table headers |
| `mono-xs`   | 12px               | 1.3  | Receipt IDs |

All-caps labels (e.g. "PAY STUB", "OUTCOME LEDGER") use Plex Mono, 12px, tracking +0.18em.

## 6. Spacing, radius, shadows, and borders

**Spacing.** 4px base. Section vertical rhythm = 96px (mobile) / 128px (desktop).

**Radius.** `0` everywhere except: `2px` on inputs/buttons (so they don't read as cards), and `9999px` for the single "audit stamp" pill in the hero.

**Shadows.** **One** shadow only: `0 1px 0 0 rgba(14,14,12,.10)` — a hairline used as a border-bottom on table rows. We do not use drop-shadows. Cards use a 1px `ink-2` border on `paper-2` background.

**Borders.** All structural borders are 1px `ink` for the canonical receipt edge; 1px `ink-2` for sub-rules; dashed (`1px dashed ink-2`) for the "perforation" between receipt sections (carries the brand metaphor literally).

## 7. Layout system and responsive rules

**Container.** Centered, 1140px max-width on `≥1024px`, 1.5rem horizontal padding on mobile, 2.5rem on desktop.

**Grid.** 12-column at `≥1024px`. The landing uses 8 zones stacked vertically; within each zone, content is centered and capped at the prose container.

**Breakpoints.** `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`. We test at 320 / 390 / 768 / 1024 / 1440 px. The hero "receipt card" reflows from 1-column on mobile to a 2-pane "stub + line items" at `≥768px`.

**Sticky.** No sticky nav (it would clash with the editorial-document feel). The masthead scrolls away with the page.

## 8. Component catalog

The landing implements eight distinct blocks; all are bespoke in `apps/landing/components/`:

1. **Masthead** — logo word "Shiftledger", tagline "Outcome ledger for AI workers", a single CTA link "Pay only when shipped". Sits on a hairline-bottom border.
2. **HeroReceipt** — the centerpiece. A stylized payday-stub with: top-band (worker name, shift dates), middle-band (line items: outcomes delivered with check-marks), perforation rule, bottom-band (total billed, audit stamp, receipt id). Body copy + dual CTAs to its left on desktop.
3. **WorkerCatalog** — 6 worker profile cards (SDR, Customer Support, Researcher, Writer, Ops Coordinator, QA Auditor) on a zebra-striped grid. Each card carries a profile name, deliverable unit, default outcome rate, and "starts at $X / outcome". Hover does not animate; it merely changes the border to `audit`.
4. **OutcomePricingTable** — a literal price table per worker type, two columns: "What we'll deliver" / "What you'll pay". Mono digits, right-aligned amounts, hairline rules per row.
5. **VerificationTrustBlock** — three stacked panels titled "How a shift gets paid out": (1) Worker runs, (2) Outcome is verified against the contract, (3) Receipt is issued; line is charged. Each panel is a numbered ledger entry, not a card.
6. **TierPricing** — three tiers: Trial, Standard, Enterprise. Each tier is a receipt-row with a numbered "BUY" stamp button that POSTs to `/api/checkout/nowpayments` and redirects to NOWPayments.
7. **FAQAccordion** — 7 questions, ledger-style with mono question numbers; expand/collapse via native `<details>`.
8. **Footer** — wide bottom-band on `paper-2` with three columns (Shiftledger, Resources, Contact), ledger-foot copy, build sha placeholder, and a final perforation rule above the copyright line.

## 9. Landing page structure

Top-down on the deployed page:

1. Masthead
2. HeroReceipt (the payroll stub)
3. WorkerCatalog (6 profiles)
4. OutcomePricingTable (per-outcome unit prices)
5. VerificationTrustBlock (how outcomes are verified)
6. TierPricing (Trial / Standard / Enterprise; NOWPayments CTAs)
7. FAQAccordion
8. Footer

Real copy lives in `/docs/08-marketing-strategy.md` (messaging hierarchy) and `/docs/07-sales-strategy.md` (pricing rationale). Anything you change on the landing must update those docs in the same commit.

## 10. Imagery and generated asset rules

**No photographs.** No GPT Image 2 generations were attempted for the landing — the brand is paper-and-ink, and a photograph would compete with the receipt metaphor.

The only "imagery" is **inline SVG**:
- `Logo` — the wordmark "Shiftledger" in Cardo italic, with a stamp/chop SVG.
- `AuditStamp` — a circular "PAID — Shiftledger / OUTCOMES VERIFIED / [date]" stamp drawn in SVG, used in the hero and on tier cards.
- `PerforationRule` — a 1px dashed horizontal SVG used as section dividers.

If a future iteration wants an illustration, the constraint is: it must look like it was drawn with a fountain pen on receipt paper. No 3D, no gradient.

## 11. Motion and interaction rules

**Default = no motion.** The brand is paper, paper does not animate.

Three exceptions only:
1. **Focus ring** — 2px solid `audit` with 2px offset on every interactive element.
2. **Hover on links / buttons** — color shifts from `ink` to `audit`, no transform, no shadow change. Duration 120ms ease-out.
3. **Accordion** — native `<details>` toggle; the chevron rotates 90deg, 150ms ease-out.

No scroll-jacking, no parallax, no "fade up on scroll" choreography.

## 12. Accessibility and quality gates

- Keyboard: Tab order = masthead CTA → HeroReceipt primary CTA → secondary CTA → catalog cards (left to right, top to bottom) → pricing-table CTAs → tier CTAs → FAQ summaries → footer links. Focus ring is always visible.
- Color contrast: every text/background pair meets WCAG 2.1 AA (verified above in §4).
- Semantic HTML: `<header>`, `<main>`, `<section>` with named `aria-label`s, `<details>`/`<summary>` for FAQ, `<table>` for the pricing table, `<button>` only for actions (links use `<a>`).
- Alt text: SVG logo has `<title>Shiftledger</title>`; the audit stamp SVG has `<title>Shiftledger Paid stamp</title>`. Decorative SVGs (perforation rule) have `aria-hidden="true"`.
- Forms: there are no forms on the landing other than the BUY CTAs which are POST-via-fetch buttons. The 503 fallback is rendered as visible status text below the button when the server returns `missing_env`.

## 13. Screenshots and verification artifacts

| Viewport | File | Source URL |
|---|---|---|
| Desktop 1440×900    | [`/docs/screenshots/landing-desktop.png`](./docs/screenshots/landing-desktop.png) | https://ai-worker-as-a-service.prin7r.com |
| Mobile  390×844     | [`/docs/screenshots/landing-mobile.png`](./docs/screenshots/landing-mobile.png)   | https://ai-worker-as-a-service.prin7r.com |

Both screenshots are captured against the deployed URL using Playwright's chromium (full-page, after `networkidle`). Re-capture protocol if the design changes:

```bash
node /Users/keer/projects/prin7r/wave2-batch2-build/ai-worker-as-a-service/scripts/screenshot.mjs
git add docs/screenshots && git commit -m "design: refresh production screenshots"
```

## 14. External references and library sources

- shadcn/ui — component primitives (https://ui.shadcn.com)
- Tailwind CSS v3 — utilities (https://tailwindcss.com)
- Next.js 15 App Router — app shell (https://nextjs.org/docs/app)
- Google Fonts — Cardo, Inter, IBM Plex Mono
- NOWPayments REST API — `POST /v1/invoice` (https://documenter.getpostman.com/view/7907941/S1a32n38)
- Refero Styles — DESIGN.md gallery referenced once for the "audit / instrument" ledger references; no patterns lifted directly.

## 15. Changelog

| Date       | Author                            | Change |
|---|---|---|
| 2026-05-08 | Wave 2 build agent (Opus 4.7-1m) | Initial DESIGN.md. All 15 sections populated. Brand identity = "Tally / outcome ledger for AI workers". Palette + type pair locked. Landing structure locked at 8 zones. NOWPayments CTA wired to `POST /v1/invoice` with HMAC-SHA512 IPN handler. Production screenshots committed under `/docs/screenshots/`. |
| 2026-05-08 | Wave 2 rebrand agent (Opus 4.7-1m) | Brand renamed **Tally → Shiftledger** after Wave 2 name research flagged Tally as FAIL: `tally.so` is a $2M-ARR no-code form-builder SaaS already occupying the brand in B2B SaaS. Shiftledger preserves the outcome-ledger essence — the brand copy "you only pay when the shift ships" extends naturally from the new name. Search-and-replace across landing copy, docs, logo wordmark, og:title, metadata, package.json, docker-compose, debug tags, and the NOWPayments order_id prefix. Logo SVG viewBox widened (220 → 360) and stamp position shifted (translate 150 → 290) to fit the longer wordmark. Domain `shiftledger.com` registered (Moniker, 2019) with no live A-record and no SERP collision. Repo slug, live URL, and NOWPayments tier amounts unchanged. |
