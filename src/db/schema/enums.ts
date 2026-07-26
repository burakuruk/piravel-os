import { pgEnum } from "drizzle-orm/pg-core";

// Şema v1.2 — Bölüm 2: Enum tipleri

export const userRole = pgEnum("user_role", ["super_admin", "finance", "operations", "member"]);

// v1.1: 'payment_overdue' yok — ödeme riski receivable'lardan türetilir (v_brand_payment_risk)
export const brandStatus = pgEnum("brand_status", [
  "lead",
  "proposal_sent",
  "active",
  "suspended",
  "churned",
]);

export const contractStatus = pgEnum("contract_status", ["draft", "active", "ended", "cancelled"]);

export const billingType = pgEnum("billing_type", ["one_time", "recurring"]);

export const pricingModel = pgEnum("pricing_model", [
  "fixed_monthly",
  "one_time_project",
  "hourly",
  "per_service",
  "ad_budget_commission",
  "revenue_commission",
  "package_plus_extra",
  "installment",
]);

export const obligationStatus = pgEnum("obligation_status", [
  "draft",
  "pending",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
]);

export const obligationTarget = pgEnum("obligation_target", ["receivable", "payable"]);

export const transactionDirection = pgEnum("transaction_direction", ["in", "out"]);

// v1.1: credit_card / virtual_card v0.2'ye ertelendi (borç hesabı modeli)
export const accountType = pgEnum("account_type", ["bank", "cash", "payment_gateway"]);

export const recurrenceFrequency = pgEnum("recurrence_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
]);

export const taxType = pgEnum("tax_type", ["kdv", "kdv_tevkifat", "stopaj", "other"]);

export const taskStatus = pgEnum("task_status", [
  "todo",
  "in_progress",
  "in_review",
  "client_approval",
  "revision",
  "done",
  "cancelled",
]);

export const taskPriority = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);

export const auditAction = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "restore",
  "reverse",
  "login",
  "login_failed",
  "logout",
  "export",
  "download",
  "view_sensitive",
]);

export const notificationChannel = pgEnum("notification_channel", ["in_app", "email"]);
