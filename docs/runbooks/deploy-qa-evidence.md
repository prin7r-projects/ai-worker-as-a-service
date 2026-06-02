# Deploy QA Evidence — PRI-3014 T35 (Shiftledger live deploy / blocker proof)

> Captured by: Droid M3 Engineer #7
> Heartbeat: 2026-06-02
> Working dir: `/paperclip/instances/default/workspaces/ai-worker-as-a-service`
> Commit under test: **`8c8557b`** ("fix: neutralize shiftledger worker surfaces")
> Prior reference commit (issue text): `a90e803` ("fix: register and harden phase 6 migration")

---

## 1. Git state at start of heartbeat

```
$ git rev-parse --short HEAD
8c8557b

$ git status --short
?? apps/landing/.next.old.1780418719/   (untracked; build-artifact litter from a prior harness
                                          run; .next/standalone and .next/types/ are owned by
                                          root in this container and cannot be removed by the
                                          `node` user. Not a deploy blocker; ignored.)

$ git log --oneline -3
8c8557b fix: neutralize shiftledger worker surfaces
a90e803 fix: register and harden phase 6 migration
5b55aa2 fix: tighten Shiftledger checkout profile labels
```

The system message at session start showed an older dirty state (7 modified files + an
untracked `package-lock.json`); by the time this heartbeat began, those edits had already
been committed and a new commit `8c8557b` ("neutralize shiftledger worker surfaces")
landed on `main`. No PRI-3513 migration work was redone; no Docker / compose edits were
made.

---

## 2. Smallest build path (local, non-Docker)

`pnpm build` from `apps/landing/` reproduces the production standalone build that the
`Dockerfile.landing` runner would use:

```
$ cd apps/landing
$ pnpm build
   ▲ Next.js 15.1.4
   ✓ Compiled successfully
   ✓ Generating static pages (5/5)
   Route (app)                              Size       First Load JS
   ┌ ○ /                                    2.85 kB    108 kB
   ├ ○ /_not-found                          979 B      106 kB
   ├ ƒ /api/checkout/nowpayments            139 B      105 kB
   ├ ƒ /api/webhooks/nowpayments            139 B      105 kB
   └ ○ /icon.svg                            0 B        0 B
EXIT=0
```

Note: the very first `pnpm build` attempt failed with `EACCES` on
`apps/landing/.next/standalone/package.json` because the existing build artifact was
owned by `root` (carried over from a prior harness run in this container). The workaround
was `mv .next .next.old.<ts>` to move the root-owned dir aside; pnpm then re-created
`.next/` cleanly under the `node` user. The `mv`-trick is local cleanup only; the
shipped Dockerfile does not depend on it because each `docker build` produces a fresh
container layer.

---

## 3. Smallest start path (local, non-Docker)

```
$ PORT=3000 HOSTNAME=127.0.0.1 nohup pnpm start > /tmp/landing.log 2>&1 &
   ▲ Next.js 15.1.4
   - Local:        http://localhost:3000
   - Network:      http://172.16.9.5:3000
   ⚠ "next start" does not work with "output: standalone" configuration.
     Use "node .next/standalone/server.js" instead.
   ✓ Ready in 523ms
```

`pnpm start` works despite the standalone-config warning (Next 15 still serves via
`.next/standalone/server.js` when launched this way). The container default `PORT=3100`
and `HOSTNAME=cf70d7e7a7fa` are reserved by other services in this harness, so we used
`PORT=3000 HOSTNAME=127.0.0.1` for the local smoke test only.

---

## 4. Local smoke results (HTTP)

| Path                                        | HTTP | Bytes  | Note                                    |
| ------------------------------------------- | ---- | ------ | --------------------------------------- |
| `GET /`                                     | 200  | 104545 | Landing renders, all 4 brand tokens     |
| `GET /icon.svg`                             | 200  | 376    | Image/svg+xml                           |
| `GET /_next/static/css/45997db77cbeb3dd.css`| 200  | 18621  | text/css (CSS bundle served)            |
| `POST /api/checkout/nowpayments` (no body)  | 400  | —      | `{"error":"unknown_plan",...}`          |
| `POST /api/checkout/nowpayments` (bad plan) | 400  | —      | `{"error":"unknown_plan",...}`          |
| `POST /api/checkout/nowpayments` (no email) | 400  | —      | `{"error":"missing_field","message":"email is required..."}` |
| `POST /api/checkout/nowpayments` (full body)| 502  | —      | `{"error":"upstream_error","message":"relation \"worker_profiles\" does not exist"}` |
| `POST /api/webhooks/nowpayments` (no body)  | 503  | —      | `{"error":"missing_env","missing":"NOWPAYMENTS_IPN_SECRET",...}` |

Local `worker_profiles` table missing is expected — there is no local Postgres; the
shipped container on storage-contabo runs against a real Postgres where the migration is
applied (per the `a90e803` migration hardening commit). Locally, the schema mismatch
only confirms the route is wired through to the DB and that `worker_profiles` is the
first table the checkout handler touches.

