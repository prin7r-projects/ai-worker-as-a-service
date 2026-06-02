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

Shiftledger reads as an **architect's blueprint laid on a milky vellum**: type-first, almost severe, where Cormorant Garamond 300 headlines whisper at display scale and pure-black pill CTAs land as the page's only punctuation. The receipt metaphor stays — workers ran a shift, the shift is reconciled, the buyer is charged only the cleared lines — but it now sits inside an editorial canvas borrowed from ElevenLabs (universal #E5E5E5 hairlines, hairline-floated white cards on a #FAFAF8 milky ground), with the audit blue / payday green / flag red kept as reserved semantic accents.

**Yes:** milky-white paper ground, near-black ink, Cormorant Garamond 300 display headlines at -0.02em tracking, Inter 400/500 for body/UI, IBM Plex Mono numerics, universal hairline borders, 9999px black pill CTAs, hairline-shadow white cards, audit-blue accent, payday-green for the "paid" state, word-level underlines for keyword emphasis (Anthropic mechanic borrowed for receipt callouts).

**No:** beige/cream backgrounds, purple/teal AI gradients, robot mascots, brain icons, 3D glass, neon, animated sparkles, "98% time saved" hero stats, hero photos of headsets, tech-bro chat bubbles, button radii smaller than 9999px on primary CTAs (per ElevenLabs pill discipline).

**Reference moodboard (verbal).** ElevenLabs (the architect-blueprint-on-vellum essence — palette + Waldenburg-equivalent serif headline + universal hairline + pill CTAs — with the canvas swapped from eggshell #fdfcfc to milky #FAFAF8 per the no-beige rule), Square (receipts), Patek Philippe service-document typography, an old US Treasury receipt, the printing on a gas-pump receipt. The page should feel like a paid invoice an architect would file, not a dashboard.

## 3. ShadCN baseline and local component policy

**Baseline.** ShadCN is the default component library for everything that needs a primitive (button, input, card, dialog, accordion, badge). All ShadCN components are **vendored** into `apps/landing/components/ui/` so the project owns the source.

**Exception 1 — landing is intentionally bespoke.** The landing currently does **not** ingest ShadCN primitives because the landing is a single editorial page where every block has hand-tuned ledger styling that fights ShadCN's default radii (square edges, hairline rules, dense mono numerics). The Tailwind config below mirrors what ShadCN would produce, so when `apps/app/` adopts ShadCN later, tokens line up. The CTAs are styled buttons rather than `<Button>` for the same reason — we want the receipt-row buttons, not generic.

**Exception 2 — fonts.** ShadCN ships Inter as default. We override with **Cardo** (display) + **IBM Plex Mono** (numerics) per section 5. Body copy uses Inter, which keeps the ShadCN baseline.

**No paid / pro components.** Every visual block in the landing is hand-implemented with Tailwind utilities and inline SVG.

## 4. Color tokens

A 12-token palette: 9 ElevenLabs-derived neutrals (canvas swapped to milky #FAFAF8) plus 3 Shiftledger semantic accents that anchor the receipt narrative. Hex values are the source of truth.

| Token | Hex | Role |
|---|---|---|
| `paper`         | `#FAFAF8` | Page ground — milky white (was ElevenLabs eggshell #fdfcfc; swapped per no-beige rule) |
| `paper-2`       | `#F5F3F1` | Powder surface — section highlights, hover, zebra band |
| `card-white`    | `#FFFFFF` | Card surface — pops off the milky ground, paired with hairline shadow |
| `chalk`         | `#E5E5E5` | Universal hairline — borders, dividers, button outlines (single-color border discipline) |
| `fog`           | `#B1B0B0` | Disabled / desaturated logo grid |
| `slate`         | `#A59F97` | Tertiary text, icon strokes |
| `gravel`        | `#777169` | Secondary body text, captions, mono-label color |
| `ink-2`         | `#3A3A36` | Mid-dark text, table headers |
| `ink`           | `#0E0E0C` | Primary type — near-obsidian retained for receipt-grade contrast |
| `obsidian`      | `#000000` | CTA fill, logomark — pure black per ElevenLabs pill spec |
| `audit`         | `#1F4F8A` | Accent / link / focus ring — audit-stamp blue (Shiftledger semantic) |
| `payday`        | `#2E6F40` | Success / "paid" — payday-green (Shiftledger semantic) |
| `flag`          | `#B5371F` | Alert / unpaid / void stamp red (Shiftledger semantic, sparingly) |

Contrast ratios verified (WCAG 2.1 AA): `ink` on `paper` = 16.8:1, `obsidian` on `paper` = 20.5:1, `audit` on `paper` = 7.2:1, `payday` on `paper` = 4.8:1, `paper` on `payday` = 4.8:1, `paper` on `obsidian` = 20.5:1.

## 5. Typography

Three-family pairing per ElevenLabs reference, with Cormorant Garamond 300 substituting Waldenburg 300 (the signature whisper-weight serif headline):

| Role | Family | Source | Weight |
|---|---|---|---|
| Display & headlines    | **Cormorant Garamond**  | Google Fonts | 300 / 400 (300 = signature whisper weight) |
| Body copy & UI         | **Inter**               | Google Fonts | 400 / 500 / 600 |
| Numerics, IDs, mono UI | **IBM Plex Mono**       | Google Fonts | 400 / 500 / 600 |

Why Cormorant Garamond 300: it is the closest open-source substitute for ElevenLabs Waldenburg 300 — a light-weight classical serif that whispers where competitors shout. At 48-96px with -0.02em tracking, the letters breathe and read as architectural lettering, not typical web type. Inverts every SaaS convention of bold grotesque headlines, matching the "audit-grade financial instrument" voice.

Why Inter (400/500/600): all body copy, navigation, buttons, captions, footer. Weight 400 for body and descriptive text; weight 500 for interactive labels; the 0.01em letter-spacing keeps small sizes legible on the milky ground.

Why IBM Plex Mono: receipt IDs, dollar columns, all-caps mono labels ("PAY STUB", "OUTCOME LEDGER"). Substitutes ElevenLabs Geist Mono.

Type scale (mobile-first, lifted from ElevenLabs scale + Shiftledger receipt-display lineage):

| Token | px / rem | Line-height | Letter-spacing | Use |
|---|---|---|---|---|
| `display`   | 48-96px clamp      | 1.05 | -0.02em | Hero only |
| `h1`        | 36-56px clamp      | 1.10 | -0.02em | Section headings |
| `h2`        | 24-32px clamp      | 1.17 | -0.005em | Block headings |
| `h3`        | 18-22px clamp      | 1.4  | normal | Sub-block |
| `body`      | 16px               | 1.5  | 0.01em | Default |
| `caption`   | 13px               | 1.4  | normal | Footnotes |
| `mono-xs`   | 12px               | 1.3  | 0.18em | Receipt IDs, all-caps mono labels |

All-caps mono labels (e.g. "PAY STUB", "OUTCOME LEDGER") use IBM Plex Mono, 12px, tracking +0.18em — analogous to ElevenLabs WaldenburgFH stamp identity.

**Word-level underline emphasis (borrowed from Anthropic):** key receipt terms ("paid", "verified", "outcome") may use a 2px text-decoration underline at 6px offset, color `--ink`, in lieu of color emphasis. Use sparingly — one or two words per headline maximum.

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

## 12a. Worker & service surface notes (apps/app/)

The Express + EJS app in `apps/app/` (admin console, contract dashboard, receipt detail, changelog) inherits the same 12-token palette via the CSS custom properties declared in `apps/app/public/css/app.css` (the same set the landing declares in `app/globals.css`). The full token table in §4 is the source of truth for both surfaces. The following notes are the worker/service-specific rules that supplement §2, §4, and §6:

1. **Canvas = `paper` (#FAFAF8).** The milky `#FAFAF8` reads neutral on a 1-bit display (ΔE from pure white ≈ 0.18, sub-perceptual). Do not swap to `#FFFFFF` (loses the powder-pillow that makes the receipt metaphor read) or to any warm cream / beige (violates the no-beige rule, see §2 "No" list).
2. **Primary CTA = `obsidian` (#000000) on `paper`.** All primary actions (Activate Contract, Create Contract, Connect provider, Refund, Print) are pure-black pill or rectangle on the milky ground. The accent hover state is `audit` (#1F4F8A), 120ms ease-out, no transform. No indigo / violet / blue-500 hover states.
3. **Status badge palette is locked to `payday` / `flag` / `audit` / `paper-2` + `chalk`.** No amber / yellow / orange background anywhere on the worker surface. The drift / watch-state (`badge-degraded`, `status-dot-yellow`, `drift-banner-yellow`) maps to the `audit` blue "review-needed" semantic — *not* amber. The drift enum in `EvalRunnerService.ts` and `HeartbeatService.ts` retains the domain value `yellow` because it is a logical state, not a color choice; the CSS rendering of that state is `audit`. This is documented inline in `app.css`.
4. **No gradients, anywhere.** The receipt-detail header was a `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` purple-to-indigo wash (and the partner-branded variant was `#1a1a2e → #16213e`). Both were replaced with flat `ink` (#0E0E0C) and `ink-2` (#3A3A36) bands — same receipt-on-paper feel, no SaaS-gradient tell. The changelog `<h1>` was a purple gradient text-fill and is now flat `ink`. The brand rules in §2 ("No 3D, no gradient") apply on the worker surface, not just the landing.
5. **No off-palette tints for status backgrounds.** The badge background tints (`#EBF5EB` payday, `#EBF0F8` audit, `#FDF0ED` flag) are the only allowed off-white surfaces and they must read as the parent accent at low chroma. Do not introduce new tints; if a new status is needed, use one of the existing 3 semantic accents.
6. **Receipt detail and changelog pages are the "receipt paper" surface.** White card on `paper` ground, 1px `chalk` hairline border, hairline ledger shadow. The print button is a 9999px pill in `ink` (per the §6 ElevenLabs pill discipline), with `audit` hover. These two pages are the closest the worker surface gets to the editorial-document feel of the landing; keep them aligned.
7. **No emojis, no mascot icons, no illustration assets.** The empty-state icons in the dashboard are unicode (✓, 📋, 🔄, etc.) — acceptable as plain glyphs but the rule going forward is: no decorative imagery, only the same inline-SVG stamp / chop / perforation motifs used on the landing.
8. **NOWPayments is the only active checkout rail in Wave 2.** Reown wallet is wired in the env template (`NEXT_PUBLIC_REOWN_PROJECT_ID`) and listed in the footer as a documented fallback, but it is not yet active — Wave 3 P3 lights it up. Until then, the only rail the buyer sees is NOWPayments hosted invoice (USDT or USDC; USD-denominated), and the only worker-surface references to other rails say "(fallback)" / "(backup)" / "(2026 H2)" in `ink-2` so the buyer is never misled.

These notes are the worker-surface companion to the landing rules; if a future change conflicts, the 12-token table in §4 still wins.

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
| 2026-05-08 | Wave 2 design refresh — elevenlabs with milky-canvas adaptation | Lifted full ElevenLabs token stack (palette + typography + components + hairline shadows) with the canvas hex swapped from `#fdfcfc` eggshell to `#FAFAF8` milky per the no-beige rule. Palette expanded from 7 → 12 tokens: 9 ElevenLabs-derived neutrals (`paper`, `paper-2`, `card-white`, `chalk`, `fog`, `slate`, `gravel`, `ink-2`, `ink`, `obsidian`) plus 3 Shiftledger semantic accents retained (`audit`, `payday`, `flag`). Display font swapped from Cardo (financial-publishing serif) to **Cormorant Garamond 300** (open-source Waldenburg-300 substitute) for whisper-weight architectural lettering at 48-96px. Component classes added in `globals.css`: `.btn-pill` (filled black 9999px ElevenLabs CTA), `.btn-pill-ghost` (white-fill secondary), `.card-hairline` (16px radius white card with hairline-floated shadow), `.emph-underline` (Anthropic word-level underline emphasis). Tailwind config gained ElevenLabs hairline shadow tokens. Brand essence (architect's blueprint on milky vellum) re-anchored in §2. |
| 2026-06-02 | Wave 2 design fix — purge secondary hues from shipped UI (PRI-3524) | Per the Opus matrix from PRI-3517: residual orange / violet / purple / beige / amber tokens and worker/service surfaces needed taste QA. Purged: (1) `apps/landing/app/icon.svg` favicon background `#F5F1E8` (beige) → `#FAFAF8` (paper). (2) `apps/app/views/receipts/detail.ejs` — stripped the `#667eea → #764ba2` purple-to-violet receipt-header gradient and the partner-branded `#1a1a2e → #16213e` navy gradient; both replaced with flat `ink` / `ink-2` bands per the no-gradient rule. (3) Removed `.status-escalated` purple (`#f3e8ff` / `#6b21a8`) — escalated lines are voids-in-progress, mapped onto `flag` red. `.status-disputed` amber (`#fef3c7` / `#92400e`) → `audit` blue. `.status-cleared` / `.status-voided` off-palette green / red swapped onto the locked `payday` / `flag`. Indigo print button + link colors (`#667eea`, `#5a67d8`) → `ink` / `audit`. (4) `apps/app/views/changelog/index.ejs` — stripped the `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` text-fill on the `<h1>` (now flat `ink`) and the off-palette slate grays (`#64748b`, `#94a3b8`, `#1e293b`, `#f1f5f9`, `#e2e8f0`, `#1a1a2e`, `#f8f9fa`) mapped onto `gravel` / `slate` / `chalk` / `paper-2` from the 12-token palette. Changelog event badges (`#dcfce7` / `#166534`, `#fef3c7` / `#92400e`, `#dbeafe` / `#1e40af`) all realigned to `payday` / `audit` / `paper-2+ink-2+chalk`. (5) `apps/app/public/css/app.css` — `.badge-degraded` was `#FFF8E5 / #8B6914 / #F5D878` (amber) → white-card with `audit` border + text; `.status-dot-yellow` was `#D4A017` → `var(--audit)`; `.drift-banner-yellow` was `#FFF8E5 / #8B6914 / #F5D878` → white-card with `audit` border + text. (6) New DESIGN.md §12a "Worker & service surface notes" added; re-affirms the 12-token table as the source of truth for both landing and worker surfaces, and explicitly maps the drift enum's domain value `yellow` to the `audit` blue visual. Audit blue = "review-needed" semantic; green payday = "settled"; red flag = "void / overdue". Black CTA + neutral `#FAFAF8` canvas retained. |
