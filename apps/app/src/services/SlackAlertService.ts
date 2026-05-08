// apps/app/src/services/SlackAlertService.ts
// Phase 4: Slack alerts for production hardening (PRI-2323 task 5)
//
// Alerts:
//   1. Webhook signature failures >5/h → #alerts-shiftledger
//   2. Shifts stuck >24h → #alerts-shiftledger
//   3. Worker-profile clear-rate drops >5pp below baseline for 3 days → #alerts-shiftledger
//   4. Daily contracts created <2σ below 30-day mean → #alerts-shiftledger
//
// Uses Slack Incoming Webhook (SLACK_ALERT_WEBHOOK_URL env var).
// All sends are fire-and-forget; failures are logged but never crash the caller.

const WEBHOOK_URL = process.env.SLACK_ALERT_WEBHOOK_URL ?? "";
const ENABLED = WEBHOOK_URL.length > 0;

type AlertLevel = "info" | "warning" | "critical";

export interface AlertPayload {
  title: string;
  level: AlertLevel;
  fields: Array<{ name: string; value: string }>;
  footer?: string;
}

/**
 * Throttle counters for rate-bucketed alerts (e.g. sig failures per hour).
 */
const bucketCounters = new Map<string, { count: number; resetAt: number }>();

function incrementBucket(key: string, ttlMs: number): number {
  const now = Date.now();
  const entry = bucketCounters.get(key);
  if (!entry || now > entry.resetAt) {
    bucketCounters.set(key, { count: 1, resetAt: now + ttlMs });
    return 1;
  }
  entry.count++;
  return entry.count;
}

/**
 * Post a Slack message via incoming webhook.
 * Fire-and-forget: never throws.
 */
export async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  if (!ENABLED) {
    console.log(`[slack] disabled — SLACK_ALERT_WEBHOOK_URL not set. Alert: ${payload.title}`);
    return;
  }

  const color = { info: "#1F4F8A", warning: "#B5371F", critical: "#B5371F" }[payload.level];

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: payload.title, emoji: true },
    },
    {
      type: "section",
      fields: payload.fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.name}*\n${f.value}`,
      })),
    },
  ];

  if (payload.footer) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: payload.footer }],
    });
  }

  const message = {
    attachments: [{ color, blocks }],
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error(`[slack] send_failed status=${res.status} alert=${payload.title}`);
    }
  } catch (err) {
    console.error(`[slack] send_error alert=${payload.title}: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Alert predicates
// ---------------------------------------------------------------------------

/**
 * Alert 1: Webhook signature failure rate alert.
 * Call this on every IPN signature failure.
 * Alerts when >5 failures in the last hour.
 */
export function trackWebhookSigFailure(): void {
  const count = incrementBucket("webhook_sig_failures", 3_600_000); // 1 hour

  if (count === 6) {
    // First time crossing threshold
    sendSlackAlert({
      title: "⚠️  Webhook signature failures exceeding threshold",
      level: "warning",
      fields: [
        { name: "Threshold", value: ">5 failures in 1 hour" },
        { name: "Action", value: "Check NOWPayments IPN health and verify IPN secret is correct" },
        { name: "Endpoint", value: "POST /api/webhooks/nowpayments" },
      ],
      footer: "Shiftledger Phase 4 · Webhook forgery detection",
    });
  }

  if (count === 20) {
    sendSlackAlert({
      title: "🚨 CRITICAL: Sustained webhook signature failures",
      level: "critical",
      fields: [
        { name: "Count", value: `${count} failures in the last hour` },
        { name: "Possible cause", value: "IPN secret mismatch or active forgery attempt" },
        { name: "Action", value: "Verify NOWPAYMENTS_IPN_SECRET immediately. Rotate if needed." },
      ],
      footer: "Shiftledger Phase 4 · Webhook forgery detection",
    });
  }
}

/**
 * Alert 2: Check for shifts stuck >24h.
 * Should be called periodically (e.g. every 15 min via a cron/heartbeat job).
 */
export async function checkStuckShifts(
  stuckShiftCount: number,
  sampleShiftIds: string[],
): Promise<void> {
  if (stuckShiftCount === 0) return;

  await sendSlackAlert({
    title: `⚠️  ${stuckShiftCount} shift(s) stuck >24h`,
    level: stuckShiftCount > 5 ? "critical" : "warning",
    fields: [
      { name: "Stuck count", value: String(stuckShiftCount) },
      {
        name: "Sample IDs",
        value: sampleShiftIds.slice(0, 5).join(", ") || "none",
      },
      {
        name: "Action",
        value: "Check shift logs, integration heartbeat, and source-of-truth connectivity",
      },
    ],
    footer: "Shiftledger Phase 4 · Shift health monitor",
  });
}

/**
 * Alert 3: Worker profile clear-rate drift >5pp below baseline.
 */
export async function checkDrift(
  profileId: string,
  displayName: string,
  baseline: number,
  current30dMean: number,
): Promise<void> {
  const drift = baseline - current30dMean;
  if (drift <= 0.05) return; // within tolerance

  await sendSlackAlert({
    title: `📉 Clear-rate drift: ${displayName} (${profileId})`,
    level: drift > 0.10 ? "critical" : "warning",
    fields: [
      { name: "Baseline", value: `${(baseline * 100).toFixed(1)}%` },
      { name: "30-day mean", value: `${(current30dMean * 100).toFixed(1)}%` },
      { name: "Drift", value: `-${(drift * 100).toFixed(1)}pp` },
      {
        name: "Action",
        value: "Sample 50 recent receipts. Check if source-of-truth or verifier rules changed.",
      },
    ],
    footer: `Shiftledger Phase 4 · Drift monitor · Profile: ${profileId}`,
  });
}

/**
 * Alert 4: Daily contract anomaly detection.
 * Alerts when today's contracts are <2σ below the 30-day mean.
 */
export async function checkContractAnomaly(
  todayCount: number,
  mean30d: number,
  stdDev30d: number,
): Promise<void> {
  const threshold = mean30d - 2 * stdDev30d;
  if (todayCount >= threshold) return;

  await sendSlackAlert({
    title: "📉 Daily contract anomaly detected",
    level: "warning",
    fields: [
      { name: "Today's contracts", value: String(todayCount) },
      { name: "30-day mean", value: mean30d.toFixed(1) },
      { name: "Anomaly threshold (μ-2σ)", value: threshold.toFixed(1) },
      {
        name: "Action",
        value: "Check landing uptime, NOWPayments availability, and marketing campaign status",
      },
    ],
    footer: "Shiftledger Phase 4 · Contract anomaly detection",
  });
}
