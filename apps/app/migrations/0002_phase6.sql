-- Phase 6: White-label receipts, partner analytics, drift cohort, changelog
CREATE TABLE "partner_branding" (
  "referral_code" text PRIMARY KEY NOT NULL,
  "logo_data_url" text,
  "footer_text" text,
  "contact_email" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profile_status_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "worker_profile_id" text NOT NULL REFERENCES "worker_profiles"("id"),
  "old_status" text,
  "new_status" text NOT NULL,
  "changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "profile_status_log_profile_idx" ON "profile_status_log" ("worker_profile_id", "changed_at");
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "metadata" jsonb,
  "published_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "changelog_published_idx" ON "changelog_entries" ("published_at");
