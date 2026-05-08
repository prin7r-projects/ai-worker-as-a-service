// apps/app/src/services/HeartbeatService.ts
// Phase 4: Integration heartbeat job (PRI-2323 task 8)
//
// Every 5 minutes, checks every active integration via GET whoami (or equivalent).
// After 3 consecutive failures, pauses the related contract(s).
//
// Also runs the periodic alert checks:
//   - Stuck shifts >24h
//   - Drift >5pp on all worker profiles
//   - Daily contract anomaly
//
// Usage: startHeartbeat() is called once from server.ts after the app starts.

import { db, schema } from "../db/index.js";
import { eq, gte, and, sql, desc, lt } from "drizzle-orm";
import { ZendeskService } from "./ZendeskService.js";
import { sendSlackAlert, checkStuckShifts, checkDrift, checkContractAnomaly } from "./SlackAlertService.js";
import { ContractService } from "./ContractService.js";
import { scrubLog } from "./PiiScrubber.js";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_FAILURES = 3;

// In-memory failure tracker: integrationId → consecutive failure count
const failureTracker = new Map<string, number>();

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(): void {
  if (heartbeatTimer) {
    console.warn("[heartbeat] already running");
    return;
  }

  console.log(
    `[heartbeat] started — interval=${HEARTBEAT_INTERVAL_MS / 1000}s, max_consecutive_failures=${MAX_CONSECUTIVE_FAILURES}`,
  );

  // Run immediately, then on interval
  runHeartbeat().catch((err) => {
    console.error(`[heartbeat] initial_run_error: ${err.message}`);
  });

  heartbeatTimer = setInterval(() => {
    runHeartbeat().catch((err) => {
      console.error(`[heartbeat] run_error: ${err.message}`);
    });
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log("[heartbeat] stopped");
  }
}

async function runHeartbeat(): Promise<void> {
  const start = Date.now();
  console.log("[heartbeat] run_started");

  // ── 1. Integration health checks ──────────────────────────────────────
  await checkIntegrations();

  // ── 2. Stuck shifts check (>24h) ─────────────────────────────────────
  await checkForStuckShifts();

  // ── 3. Drift check on all worker profiles ─────────────────────────────
  await checkProfileDrift();

  // ── 4. Daily contract anomaly check ───────────────────────────────────
  await checkContractAnomalies();

  console.log(`[heartbeat] run_completed duration_ms=${Date.now() - start}`);
}

// ---------------------------------------------------------------------------
// 1. Integration health
// ---------------------------------------------------------------------------

async function checkIntegrations(): Promise<void> {
  try {
    const integrations = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.status, "healthy"));

    if (integrations.length === 0) return;

    console.log(`[heartbeat] checking ${integrations.length} active integration(s)`);

    for (const integration of integrations) {
      let token: string;
      try {
        token = ZendeskService.decryptToken(integration.apiTokenEncrypted);
      } catch {
        // Can't decrypt → mark as expired immediately
        await onIntegrationFailure(integration.id, integration.kind, "decryption_failed");
        continue;
      }

      try {
        const result = await ZendeskService.validateToken(integration.kind, token);

        if (result.ok) {
          // Healthy: update lastHeartbeatAt, reset failure counter
          await db
            .update(schema.integrations)
            .set({ status: "healthy", lastHeartbeatAt: new Date() })
            .where(eq(schema.integrations.id, integration.id));
          failureTracker.delete(integration.id);
        } else {
          // Token validation returned non-ok → degraded
          await onIntegrationFailure(integration.id, integration.kind, result.details ?? "unknown");
        }
      } catch (err) {
        // Network error → degraded
        await onIntegrationFailure(
          integration.id,
          integration.kind,
          (err as Error).message,
        );
      }
    }
  } catch (err) {
    console.error(`[heartbeat] integration_check_error: ${(err as Error).message}`);
  }
}

