# Rotate `ADMIN_API_KEY` — Shiftledger

> Runbook · Phase 4 production hardening · [PRI-2323](/PRI/issues/PRI-2323)

## When

Every 90 days, or immediately after:
- a key leak / suspected compromise
- team member departure with admin access
- production incident where admin credentials may have been exposed

## Pre-rotation checklist

- [ ] You have SSH access to the Prin7r VPS (`root@144.91.94.91`)
- [ ] You know the **current** `ADMIN_API_KEY` (needed to issue the rotation command on the running container)
- [ ] No active incident that requires the current key to remain valid for more than 5 minutes
- [ ] A Slack message has been posted to `#alerts-shiftledger` stating "ADMIN_API_KEY rotation starting"

## Rotation steps

### 1. Generate a new key

```bash
# On your local machine (or a secure environment):
openssl rand -base64 48 | tr -d '\n/+=' | head -c 64
```

Store this value securely (password manager). Never paste it into Slack or commit it.

### 2. Update the docker-compose environment

```bash
ssh root@144.91.94.91

# Edit the .env file on the VPS
cd /opt/prin7r-deploys/ai-worker-as-a-service
cp .env .env.bak.$(date +%Y%m%d%H%M%S)

# Replace ADMIN_API_KEY with the new value
sed -i 's/^ADMIN_API_KEY=.*/ADMIN_API_KEY=<NEW_KEY>/' .env
```

### 3. Restart the app container

```bash
cd /opt/prin7r-deploys/ai-worker-as-a-service
docker compose up -d --force-recreate app
```

### 4. Verify the new key works

```bash
# From a secure network (not logged):
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <NEW_KEY>" \
  https://ai-worker-as-a-service.prin7r.com/api/admin/contracts
```

Expected: `200`
If you get `401`, check that the container restarted successfully and the env var is set:

```bash
docker exec shiftledger-app env | grep ADMIN_API_KEY
```

### 5. Revoke the old key

The old key is invalid as soon as the container restarts with the new env var. Confirm:

```bash
# Should return 401 with the old key
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <OLD_KEY>" \
  https://ai-worker-as-a-service.prin7r.com/api/admin/contracts
```

### 6. Post-rotation

- [ ] Update password manager entry with new key + rotation date
- [ ] Post to `#alerts-shiftledger`: "ADMIN_API_KEY rotation complete. Old key revoked."
- [ ] Delete the `.env.bak` file after 24 hours if no issues: `rm /opt/prin7r-deploys/ai-worker-as-a-service/.env.bak.*`

## Rollback

If the new key doesn't work:

```bash
ssh root@144.91.94.91
cd /opt/prin7r-deploys/ai-worker-as-a-service
cp .env.bak.* .env
docker compose up -d --force-recreate app
```

Then verify with the old key.

## Audit trail

Each rotation must be recorded in the company password manager with:
- Date of rotation
- Who performed it
- Confirmation that old key returned 401
- Next rotation due date (+90 days)
