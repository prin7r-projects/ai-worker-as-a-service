// apps/app/src/db/schema.ts — Shiftledger Drizzle schema per docs/12 §2.2
import { pgTable, uuid, text, integer, numeric, jsonb, date, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  orgName: text("org_name"),
  agencyPartnerCode: text("agency_partner_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workerProfiles = pgTable("worker_profiles", {
  id: text("id").primaryKey(), // 'cs-shift', 'sdr-shift', ...
  displayName: text("display_name").notNull(),
  category: text("category").notNull(), // 'cs'|'sdr'|'research'|'content'
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }).notNull(),
  verificationRule: jsonb("verification_rule").notNull(), // structured, not freeform
  baselineClearRate: numeric("baseline_clear_rate", { precision: 5, scale: 4 }),
  driftStatus: text("drift_status").default("green"),
});

export const contracts = pgTable("contracts", {
  id: text("id").primaryKey(), // 'shiftledger_standard_<ts>_<rand>'
  customerId: uuid("customer_id").references(() => customers.id),
  workerProfileId: text("worker_profile_id").references(() => workerProfiles.id),
  tier: text("tier").notNull(), // 'trial'|'standard'|'enterprise'
  status: text("status").default("pending"), // 'pending'|'active'|'paused'|'completed'|'cancelled'
  outcomeTarget: integer("outcome_target").notNull(), // e.g. 350
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }).notNull(),
  budgetCapUsd: numeric("budget_cap_usd", { precision: 10, scale: 2 }),
  termMonths: integer("term_months").default(1),
  autoRenew: boolean("auto_renew").default(false),
  referralCode: text("referral_code"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: text("contract_id").references(() => contracts.id),
  status: text("status").default("queued"), // 'queued'|'running'|'paused'|'completed'|'stuck'
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  outcomesAttempted: integer("outcomes_attempted").default(0),
  outcomesCleared: integer("outcomes_cleared").default(0),
  outcomesVoided: integer("outcomes_voided").default(0),
});

export const receiptLines = pgTable("receipt_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  shiftId: uuid("shift_id").references(() => shifts.id),
  externalId: text("external_id"), // ticket id / lead id in source-of-truth
  status: text("status").notNull(), // 'cleared'|'voided'|'disputed'|'escalated'
  clearedAt: timestamp("cleared_at"),
  voidedAt: timestamp("voided_at"),
  disputedAt: timestamp("disputed_at"),
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }),
  verificationDetails: jsonb("verification_details"),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  kind: text("kind").notNull(), // 'zendesk'|'intercom'|'salesforce'|'hubspot'
  apiTokenEncrypted: text("api_token_encrypted").notNull(),
  status: text("status").default("healthy"), // 'healthy'|'expired'|'degraded'
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
});

export const evalRuns = pgTable(
  "eval_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerProfileId: text("worker_profile_id").references(() => workerProfiles.id),
    weekStart: date("week_start").notNull(),
    clearRate: numeric("clear_rate", { precision: 5, scale: 4 }),
    voidRate: numeric("void_rate", { precision: 5, scale: 4 }),
    sampleSize: integer("sample_size"),
  },
  (table) => [
    index("eval_runs_profile_week_idx").on(table.workerProfileId, table.weekStart),
  ],
);
