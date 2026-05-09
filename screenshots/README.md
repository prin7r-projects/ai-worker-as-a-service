# Screenshots — Shiftledger

Browser screenshots require DNS cutover (`ai-worker-as-a-service.prin7r.com` → `144.91.94.91`) before a real browser can navigate. The app is fully functional and verified via curl with Host header.

## Verified pages (curl evidence committed)

| Page | Status | Evidence |
|------|--------|----------|
| Landing (`/`) | 200 | `landing-title.txt` |
| Dashboard (`/app/contracts`) | 200 | `dashboard-contracts.html.txt` |
| API root (`/api`) | 200 | `api-root.json` |
| Health (`/api/health`) | 200 | — |
| Changelog (`/changelog`) | 200 | — |
| Admin (`/admin`) | 302 → login | — |

## E2E tests

```
✓ src/__tests__/e2e.test.ts (5 tests)
  ✓ creates a contract in pending status
  ✓ activates a contract
  ✓ runs the full ShiftLedger orchestrator end-to-end
  ✓ produces exactly 100 receipt lines in the ledger
  ✓ audits the shift summary correctly
```

## Post-DNS screenshots to capture

- [ ] Desktop `/app/contracts` dashboard
- [ ] Mobile (390×844) `/app/contracts` dashboard
- [ ] `/app/integrations` page
- [ ] `/changelog` public page
- [ ] Landing hero receipt section
