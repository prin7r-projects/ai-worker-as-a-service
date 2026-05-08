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

// Phase 3: Partner referral rev-share ledger
export const revShareLedger = pgTable(
  "rev_share_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id").references(() => contracts.id).notNull(),
    referralCode: text("referral_code").notNull(),
    shareRate: numeric("share_rate", { precision: 5, scale: 4 }).notNull().default("0.2500"), // 25% default
    contractRevenueUsd: numeric("contract_revenue_usd", { precision: 10, scale: 2 }),
    accruedUsd: numeric("accrued_usd", { precision: 10, scale: 2 }).default("0"),
    paidOutUsd: numeric("paid_out_usd", { precision: 10, scale: 2 }).default("0"),
    status: text("status").default("accruing"), // 'accruing'|'ready'|'paid'
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("rev_share_contract_idx").on(table.contractId),
    index("rev_share_code_idx").on(table.referralCode),
  ],
);

// Phase 3: Payment tracking for idempotency
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id").references(() => contracts.id).notNull(),
    paymentStatus: text("payment_status").notNull(), // IPN payment_status value
    nowpaymentsInvoiceId: text("nowpayments_invoice_id"),
    rawPayload: jsonb("raw_payload"),
    processedAt: timestamp("processed_at").defaultNow(),
  },
  (table) => [
    index("payment_events_contract_status_idx").on(table.contractId, table.paymentStatus),
  ],
);

// Phase 4: Idempotency keys for checkout dedup
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idemHash: text("idem_hash").notNull(),
    idemKey: text("idem_key").notNull(),
    responsePayload: jsonb("response_payload").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idem_hash_created_idx").on(table.idemHash, table.createdAt),
  ],
);

// Phase 6: Partner branding for white-label receipts
export const partnerBranding = pgTable(
  "partner_branding",
  {
    referralCode: text("referral_code").primaryKey(),
    logoDataUrl: text("logo_data_url"),       // base64 data URL (max ~100KB)
    footerText: text("footer_text"),           // e.g. "Powered by Acme Consulting"
    contactEmail: text("contact_email"),       // support contact for the partner
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
);

// Phase 6: Profile drift status change log for cohort analysis
export const profileStatusLog = pgTable(
  "profile_status_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerProfileId: text("worker_profile_id").references(() => workerProfiles.id).notNull(),
    oldStatus: text("old_status"),              // 'green' | 'yellow' | 'red' | null (initial)
    newStatus: text("new_status").notNull(),     // 'green' | 'yellow' | 'red'
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (table) => [
    index("profile_status_log_profile_idx").on(table.workerProfileId, table.changedAt),
  ],
);

// Phase 6: Public changelog entries
export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),     // 'profile_added' | 'drift_event' | 'payout' | 'system'
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata"),                 // optional structured data
    publishedAt: timestamp("published_at").defaultNow().notNull(),
  },
  (table) => [
    index("changelog_published_idx").on(table.publishedAt),
  ],
);