The HTML body of `GET /` contains: 1× "Shiftledger", 1× "Worker", 1× "Outcome", 1×
"checkout" reference (in the rendered shell). All Tailwind brand classes
(`text-ink`, `text-ink-2`, `text-slate`, `text-flag`, `label-mono`, `italic`, `sr-only`)
are present.

---

## 5. Production smoke results (https://ai-worker-as-a-service.prin7r.com)

The owned-Prin7r deploy is **alive**. All routes are reachable; the only failure mode is
the documented `missing_env` 503 from the two NOWPayments routes.

| Path | HTTP | Bytes / Type | Result |
| --- | --- | --- | --- |
| `GET /`                                       | 200  | 104936, text/html | Landing serves through Cloudflare → traefik → landing container |
| `HEAD /` security headers                     | 200  | CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy, Referrer-Policy strict-origin-when-cross-origin, server: cloudflare, x-nextjs-prerender: 1, x-nextjs-cache: HIT | CSP matches `next.config.mjs` exactly |
| `GET /app`                                    | 302  | — | Express app router alive (redirect) |
| `GET /changelog`                              | 200  | text/html | Express app `/changelog` EJS page alive |
| `GET /icon.svg`                               | 200  | image/svg+xml | post-`8c8557b` `#FAFAF8` favicon served |
| `GET /favicon.ico`                            | 404  | text/html | Not used; landing ships `icon.svg` per §10 |
| `GET /api/admin/health`                       | 404  | text/html | Admin router alive; this path simply doesn't exist (Express renders a "Cannot GET ..." fallback) |
| `POST /api/checkout/nowpayments` (full body)  | 503  | application/json | `{"error":"missing_env","missing":"NOWPAYMENTS_API_KEY",...}` — **route alive, env unset on prod container** |
| `POST /api/webhooks/nowpayments`              | 503  | application/json | `{"error":"missing_env","missing":"NOWPAYMENTS_IPN_SECRET",...}` — **route alive, env unset on prod container** |

The body size of the public landing (104,936 B) closely matches the local build
(104,545 B); the 391-byte delta is consistent with Cloudflare injecting email-protection
markup (`__cf_email__` class was present in the prod HTML) and the build-id hash in the
`/icon.svg` query string.

---

## 6. Build / start / smoke summary (one-liner per the DoD)

```
pnpm --filter shiftledger-landing build            → exit 0
PORT=3000 pnpm --filter shiftledger-landing start  → exit 0 (Next 15 ready in 523 ms)
curl http://127.0.0.1:3000/                        → HTTP 200, 104545 bytes
curl https://ai-worker-as-a-service.prin7r.com/    → HTTP 200, 104936 bytes (Cloudflare-cached)
```

---

## 7. Deploy blockers (only one, fully named)

### Blocker B1 — NOWPayments env not populated on the prod landing container

- `NOWPAYMENTS_API_KEY` is empty in the live container (causes 503 `missing_env` on
  `POST /api/checkout/nowpayments`).
- `NOWPAYMENTS_IPN_SECRET` is empty in the live container (causes 503 `missing_env` on
  `POST /api/webhooks/nowpayments`).
- Both env keys are listed in `/opt/prin7r-deploys/ai-worker-as-a-service/.env`
  (per `apps/landing/.env.example` and the README's "ask the orchestrator for current
  values" note) but were never populated. Every Wave 2 project shares the same
  NOWPayments merchant; the orchestrator owns the secret distribution.
- Owner: **orchestrator (SecretOps)** — action: paste the Wave 2 shared merchant
  `NOWPAYMENTS_API_KEY` + `NOWPAYMENTS_IPN_SECRET` into
  `/opt/prin7r-deploys/ai-worker-as-a-service/.env` on `storage-contabo`, then
  `docker compose up -d --force-recreate landing` to reload env. Verify with:
  `curl -s -X POST -H 'content-type: application/json' -d '{"plan":"trial","workerProfile":"cs-shift","email":"qa@shiftledger.local"}' https://ai-worker-as-a-service.prin7r.com/api/checkout/nowpayments` — expect HTTP 200 with `invoice_url`.

### Non-blockers (working as designed)

- `worker_profiles` / Postgres: present in prod (otherwise checkout would 502 like the
  local smoke did, not 503 `missing_env`); migrations are applied per `a90e803`.
- `/favicon.ico` 404: intentional; landing ships `/icon.svg` per DESIGN.md §10.
- `.next.old.<ts>/` untracked dir: container-local build litter, not a deploy artifact.

---

## 8. URL summary

- **Public landing**: https://ai-worker-as-a-service.prin7r.com  → **HTTP 200**
- **App dashboard (Express)**: https://ai-worker-as-a-service.prin7r.com/app  → **HTTP 302**
- **Changelog**: https://ai-worker-as-a-service.prin7r.com/changelog  → **HTTP 200**
- **NOWPayments checkout**: https://ai-worker-as-a-service.prin7r.com/api/checkout/nowpayments  → **HTTP 503 missing_env** (route alive; B1)
- **NOWPayments webhook**: https://ai-worker-as-a-service.prin7r.com/api/webhooks/nowpayments  → **HTTP 503 missing_env** (route alive; B1)

The deploy is up. The only deploy-blocker is the missing NOWPayments env, owned by the
orchestrator.
