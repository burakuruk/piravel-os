// Şema v1.2 — görevler, ekler, bildirimler, denetim günlüğü
import { sql } from "drizzle-orm";
import {
  bigserial,
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { auditAction, notificationChannel, taskPriority, taskStatus } from "./enums";
import { auditCols, idCol } from "./helpers";
import { brands, contracts, users } from "./core";

// ── 11 tasks ──
export const tasks = pgTable(
  "tasks",
  {
    id: idCol(),
    brandId: uuid("brand_id").references(() => brands.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: uuid("assignee_id").references(() => users.id),
    status: taskStatus("status").notNull().default("todo"),
    priority: taskPriority("priority").notNull().default("normal"),
    dueDate: date("due_date"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // v2 kancaları
    parentId: uuid("parent_id"),
    projectId: uuid("project_id"),
    estimatedMinutes: integer("estimated_minutes"),
    spentMinutes: integer("spent_minutes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...auditCols,
  },
  (t) => [
    index("idx_tasks_assignee").on(t.assigneeId, t.status).where(sql`${t.deletedAt} IS NULL`),
    index("idx_tasks_brand").on(t.brandId).where(sql`${t.deletedAt} IS NULL`),
    index("idx_tasks_overdue")
      .on(t.dueDate)
      .where(sql`${t.status} NOT IN ('done','cancelled') AND ${t.deletedAt} IS NULL`),
  ],
);

// ── 12 attachments ──
export const attachments = pgTable(
  "attachments",
  {
    id: idCol(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum"),
    category: text("category"),
    version: smallint("version").notNull().default(1),
    replacesId: uuid("replaces_id"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (t) => [index("idx_attachments_entity").on(t.entityType, t.entityId).where(sql`${t.deletedAt} IS NULL`)],
);

// ── 13 notifications ──
export const notifications = pgTable(
  "notifications",
  {
    id: idCol(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    severity: text("severity").notNull().default("info"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actionUrl: text("action_url"),
    channel: notificationChannel("channel").notNull().default("in_app"),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_notification_dedupe").on(t.userId, t.dedupeKey),
    index("idx_notifications_unread").on(t.userId, t.createdAt).where(sql`${t.readAt} IS NULL`),
  ],
);

// ── 14 audit_logs (append-only; koruma migration'da) ──
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    actorEmail: text("actor_email"),
    action: auditAction("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    entityLabel: text("entity_label"),
    changes: jsonb("changes"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /**
     * SUNUCU tarafından üretilen kanonik istek kimliği. İstemci bu değeri
     * seçemez — seçebilseydi saldırgan kendi izini başka bir isteğin
     * kimliğiyle karıştırabilir veya denetim sorgularını yanıltabilirdi.
     */
    requestId: text("request_id"),
    /**
     * İstemcinin gönderdiği x-request-id. YALNIZ bilgi amaçlıdır (dağıtık
     * izleme korelasyonu); güvenilir kabul edilmez ve sorgularda kimlik
     * yerine kullanılmaz.
     */
    upstreamRequestId: text("upstream_request_id"),
    /**
     * Test izolasyonu. YALNIZCA üretim dışı ortamlarda, x-test-run-id
     * başlığından doldurulur; üretimde daima NULL'dur.
     */
    testRunId: text("test_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_entity").on(t.entityType, t.entityId, t.createdAt),
    index("idx_audit_actor").on(t.actorId, t.createdAt),
  ],
);
