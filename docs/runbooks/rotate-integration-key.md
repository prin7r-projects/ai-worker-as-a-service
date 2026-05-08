# Rotate `INTEGRATION_KEY` — Shiftledger

> Runbook · Phase 4 production hardening · [PRI-2323](/PRI/issues/PRI-2323)

## ⚠️  Warning: Data-loss risk

`INTEGRATION_KEY` is the AES-256-GCM master key that encrypts **all customer integration tokens** at rest (Zendesk, Intercom, Salesforce, HubSpot API tokens). Rotating this key **requires re-encrypting every stored integration token**. If you rotate the key without re-encrypting, all stored integrations become unreadable and must be re-pasted by customers.

This is an **offline rotation** — plan for 15-30 minutes of downtime while you re-encrypt.

## When

- Every 180 days (per security policy)
- Immediately after a suspected key compromise
- After a production incident where `INTEGRATION_KEY` may have been exposed

## Pre-rotation checklist

- [ ] SSH access to Prin7r VPS (`root@144.91.94.91`)
- [ ] Postgres client available on the VPS or accessible from it
- [ ] All customers notified 24+ hours in advance (Postmark template `integration-maintenance`)
- [ ] `#alerts-shiftledger` notified: "INTEGRATION_KEY rotation starting — 15 min downtime expected"
- [ ] Current key backed up in password manager

## Rotation steps

### 1. Export current integration tokens (with old key)

First, get the current `INTEGRATION_KEY`:

```bash
ssh root@144.91.94.91
cd /opt/prin7r-deploys/ai-worker-as-a-service
grep INTEGRATION_KEY .env
```

Then export all integration rows to a secure temp file:

```bash
# Dump integrations table
docker exec shiftledger-postgres psql \
  -U shiftledger -d shiftledger \
  -c "COPY (SELECT id, kind, customer_id, api_token_encrypted FROM integrations) TO STDOUT WITH CSV HEADER;" \
  > /tmp/integrations_backup_$(date +%Y%m%d).csv

# Secure the file
chmod 600 /tmp/integrations_backup_*.csv
```

### 2. Decrypt all tokens with the old key

Run a one-time decryption script (requires Node.js on VPS):

```bash
cd /opt/prin7r-deploys/ai-worker-as-a-service
node -e "
const crypto = require('crypto');
const fs = require('fs');

const OLD_KEY = process.argv[1];
const csv = fs.readFileSync(process.argv[2], 'utf8');
const lines = csv.trim().split('\n').slice(1); // skip header
const key = crypto.createHash('sha256').update(OLD_KEY).digest();

const results = [];
for (const line of lines) {
  const [id, kind, customerId, packed] = line.split(',');
  if (!packed) continue;
  const data = Buffer.from(packed, 'base64');
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ct = data.subarray(32).toString('base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ct, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  results.push([id, kind, customerId, decrypted].join(','));
}
fs.writeFileSync('/tmp/integrations_decrypted.csv', 'id,kind,customer_id,api_token\n' + results.join('\n'));
console.log('Decrypted ' + results.length + ' tokens');
" "$(grep INTEGRATION_KEY .env | cut -d= -f2)" /tmp/integrations_backup_*.csv
```

### 3. Generate a new key

```bash
openssl rand -base64 48 | tr -d '\n/+=' | head -c 64
```

Store in password manager.

### 4. Re-encrypt all tokens with the new key

```bash
cd /opt/prin7r-deploys/ai-worker-as-a-service
node -e "
const crypto = require('crypto');
const fs = require('fs');

const NEW_KEY = process.argv[1];
const csv = fs.readFileSync(process.argv[2], 'utf8');
const lines = csv.trim().split('\n').slice(1);
const key = crypto.createHash('sha256').update(NEW_KEY).digest();

const results = [];
for (const line of lines) {
  const [id, kind, customerId, token] = line.split(',');
  if (!token) continue;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]).toString('base64');
  results.push([id, packed].join(','));
}
fs.writeFileSync('/tmp/integrations_reencrypted.csv', 'id,api_token_encrypted\n' + results.join('\n'));
console.log('Re-encrypted ' + results.length + ' tokens');
" "<NEW_KEY>" /tmp/integrations_decrypted.csv
```

### 5. Update the database with re-encrypted tokens

```bash
# Create a temp table, import re-encrypted data, update
docker exec -i shiftledger-postgres psql -U shiftledger -d shiftledger <<'SQL'
BEGIN;
CREATE TEMP TABLE _rekey (id uuid, api_token_encrypted text);
\copy _rekey FROM '/tmp/integrations_reencrypted.csv' WITH CSV HEADER;
UPDATE integrations
SET api_token_encrypted = _rekey.api_token_encrypted
FROM _rekey
WHERE integrations.id = _rekey.id;
DROP TABLE _rekey;
COMMIT;
SQL
```

### 6. Update env and restart

```bash
cd /opt/prin7r-deploys/ai-worker-as-a-service
cp .env .env.bak.$(date +%Y%m%d%H%M%S)
sed -i 's/^INTEGRATION_KEY=.*/INTEGRATION_KEY=<NEW_KEY>/' .env
docker compose up -d --force-recreate app
```

### 7. Verify integrations still work

```bash
# Check integration health
curl -s -H "Authorization: Bearer $ADMIN_API_KEY" \
  https://ai-worker-as-a-service.prin7r.com/api/admin/contracts | \
  jq '.[].id'

# Run a heartbeat on each integration
docker exec shiftledger-app npx tsx -e "
const { db, schema } = require('./src/db');
const rows = await db.select().from(schema.integrations);
for (const r of rows) {
  const resp = await fetch('http://localhost:3001/api/integrations/' + r.id + '/heartbeat', { method: 'POST' });
  const data = await resp.json();
  console.log(r.kind + ':', data.status);
}
"
```

Expected: all integrations report `healthy` or `degraded` (not `expired`).

### 8. Cleanup

```bash
# Remove sensitive temp files
shred -u /tmp/integrations_backup_*.csv
shred -u /tmp/integrations_decrypted.csv
shred -u /tmp/integrations_reencrypted.csv

# Remove .env backup after 72h of stable operation
```

## Post-rotation

- [ ] Update password manager with new key + rotation date
- [ ] Post to `#alerts-shiftledger`: "INTEGRATION_KEY rotation complete. All X integrations re-encrypted."
- [ ] Next rotation due: +180 days

## Emergency rollback

If integrations break after rotation:

```bash
ssh root@144.91.94.91
cd /opt/prin7r-deploys/ai-worker-as-a-service
cp .env.bak.* .env
docker compose up -d --force-recreate app
```

Then restore the old encrypted tokens from backup. Since you only changed the key (not the data), the old tokens will decrypt correctly with the old key.

## Audit trail

Record in password manager:
- Date of rotation
- Operator who performed it
- Number of integrations successfully re-encrypted
- Confirmation all heartbeats passed
- Next rotation due date (+180 days)
