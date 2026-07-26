// Şema v1.2 — finans çekirdeği: kategoriler, tedarikçiler, alacak/borç, vergi,
// banka hesapları, hareketler, eşleştirme
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accountType, obligationStatus, taxType, transactionDirection } from "./enums";
import { auditCols, idCol } from "./helpers";
import { brands, contracts, currencies, services, users } from "./core";

// ── 9.3 expense_categories ──
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: idCol(),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isDirectCost: boolean("is_direct_cost").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uq_expense_cat_code").on(t.code).where(sql`${t.deletedAt} IS NULL`)],
);

// ── 9.3 vendors ──
export const vendors = pgTable("vendors", {
  id: idCol(),
  name: text("name").notNull(),
  type: text("type"),
  taxNumber: text("tax_number"),
  email: text("email"),
  phone: text("phone"),
  ibanEncrypted: text("iban_encrypted"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  ...auditCols,
});

// ── 9.1 receivables (amount = KDV HARİÇ NET; brüt v_receivable_totals'tan) ──
export const receivables = pgTable(
  "receivables",
  {
    id: idCol(),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    serviceId: uuid("service_id").references(() => services.id),
    sourceType: text("source_type").notNull().default("manual"), // manual|contract|recurrence
    sourceId: uuid("source_id"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    description: text("description").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull().default("1"),
    amountBaseMinor: bigint("amount_base_minor", { mode: "number" }).notNull(),
    issueDate: date("issue_date").notNull().defaultNow(),
    dueDate: date("due_date").notNull(),
    status: obligationStatus("status").notNull().default("pending"),
    paidMinor: bigint("paid_minor", { mode: "number" }).notNull().default(0),
    paidBaseMinor: bigint("paid_base_minor", { mode: "number" }).notNull().default(0),
    invoiceNo: text("invoice_no"),
    invoiceDate: date("invoice_date"),
    invoiceUuid: text("invoice_uuid"),
    notes: text("notes"),
    ...auditCols,
  },
  (t) => [
    uniqueIndex("uq_receivable_source")
      .on(t.sourceType, t.sourceId, t.dueDate)
      .where(sql`${t.sourceId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index("idx_receivables_brand").on(t.brandId).where(sql`${t.deletedAt} IS NULL`),
    index("idx_receivables_open")
      .on(t.dueDate, t.brandId)
      .where(sql`${t.status} IN ('pending','partially_paid','overdue') AND ${t.deletedAt} IS NULL`),
  ],
);

// ── 9.2 payables (receivables ile simetrik) ──
export const payables = pgTable(
  "payables",
  {
    id: idCol(),
    categoryId: uuid("category_id").notNull().references(() => expenseCategories.id),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    brandId: uuid("brand_id").references(() => brands.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    sourceType: text("source_type").notNull().default("manual"),
    sourceId: uuid("source_id"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    description: text("description").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull().default("1"),
    amountBaseMinor: bigint("amount_base_minor", { mode: "number" }).notNull(),
    issueDate: date("issue_date").notNull().defaultNow(),
    dueDate: date("due_date").notNull(),
    status: obligationStatus("status").notNull().default("pending"),
    paidMinor: bigint("paid_minor", { mode: "number" }).notNull().default(0),
    paidBaseMinor: bigint("paid_base_minor", { mode: "number" }).notNull().default(0),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedById: uuid("approved_by_id").references(() => users.id),
    documentNo: text("document_no"),
    notes: text("notes"),
    ...auditCols,
  },
  (t) => [
    uniqueIndex("uq_payable_source")
      .on(t.sourceType, t.sourceId, t.dueDate)
      .where(sql`${t.sourceId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index("idx_payables_open")
      .on(t.dueDate)
      .where(sql`${t.status} IN ('pending','partially_paid','overdue') AND ${t.deletedAt} IS NULL`),
    index("idx_payables_brand").on(t.brandId).where(sql`${t.brandId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

// ── 9.4 tax_lines (v1.1 — KDV/tevkifat/stopaj; işaretli tutar) ──
export const taxLines = pgTable(
  "tax_lines",
  {
    id: idCol(),
    receivableId: uuid("receivable_id").references(() => receivables.id),
    payableId: uuid("payable_id").references(() => payables.id),
    taxType: taxType("tax_type").notNull(),
    rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
    baseMinor: bigint("base_minor", { mode: "number" }).notNull(),
    // İşaretli: kdv (+), kdv_tevkifat (−), stopaj (−)
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull(),
    externalCode: text("external_code"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_tax_receivable").on(t.receivableId).where(sql`${t.receivableId} IS NOT NULL`),
    index("idx_tax_payable").on(t.payableId).where(sql`${t.payableId} IS NOT NULL`),
  ],
);

// ── 10.1 bank_accounts (v1.1: kredi kartı alanları YOK — v0.2) ──
export const bankAccounts = pgTable("bank_accounts", {
  id: idCol(),
  name: text("name").notNull(),
  bankName: text("bank_name"),
  accountType: accountType("account_type").notNull().default("bank"),
  accountHolder: text("account_holder"),
  ibanEncrypted: text("iban_encrypted"),
  ibanLast4: text("iban_last4"),
  currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
  openingBalanceMinor: bigint("opening_balance_minor", { mode: "number" }).notNull().default(0),
  openingBalanceDate: date("opening_balance_date").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  notes: text("notes"),
  ...auditCols,
});

// ── 10.2 transactions (v1.2: brand_id + refund_of_transaction_id) ──
export const transactions = pgTable(
  "transactions",
  {
    id: idCol(),
    bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccounts.id),
    direction: transactionDirection("direction").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currencyCode: char("currency_code", { length: 3 }).notNull().references(() => currencies.code),
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull().default("1"),
    amountBaseMinor: bigint("amount_base_minor", { mode: "number" }).notNull(),
    valueDate: date("value_date").notNull(),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    referenceNo: text("reference_no"),
    paymentMethod: text("payment_method"),
    // v1.2: müşteri avansı takibi — eşleşmemiş tahsilatın sahibi
    brandId: uuid("brand_id").references(() => brands.id),
    // Yalnız Piravel'in KENDİ hesapları arası virman
    transferPairId: uuid("transfer_pair_id"),
    // v1.2: müşteriye iade — iç virman DEĞİL
    refundOfTransactionId: uuid("refund_of_transaction_id"),
    unallocatedMinor: bigint("unallocated_minor", { mode: "number" }).notNull().default(0),
    importBatchId: uuid("import_batch_id"),
    externalId: text("external_id"),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    ...auditCols,
  },
  (t) => [
    index("idx_tx_account_date").on(t.bankAccountId, t.valueDate).where(sql`${t.deletedAt} IS NULL`),
    index("idx_tx_unallocated").on(t.valueDate).where(sql`${t.unallocatedMinor} > 0 AND ${t.deletedAt} IS NULL`),
    index("idx_tx_advances")
      .on(t.brandId)
      .where(sql`${t.direction} = 'in' AND ${t.unallocatedMinor} > 0 AND ${t.deletedAt} IS NULL`),
    uniqueIndex("uq_tx_external")
      .on(t.bankAccountId, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

// ── 10.3 allocations (çift tutar + reversal; UPDATE/DELETE yok) ──
export const allocations = pgTable(
  "allocations",
  {
    id: idCol(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id),
    receivableId: uuid("receivable_id").references(() => receivables.id),
    payableId: uuid("payable_id").references(() => payables.id),
    // Hareket para biriminde — transactions.unallocated_minor'dan düşülür
    txAmountMinor: bigint("tx_amount_minor", { mode: "number" }).notNull(),
    // Yükümlülük para biriminde — paid_minor'a eklenir
    obAmountMinor: bigint("ob_amount_minor", { mode: "number" }).notNull(),
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull().default("1"),
    amountBaseMinor: bigint("amount_base_minor", { mode: "number" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdById: uuid("created_by_id").references(() => users.id),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedById: uuid("reversed_by_id").references(() => users.id),
    reversalReason: text("reversal_reason"),
  },
  (t) => [
    index("idx_alloc_tx").on(t.transactionId).where(sql`${t.reversedAt} IS NULL`),
    index("idx_alloc_receivable").on(t.receivableId).where(sql`${t.receivableId} IS NOT NULL AND ${t.reversedAt} IS NULL`),
    index("idx_alloc_payable").on(t.payableId).where(sql`${t.payableId} IS NOT NULL AND ${t.reversedAt} IS NULL`),
  ],
);
