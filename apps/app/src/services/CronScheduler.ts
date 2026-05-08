// apps/app/src/services/CronScheduler.ts
// Shiftledger Phase 5 — Lightweight cron scheduler using setInterval
// Replaces BullMQ dependency with in-process scheduling for:
//   1. Weekly digest — Monday 09:00 GMT
//   2. Nightly eval — 02:00 GMT daily

import { DigestService } from "./DigestService.js";
import { EvalRunnerService } from "./EvalRunnerService.js";

let digestTimer: ReturnType<typeof setInterval> | null = null;
let evalTimer: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL_MS = 60_000; // Check every minute

/**
 * Start all scheduled jobs.
 * Called once from server.ts after app starts.
 */
export function startCronJobs(): void {
  if (process.env.START_CRON_JOBS === "false") {
    console.log("[cron] Disabled via START_CRON_JOBS=false");
    return;
  }

  console.log("[cron] Starting scheduled jobs (check interval: 60s)");
  console.log("[cron]   - Digest: Mondays at 09:00 GMT");
  console.log("[cron]   - Eval:   Nightly at 02:00 GMT");

  startDigestJob();
  startEvalJob();
}

/**
 * Stop all scheduled jobs.
 */
export function stopCronJobs(): void {
  if (digestTimer) {
    clearInterval(digestTimer);
    digestTimer = null;
  }
  if (evalTimer) {
    clearInterval(evalTimer);
    evalTimer = null;
  }
  console.log("[cron] All jobs stopped");
}

// ---------------------------------------------------------------------------
// Digest Job — Mondays at 09:00 GMT
// ---------------------------------------------------------------------------

function startDigestJob(): void {
  // Track last run to prevent double-execution within the window
  let lastDigestWeek = "";

  digestTimer = setInterval(async () => {
    try {
      const now = new Date();

      // Check if it's Monday and time is within the 09:00-09:01 GMT window
      const isMonday = now.getUTCDay() === 1;
      const hour = now.getUTCHours();
      const minute = now.getUTCMinutes();
      const isTimeSlot = hour === 9 && minute === 0;

      if (!isMonday || !isTimeSlot) return;

      // Prevent duplicate runs within the same week window
      const weekKey = `${now.getUTCFullYear()}-W${getWeekNumber(now)}`;
      if (weekKey === lastDigestWeek) return;
      lastDigestWeek = weekKey;

      console.log(`[cron] Running weekly digest (${now.toISOString()})`);
      const result = await DigestService.runWeeklyDigest();
      console.log(
        `[cron] Digest complete — ${result.contractsProcessed} contracts, ` +
        `${result.emailsSent} emails sent, ${result.errors.length} errors`,
      );

      if (result.errors.length > 0) {
        console.error(`[cron] Digest errors: ${result.errors.join("; ")}`);
      }
    } catch (err) {
      console.error(`[cron] Digest job error: ${(err as Error).message}`);
    }
  }, CHECK_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Eval Job — Nightly at 02:00 GMT
// ---------------------------------------------------------------------------

function startEvalJob(): void {
  // Track last run to prevent double-execution
  let lastEvalDate = "";

  evalTimer = setInterval(async () => {
    try {
      const now = new Date();

      // Check if time is within the 02:00-02:01 GMT window
      const hour = now.getUTCHours();
      const minute = now.getUTCMinutes();
      const isTimeSlot = hour === 2 && minute === 0;

      if (!isTimeSlot) return;

      // Prevent duplicate runs within the same day
      const dateKey = now.toISOString().slice(0, 10);
      if (dateKey === lastEvalDate) return;
      lastEvalDate = dateKey;

      console.log(`[cron] Running nightly eval (${now.toISOString()})`);
      const result = await EvalRunnerService.runNightlyEval();
      console.log(
        `[cron] Eval complete — ${result.profilesEvaluated} profiles, ` +
        `${result.errors.length} errors`,
      );

      if (result.errors.length > 0) {
        console.error(`[cron] Eval errors: ${result.errors.join("; ")}`);
      }
    } catch (err) {
      console.error(`[cron] Eval job error: ${(err as Error).message}`);
    }
  }, CHECK_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get ISO week number for a date (weeks start Monday).
 */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
