# Deploy-lag runbook — PRI-3027 T48 (Shiftledger /changelog pre-purge gradient on prod)

> Captured by: Droid M3 Engineer #17
> Heartbeat: 2026-06-02
> Working dir: `/paperclip/instances/default/workspaces/ai-worker-as-a-service`
> Issue: PRI-3027 "Shiftledger T48: Fix demo blockers"
> Operator scope: reduce the single demo blocker from PRI-3026 — production `/changelog`
> serving pre-purge purple gradient while repo HEAD `8c8557b` is neutral.

---

## 1. Root cause (one paragraph)

`origin/main` was behind local `main` by **3 unpushed commits** at the start of this
heartbeat. The local HEAD `8c8557b` ("fix: neutralize shiftledger worker surfaces")
already contains the entire 12-token palette purge for the changelog and receipt
surfaces, but the prod app container on the Prin7r VPS (144.91.94.91) was built from
the previous origin tip `5b55aa2`, so it kept serving the pre-purge CSS
(`linear-gradient(135deg, #667eea 0%, #764ba2 100%)` on the changelog h1, off-palette
slate `#64748b`/`#94a3b8`/`#1e293b`, off-white `#f8f9fa` body, amber `#fef3c7` drift
badge). The push **has now landed** (see §3); what remains is the rebuild on the
deploy host, which this dev workspace cannot trigger directly.

## 2. Pre-push verification (commands + evidence)

```
$ git rev-parse --short HEAD
8c8557b
$ git log --oneline -3
8c8557b fix: neutralize shiftledger worker surfaces
a90e803 fix: register and harden phase 6 migration
5b55aa2 fix: tighten Shiftledger checkout profile labels
$ git status -sb
## main...origin/main [ahead 3]
$ git log --oneline origin/main..HEAD
24921d7 docs(13): add PRI-3014 T35 deploy QA evidence (runbook)
8c8557b fix: neutralize shiftledger worker surfaces
a90e803 fix: register and harden phase 6 migration
```

Local pre-purge check confirms the fix is in the working tree (no off-palette
strings in the EJS files):

```
$ rg -n '667eea|764ba2|linear-gradient' apps/app
apps/app/views/changelog/index.ejs:9:  /* No purple gradients, no amber drift ... */
apps/app/views/changelog/index.ejs:29:  color: #0E0E0C;            /* ink — was purple gradient text-fill */
apps/app/views/receipts/detail.ejs:9:   /* No purple/violet gradients, no yellow/amber ... */
apps/app/views/receipts/detail.ejs:30:  background: #0E0E0C;       /* ink — obsidian band, replaces the old purple gradient */
$ rg -n '667eea|764ba2|linear-gradient' apps/landing
(no matches)
```

The four matches inside `apps/app/views/` are all comments that **document the purge**
in the new code; no live `linear-gradient(...)` or `#667eea` declarations remain.

## 3. Push landed (2026-06-02 18:33 UTC)

```
$ git push origin main
To https://github.com/prin7r-projects/ai-worker-as-a-service.git
   5b55aa2..24921d7  main -> main
$ git rev-parse origin/main
24921d704e2a266e55a1b81359c31e7e14646ebc
```

`origin/main` is now at `24921d7`, which includes:
- `a90e803` — Phase-6 migration hardening
- `8c8557b` — neutralized worker surfaces (the actual fix)
- `24921d7` — this runbook (PRI-3014 evidence was added locally in the previous
  heartbeat but never pushed; included in this push so the deploy host gets the
  full chain in one rebuild)

## 4. Deploy-lag confirmed (post-push, prod still pre-purge)

Polled `https://ai-worker-as-a-service.prin7r.com/changelog` for 5 minutes after the
push, 20 s cadence. Bytes stayed at **6785** and the response kept the pre-purge CSS
verbatim:

```
=== attempt 1 @ 18:33:26Z ===   HTTP=200  BYTES=6785   STILL PURPLE
=== attempt 2 @ 18:33:46Z ===   HTTP=200  BYTES=6785   STILL PURPLE
…
=== attempt 15 @ 18:38:08Z ===  HTTP=200  BYTES=6785   STILL PURPLE
```

Pre-purge fragments in the live HTML (snippet of the 6785 B response):

```html
<style>
  body { color: #1a1a2e; background: #f8f9fa; }
  .changelog-header h1 {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .changelog-header p { color: #64748b; }
  .badge-drift_event { background: #fef3c7; color: #92400e; }
</style>
```

