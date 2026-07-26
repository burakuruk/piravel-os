ALTER TYPE "public"."audit_action" ADD VALUE 'login_rate_limited' BEFORE 'export';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'account_temporarily_locked' BEFORE 'export';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'login_after_lock_expired' BEFORE 'export';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'security_counter_reset' BEFORE 'export';--> statement-breakpoint
CREATE TABLE "auth_login_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"identifier_hash" text NOT NULL,
	"ip_hash" text,
	"attempt_type" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"count" integer,
	"last_request" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_security_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"password_failed_count" integer DEFAULT 0 NOT NULL,
	"password_window_started_at" timestamp with time zone,
	"password_locked_until" timestamp with time zone,
	"password_lock_count_today" integer DEFAULT 0 NOT NULL,
	"password_lock_day" date,
	"totp_failed_count" integer DEFAULT 0 NOT NULL,
	"totp_window_started_at" timestamp with time zone,
	"totp_locked_until" timestamp with time zone,
	"last_successful_login_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_attempts_identifier" ON "auth_login_attempts" USING btree ("identifier_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_attempts_user" ON "auth_login_attempts" USING btree ("user_id","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_attempts_recent" ON "auth_login_attempts" USING btree ("attempted_at") WHERE "auth_login_attempts"."succeeded" = false;--> statement-breakpoint
CREATE INDEX "idx_rate_limit_key" ON "auth_rate_limit" USING btree ("key");