async function onIntegrationFailure(
  integrationId: string,
  kind: string,
  reason: string,
): Promise<void> {
  const failures = (failureTracker.get(integrationId) ?? 0) + 1;
  failureTracker.set(integrationId, failures);

  console.log(
    scrubLog(
      `[heartbeat] integration_failure id=${integrationId} kind=${kind} failures=${failures}/${MAX_CONSECUTIVE_FAILURES} reason=${reason}`,
    ),
  );

  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    // Mark integration as expired
    await db
      .update(schema.integrations)
      .set({ status: "expired", lastHeartbeatAt: new Date() })
      .where(eq(schema.integrations.id, integrationId));

    failureTracker.delete(integrationId);

    // Pause all active contracts tied to this integration's customer
    try {
      const [integration] = await db
        .select()
        .from(schema.integrations)
        .where(eq(schema.integrations.id, integrationId))
        .limit(1);

      if (integration?.customerId) {
        const activeContracts = await db
          .select()
          .from(schema.contracts)
          .where(
            and(
              eq(schema.contracts.customerId, integration.customerId),
              eq(schema.contracts.status, "active"),
            ),
          );

        for (const contract of activeContracts) {
          await ContractService.pause(contract.id);
          console.log(
            `[heartbeat] contract_paused contractId=${contract.id} reason=integration_expired kind=${kind}`,
          );
        }

        await sendSlackAlert({
          title: `🔌 Integration expired: ${kind}`,
          level: "critical",
          fields: [
            { name: "Integration ID", value: integrationId },
            { name: "Kind", value: kind },
            { name: "Consecutive failures", value: String(failures) },
            { name: "Contracts paused", value: String(activeContracts.length) },
            {
              name: "Action",
              value: "Customer must re-paste their API token. Notify via Postmark.",
            },
          ],
          footer: "Shiftledger Phase 4 · Heartbeat monitor",
        });
      }
    } catch (pauseErr) {
      console.error(
        `[heartbeat] pause_error integrationId=${integrationId}: ${(pauseErr as Error).message}`,
      );
    }
  } else {
    // Mark as degraded but don't pause yet
    await db
      .update(schema.integrations)
      .set({ status: "degraded", lastHeartbeatAt: new Date() })
      .where(eq(schema.integrations.id, integrationId));
  }
}

// ---------------------------------------------------------------------------
// 2. Stuck shifts
// ---------------------------------------------------------------------------

async function checkForStuckShifts(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stuck = await db
      .select()
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.status, "running"),
          lt(schema.shifts.startedAt, cutoff),
        ),
      );

    if (stuck.length > 0) {
      const sampleIds = stuck.map((s) => s.id);

      // Mark them as stuck in the DB
      for (const shift of stuck) {
        await db
          .update(schema.shifts)
          .set({ status: "stuck", endedAt: new Date() })
          .where(eq(schema.shifts.id, shift.id));
      }

      await checkStuckShifts(stuck.length, sampleIds);
    }
  } catch (err) {
    console.error(`[heartbeat] stuck_shifts_check_error: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Worker profile drift
// ---------------------------------------------------------------------------

async function checkProfileDrift(): Promise<void> {
  try {
    const profiles = await db.select().from(schema.workerProfiles);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

    for (const profile of profiles) {
      if (!profile.baselineClearRate) continue;

      const baseline = parseFloat(profile.baselineClearRate);

      // Get recent eval runs for this profile (last 30 days)
      const recentEvals = await db
        .select()
        .from(schema.evalRuns)
        .where(
          and(
            eq(schema.evalRuns.workerProfileId, profile.id),
            gte(schema.evalRuns.weekStart, thirtyDaysAgoStr),
          ),
        )
        .orderBy(desc(schema.evalRuns.weekStart));

      if (recentEvals.length < 2) continue; // not enough data

      const totalClear = recentEvals.reduce(
        (sum, r) => sum + parseFloat(r.clearRate ?? "0") * (r.sampleSize ?? 0),
        0,
      );
      const totalSamples = recentEvals.reduce((sum, r) => sum + (r.sampleSize ?? 0), 0);

      const currentMean = totalSamples > 0 ? totalClear / totalSamples : 0;

      await checkDrift(profile.id, profile.displayName, baseline, currentMean);

      // Auto-set driftStatus if drift is severe
      const drift = baseline - currentMean;
      if (drift > 0.05 && profile.driftStatus !== "yellow") {
        await db
          .update(schema.workerProfiles)
          .set({ driftStatus: drift > 0.10 ? "red" : "yellow" })
          .where(eq(schema.workerProfiles.id, profile.id));
      }
    }
  } catch (err) {
    console.error(`[heartbeat] drift_check_error: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Daily contract anomaly
// ---------------------------------------------------------------------------

async function checkContractAnomalies(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get contracts created in the last 30 days, grouped by day
    const recentContracts = await db
      .select()
      .from(schema.contracts)
      .where(gte(schema.contracts.createdAt, thirtyDaysAgo));

    // Group by day
    const byDay = new Map<string, number>();
    for (const c of recentContracts) {
      const day = c.createdAt!.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    const today = todayStart.toISOString().slice(0, 10);
    const todayCount = byDay.get(today) ?? 0;

    const values = Array.from(byDay.values()).filter((v) => {
      // Exclude today from 30-day mean calculation
      const day = Array.from(byDay.entries()).find(([, count]) => count === v)?.[0];
      return day !== today;
    });

    if (values.length < 5) return; // not enough history

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    await checkContractAnomaly(todayCount, mean, stdDev);
  } catch (err) {
    console.error(`[heartbeat] anomaly_check_error: ${(err as Error).message}`);
  }
}