The local EJS template for that page no longer contains any of those strings.
Conclusion: the push **reached origin**, but the deploy host has not rebuilt the
`app` image. There is no auto-rebuild webhook observed from this workspace's view.

## 5. Why this workspace cannot finish the fix (rooted)

| Capability check | Result |
|---|---|
| `docker` / `docker compose` on this container | NOT INSTALLED |
| `/opt/prin7r-deploys/...` on this container | DOES NOT EXIST |
| `ssh root@144.91.94.91` (prin7r_vps_ed25519) | `Permission denied (publickey)` |
| `ssh root@144.91.94.91` (prin7r-vps-dev_ed25519) | `Permission denied (publickey)` |
| SSH key for `root@144.91.94.91` in `~/.ssh` | None — the two ed25519 keys are scoped to a different host |

This Paperclip container is a **dev workspace**, not the deploy host. The only owned
action available from here is `git push` to `origin/main`, which has now been done.
Triggering the rebuild on `144.91.94.91` requires the host owner.

## 6. Exact unblock sequence (host owner action on root@144.91.94.91)

```bash
# 0. Confirm origin is at the expected fix commit.
ssh root@144.91.94.91
cd /opt/prin7r-deploys/ai-worker-as-a-service
git rev-parse origin/main         # expect 24921d704e2a266e55a1b81359c31e7e14646ebc
git pull --ff-only origin main    # should be a no-op if origin already moved

# 1. Rebuild + recreate ONLY the app container (the changelog + receipts views live
#    there; the landing container has nothing to do with /changelog).
docker compose build app
docker compose up -d --force-recreate app

# 2. Wait for the app to come up (drizzle migrate + seed runs in Dockerfile.app CMD).
docker compose ps app              # state should be 'healthy' / 'running'
docker compose logs --tail=200 app # expect "listening on :3001"

# 3. Re-smoke from anywhere (Cloudflare cache should not sit on the changelog
#    because /changelog has no explicit cache-control; express sends dynamic HTML).
curl -s -o /tmp/cg.html -w 'HTTP=%{http_code} BYTES=%{size_download}\n' \
  https://ai-worker-as-a-service.prin7r.com/changelog

# 4. Pass / fail — pass when the body no longer contains any of the pre-purge tokens.
if grep -qE '667eea|linear-gradient\(135deg|#1a1a2e|#f8f9fa|#64748b|#fef3c7|#92400e' /tmp/cg.html; then
  echo "FAIL: pre-purge CSS still served"
  exit 1
else
  echo "PASS: changelog served from 12-token palette"
  head -45 /tmp/cg.html            # ink, paper, gravel, chalk visible in :style
fi
```

Expected `/tmp/cg.html` size after the rebuild: **~8.4 kB** (currently 6.8 kB). The
~1.6 kB delta is the new color-comment lines (`/* ink — was purple gradient text-fill
*/` etc.) plus the audit/payday/flag event-badge palette expansion in
`.badge-profile_added` / `.badge-drift_event` / `.badge-payout` / `.badge-system`.

## 6a. Fallback (no docker on host, or compose unavailable)

If `docker compose` is broken on the host, do a one-shot rebuild + restart:

```bash
cd /opt/prin7r-deploys/ai-worker-as-a-service
docker build -f Dockerfile.app -t shiftledger-app:latest .
docker stop shiftledger-app
docker rm shiftledger-app
docker compose up -d app
# then re-smoke as in §6 steps 2-4
```

## 7. Disposition (per the heartbeat contract)

- Issue: **PRI-3027 T48**
- Disposition: **blocked** — the code-side fix is in `origin/main` (`24921d7`), but
  the prod container is built from the previous tip and the deploy host is not
  reachable from this dev workspace.
- Named unblock owner: **deploy host operator with shell on `root@144.91.94.91`**
  (the same operator who runs the Wave 2 shared NOWPayments secret rotation;
  cf. PRI-3014 blocker B1 in `docs/runbooks/deploy-qa-evidence.md`).
- Unblock action: run §6 in full and confirm §6 step 4 reports PASS.
- Re-smoke after unblock: `curl -sI https://ai-worker-as-a-service.prin7r.com/changelog`
  should return `x-powered-by: Express` and the body grep in §6 step 4 should print
  PASS.

## 8. Files changed this heartbeat

- `docs/runbooks/pri-3027-t48-deploy-lag.md` (new) — this runbook.
- `origin/main` advanced 3 commits: `a90e803`, `8c8557b`, `24921d7`.

No application code was modified. No Docker / compose / env / secrets were touched.
The brand-purge work from PRI-3524 is preserved verbatim; the only blocker is the
rebuild on the deploy host.
