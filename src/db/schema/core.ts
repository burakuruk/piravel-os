// Şema v1.2 — sistem, kimlik, marka, hizmet, sözleşme, recurrence
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandStatus, billingType, contractStatus, pricingModel, recurrenceFrequency, obligationTarget, userRole } from "./enums";
import { auditCols, idCol } from "./helpers";

// ── 3.1 currencies ──
export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  minorUnits: smallint("minor_units").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── 3.2 exchange_rates ──
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: idCol(),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    baseCode: char("base_code", { length: 3 }).notNull().references(() => currencies.code),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    rateDate: date("rate_date").notNull(),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_fx_day").on(t.currencyCode, t.baseCode, t.rateDate),
    index("idx_fx_lookup").on(t.currencyCode, t.baseCode, t.rateDate),
  ],
);

// ── 4.1 users (Better Auth Sprint 1'de kendi tablolarını ekler; iş kolonları burada) ──
export const users = pgTable(
  "users",
  {
    id: idCol(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    role: userRole("role").notNull().default("member"),
    avatarUrl: text("avatar_url"),
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    // v3 kancası: müşteri paneli kullanıcısı
    brandId: uuid("brand_id"),
    ...auditCols,
  },
  (t) => [
    uniqueIndex("uq_users_email_active").on(t.email).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── 5.1 brands ──
export const brands = pgTable(
  "brands",
  {
    id: idCol(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    taxNumber: text("tax_number"),
    taxOffice: text("tax_office"),
    industry: text("industry"),
    website: text("website"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    logoUrl: text("logo_url"),
    brandColors: jsonb("brand_colors").notNull().default([]),
    socialAccounts: jsonb("social_accounts").notNull().default({}),
    status: brandStatus("status").notNull().default("lead"),
    onboardedAt: date("onboarded_at"),
    churnedAt: date("churned_at"),
    churnReason: text("churn_reason"),
    externalRefs: jsonb("external_refs").notNull().default({}),
    notes: text("notes"),
    ...auditCols,
  },
  (t) => [
    uniqueIndex("uq_brands_code").on(t.code).where(sql`${t.deletedAt} IS NULL`),
    index("idx_brands_status").on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── 5.2 brand_contacts ──
export const brandContacts = pgTable(
  "brand_contacts",
  {
    id: idCol(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    preferredChannel: text("preferred_channel"),
    birthday: date("birthday"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isBillingContact: boolean("is_billing_contact").notNull().default(false),
    lastContactedAt: date("last_contacted_at"),
    notes: text("notes"),
    ...auditCols,
  },
  (t) => [
    index("idx_contacts_brand").on(t.brandId).where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex("uq_contact_primary").on(t.brandId).where(sql`${t.isPrimary} AND ${t.deletedAt} IS NULL`),
  ],
);

// ── 4.3 brand_users ──
export const brandUsers = pgTable(
  "brand_users",
  {
    id: idCol(),
    brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_brand_user").on(t.brandId, t.userId),
    uniqueIndex("uq_brand_primary_user").on(t.brandId).where(sql`${t.isPrimary}`),
  ],
);

// ── 6.1 services ──
export const services = pgTable(
  "services",
  {
    id: idCol(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    billingType: billingType("billing_type").notNull().default("recurring"),
    listPriceMinor: bigint("list_price_minor", { mode: "number" }).notNull().default(0),
    minPriceMinor: bigint("min_price_minor", { mode: "number" }).notNull().default(0),
    estCostMinor: bigint("est_cost_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 }).notNull().default("TRY").references(() => currencies.code),
    defaultUnit: text("default_unit").notNull().default("adet"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("20.00"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditCols,
  },
  (t) => [uniqueIndex("uq_services_code").on(t.code).where(sql`${t.deletedAt} IS NULL`)],
);

// ── 8.1 recurrence_rules (yalnız zamanlama) ──
export const recurrenceRules = pgTable("recurrence_rules", {
  id: idCol(),
  frequency: recurrenceFrequency("frequency").notNull(),
  intervalCount: smallint("interval_count").notNull().default(1),
  dayOfMonth: smallint("day_of_month"),
  dayOfWeek: smallint("day_of_week"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  maxOccurrences: integer("max_occurrences"),
  lastGeneratedOn: date("last_generated_on"),
  occurrenceCount: integer("occurrence_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── 7.1 contracts (v1.1: recurrence_rule_id YOK; amount = tek doğruluk kaynağı, KDV hariç net) ──
export const contracts = pgTable(
  "contracts",
  {
    id: idCol(),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    contractNo: text("contract_no").notNull(), // PRV-YYYY-NNNN
    title: text("title").notNull(),
    status: contractStatus("status").notNull().default("draft"),
    pricingModel: pricingModel("pricing_model").notNull().default("fixed_monthly"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    renewalDate: date("renewal_date"),
    autoRenew: boolean("auto_renew").notNull().default(false),
    // Dönem başına, KDV hariç, indirim sonrası net tutar — TEK DOĞRULUK KAYNAĞI
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull().default("1"),
    amountBaseMinor: bigint("amount_base_minor", { mode: "number" }).notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("20.00"),
    vatIncluded: boolean("vat_included").notNull().default(false),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    paymentDay: smallint("payment_day"),
    paymentTermsDays: smallint("payment_terms_days").notNull().default(0),
    paymentMethod: text("payment_method"),
    priceIncreasePeriod: text("price_increase_period"),
    nextPriceReviewDate: date("next_price_review_date"),
    terminationTerms: text("termination_terms"),
    notes: text("notes"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason"),
    ...auditCols,
  },
  (t) => [
    uniqueIndex("uq_contracts_no").on(t.contractNo).where(sql`${t.deletedAt} IS NULL`),
    index("idx_contracts_brand").on(t.brandId).where(sql`${t.deletedAt} IS NULL`),
    index("idx_contracts_end_date").on(t.endDate).where(sql`${t.status} = 'active' AND ${t.deletedAt} IS NULL`),
  ],
);

// ── 7.2 contract_items (kapsam sözleşmesi — faturalamaya girmez) ──
export const contractItems = pgTable(
  "contract_items",
  {
    id: idCol(),
    contractId: uuid("contract_id").notNull().references(() => contracts.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id),
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("adet"),
    period: text("period").notNull().default("monthly"),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull().default(0),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    estCostMinor: bigint("est_cost_minor", { mode: "number" }).notNull().default(0),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...auditCols,
  },
  (t) => [index("idx_contract_items").on(t.contractId).where(sql`${t.deletedAt} IS NULL`)],
);

// ── 8.2 recurring_templates (motorun tek kaynağı) ──
export const recurringTemplates = pgTable(
  "recurring_templates",
  {
    id: idCol(),
    recurrenceRuleId: uuid("recurrence_rule_id").notNull().references(() => recurrenceRules.id),
    targetType: obligationTarget("target_type").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    brandId: uuid("brand_id").references(() => brands.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    serviceId: uuid("service_id").references(() => services.id),
    categoryId: uuid("category_id"),
    vendorId: uuid("vendor_id"),
    defaultAccountId: uuid("default_account_id"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("20.00"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...auditCols,
  },
  (t) => [index("idx_templates_active").on(t.targetType).where(sql`${t.isActive} AND ${t.deletedAt} IS NULL`)],
);

// ── settings ──
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid("updated_by_id").references(() => users.id),
});
