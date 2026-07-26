CREATE TYPE "public"."account_type" AS ENUM('bank', 'cash', 'payment_gateway');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'restore', 'reverse', 'login', 'login_failed', 'logout', 'export', 'download', 'view_sensitive');--> statement-breakpoint
CREATE TYPE "public"."billing_type" AS ENUM('one_time', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."brand_status" AS ENUM('lead', 'proposal_sent', 'active', 'suspended', 'churned');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."obligation_status" AS ENUM('draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."obligation_target" AS ENUM('receivable', 'payable');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('fixed_monthly', 'one_time_project', 'hourly', 'per_service', 'ad_budget_commission', 'revenue_commission', 'package_plus_extra', 'installment');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'in_review', 'client_approval', 'revision', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_type" AS ENUM('kdv', 'kdv_tevkifat', 'stopaj', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'finance', 'operations', 'member');--> statement-breakpoint
CREATE TABLE "brand_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"whatsapp" text,
	"preferred_channel" text,
	"birthday" date,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_billing_contact" boolean DEFAULT false NOT NULL,
	"last_contacted_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "brand_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_number" text,
	"tax_office" text,
	"industry" text,
	"website" text,
	"email" text,
	"phone" text,
	"address" text,
	"logo_url" text,
	"brand_colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"social_accounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "brand_status" DEFAULT 'lead' NOT NULL,
	"onboarded_at" date,
	"churned_at" date,
	"churn_reason" text,
	"external_refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "contract_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"service_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'adet' NOT NULL,
	"period" text DEFAULT 'monthly' NOT NULL,
	"unit_price_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"est_cost_minor" bigint DEFAULT 0 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"contract_no" text NOT NULL,
	"title" text NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'fixed_monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"renewal_date" date,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"fx_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"amount_base_minor" bigint NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"vat_included" boolean DEFAULT false NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"payment_day" smallint,
	"payment_terms_days" smallint DEFAULT 0 NOT NULL,
	"payment_method" text,
	"price_increase_period" text,
	"next_price_review_date" date,
	"termination_terms" text,
	"notes" text,
	"activated_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"minor_units" smallint DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"currency_code" char(3) NOT NULL,
	"base_code" char(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"rate_date" date NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"interval_count" smallint DEFAULT 1 NOT NULL,
	"day_of_month" smallint,
	"day_of_week" smallint,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"max_occurrences" integer,
	"last_generated_on" date,
	"occurrence_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recurrence_rule_id" uuid NOT NULL,
	"target_type" "obligation_target" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"brand_id" uuid,
	"contract_id" uuid,
	"service_id" uuid,
	"category_id" uuid,
	"vendor_id" uuid,
	"default_account_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"billing_type" "billing_type" DEFAULT 'recurring' NOT NULL,
	"list_price_minor" bigint DEFAULT 0 NOT NULL,
	"min_price_minor" bigint DEFAULT 0 NOT NULL,
	"est_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) DEFAULT 'TRY' NOT NULL,
	"default_unit" text DEFAULT 'adet' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"full_name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"avatar_url" text,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"receivable_id" uuid,
	"payable_id" uuid,
	"tx_amount_minor" bigint NOT NULL,
	"ob_amount_minor" bigint NOT NULL,
	"fx_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"amount_base_minor" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"reversed_at" timestamp with time zone,
	"reversed_by_id" uuid,
	"reversal_reason" text
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bank_name" text,
	"account_type" "account_type" DEFAULT 'bank' NOT NULL,
	"account_holder" text,
	"iban_encrypted" text,
	"iban_last4" text,
	"currency_code" char(3) NOT NULL,
	"opening_balance_minor" bigint DEFAULT 0 NOT NULL,
	"opening_balance_date" date DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_direct_cost" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"vendor_id" uuid,
	"brand_id" uuid,
	"contract_id" uuid,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"period_start" date,
	"period_end" date,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"fx_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"amount_base_minor" bigint NOT NULL,
	"issue_date" date DEFAULT now() NOT NULL,
	"due_date" date NOT NULL,
	"status" "obligation_status" DEFAULT 'pending' NOT NULL,
	"paid_minor" bigint DEFAULT 0 NOT NULL,
	"paid_base_minor" bigint DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_id" uuid,
	"document_no" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"contract_id" uuid,
	"service_id" uuid,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"period_start" date,
	"period_end" date,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"fx_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"amount_base_minor" bigint NOT NULL,
	"issue_date" date DEFAULT now() NOT NULL,
	"due_date" date NOT NULL,
	"status" "obligation_status" DEFAULT 'pending' NOT NULL,
	"paid_minor" bigint DEFAULT 0 NOT NULL,
	"paid_base_minor" bigint DEFAULT 0 NOT NULL,
	"invoice_no" text,
	"invoice_date" date,
	"invoice_uuid" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tax_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"receivable_id" uuid,
	"payable_id" uuid,
	"tax_type" "tax_type" NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"base_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"external_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"direction" "transaction_direction" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"fx_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"amount_base_minor" bigint NOT NULL,
	"value_date" date NOT NULL,
	"description" text NOT NULL,
	"counterparty" text,
	"reference_no" text,
	"payment_method" text,
	"brand_id" uuid,
	"transfer_pair_id" uuid,
	"refund_of_transaction_id" uuid,
	"unallocated_minor" bigint DEFAULT 0 NOT NULL,
	"import_batch_id" uuid,
	"external_id" text,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"tax_number" text,
	"email" text,
	"phone" text,
	"iban_encrypted" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum" text,
	"category" text,
	"version" smallint DEFAULT 1 NOT NULL,
	"replaces_id" uuid,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" "audit_action" NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"entity_label" text,
	"changes" jsonb,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"action_url" text,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid,
	"contract_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" uuid,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"due_date" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"parent_id" uuid,
	"project_id" uuid,
	"estimated_minutes" integer,
	"spent_minutes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "brand_contacts" ADD CONSTRAINT "brand_contacts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_users" ADD CONSTRAINT "brand_users_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_users" ADD CONSTRAINT "brand_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_base_code_currencies_code_fk" FOREIGN KEY ("base_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_payable_id_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_reversed_by_id_users_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_lines" ADD CONSTRAINT "tax_lines_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_lines" ADD CONSTRAINT "tax_lines_payable_id_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."payables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contacts_brand" ON "brand_contacts" USING btree ("brand_id") WHERE "brand_contacts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contact_primary" ON "brand_contacts" USING btree ("brand_id") WHERE "brand_contacts"."is_primary" AND "brand_contacts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_brand_user" ON "brand_users" USING btree ("brand_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_brand_primary_user" ON "brand_users" USING btree ("brand_id") WHERE "brand_users"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_brands_code" ON "brands" USING btree ("code") WHERE "brands"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_brands_status" ON "brands" USING btree ("status") WHERE "brands"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_contract_items" ON "contract_items" USING btree ("contract_id") WHERE "contract_items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contracts_no" ON "contracts" USING btree ("contract_no") WHERE "contracts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_contracts_brand" ON "contracts" USING btree ("brand_id") WHERE "contracts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_contracts_end_date" ON "contracts" USING btree ("end_date") WHERE "contracts"."status" = 'active' AND "contracts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fx_day" ON "exchange_rates" USING btree ("currency_code","base_code","rate_date");--> statement-breakpoint
CREATE INDEX "idx_fx_lookup" ON "exchange_rates" USING btree ("currency_code","base_code","rate_date");--> statement-breakpoint
CREATE INDEX "idx_templates_active" ON "recurring_templates" USING btree ("target_type") WHERE "recurring_templates"."is_active" AND "recurring_templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_services_code" ON "services" USING btree ("code") WHERE "services"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_alloc_tx" ON "allocations" USING btree ("transaction_id") WHERE "allocations"."reversed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_alloc_receivable" ON "allocations" USING btree ("receivable_id") WHERE "allocations"."receivable_id" IS NOT NULL AND "allocations"."reversed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_alloc_payable" ON "allocations" USING btree ("payable_id") WHERE "allocations"."payable_id" IS NOT NULL AND "allocations"."reversed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_cat_code" ON "expense_categories" USING btree ("code") WHERE "expense_categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payable_source" ON "payables" USING btree ("source_type","source_id","due_date") WHERE "payables"."source_id" IS NOT NULL AND "payables"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payables_open" ON "payables" USING btree ("due_date") WHERE "payables"."status" IN ('pending','partially_paid','overdue') AND "payables"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payables_brand" ON "payables" USING btree ("brand_id") WHERE "payables"."brand_id" IS NOT NULL AND "payables"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receivable_source" ON "receivables" USING btree ("source_type","source_id","due_date") WHERE "receivables"."source_id" IS NOT NULL AND "receivables"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_receivables_brand" ON "receivables" USING btree ("brand_id") WHERE "receivables"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_receivables_open" ON "receivables" USING btree ("due_date","brand_id") WHERE "receivables"."status" IN ('pending','partially_paid','overdue') AND "receivables"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tax_receivable" ON "tax_lines" USING btree ("receivable_id") WHERE "tax_lines"."receivable_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tax_payable" ON "tax_lines" USING btree ("payable_id") WHERE "tax_lines"."payable_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_account_date" ON "transactions" USING btree ("bank_account_id","value_date") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_unallocated" ON "transactions" USING btree ("value_date") WHERE "transactions"."unallocated_minor" > 0 AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_advances" ON "transactions" USING btree ("brand_id") WHERE "transactions"."direction" = 'in' AND "transactions"."unallocated_minor" > 0 AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tx_external" ON "transactions" USING btree ("bank_account_id","external_id") WHERE "transactions"."external_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_attachments_entity" ON "attachments" USING btree ("entity_type","entity_id") WHERE "attachments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notification_dedupe" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("user_id","created_at") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "tasks" USING btree ("assignee_id","status") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_brand" ON "tasks" USING btree ("brand_id") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_overdue" ON "tasks" USING btree ("due_date") WHERE "tasks"."status" NOT IN ('done','cancelled') AND "tasks"."deleted_at" IS NULL;