/**
 * Drizzle schema — tenant + control-plane tables
 * Source of truth for types; migrations are applied via scripts/migrate.ts
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    planTier: text("plan_tier").notNull().default("standard"),
    status: text("status").notNull().default("Active"),
    timezone: text("timezone").notNull().default("Asia/Dubai"),
    complianceCutoffTime: text("compliance_cutoff_time").notNull().default("18:00"),
    workingDays: jsonb("working_days").notNull().default([1, 2, 3, 4, 5]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("organizations_slug_idx").on(t.slug)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    fullName: text("full_name").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    email: text("email"),
    phoneNumber: text("phone_number"),
    role: text("role").notNull(),
    status: text("status").notNull().default("Active"),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    tokenVersion: integer("token_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_org_id_idx").on(t.orgId)]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    projectName: text("project_name").notNull(),
    clientName: text("client_name").notNull(),
    location: text("location"),
    poNumber: text("po_number"),
    contractNumber: text("contract_number"),
    plannedStartDate: timestamp("planned_start_date", { withTimezone: true }),
    targetCompletionDate: timestamp("target_completion_date", { withTimezone: true }),
    warrantyPeriod: text("warranty_period"),
    projectSolutions: jsonb("project_solutions").notNull().default([]),
    projectStatus: text("project_status").notNull().default("Not Started Yet"),
    projectPriority: text("project_priority").notNull().default("Medium"),
    currentPhase: text("current_phase").notNull().default("Site Survey"),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("projects_org_id_id_idx").on(t.orgId, t.id),
    index("projects_org_id_idx").on(t.orgId),
  ]
);

export const projectAssignments = pgTable(
  "project_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("project_assignments_project_user_idx").on(t.projectId, t.userId)]
);

export const boqItems = pgTable(
  "boq_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    itemNo: text("item_no").notNull(),
    itemDescription: text("item_description").notNull(),
    unit: text("unit").notNull().default("EA"),
    poQty: numeric("po_qty", { precision: 12, scale: 2 }).notNull().default("0"),
    deliveredQty: numeric("delivered_qty", { precision: 12, scale: 2 }).notNull().default("0"),
    installedQty: numeric("installed_qty", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("boq_items_org_project_idx").on(t.orgId, t.projectId)]
);

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  actorId: uuid("actor_id"),
  projectId: uuid("project_id"),
  submissionId: uuid("submission_id"),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").notNull(),
    orgId: uuid("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    kind: text("kind").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    clientSubmittedAt: timestamp("client_submitted_at", { withTimezone: true }),
    requestFingerprint: text("request_fingerprint").notNull(),
    notes: text("notes"),
    noChange: boolean("no_change").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("submissions_org_id_id_idx").on(t.orgId, t.id),
    index("submissions_org_project_idx").on(t.orgId, t.projectId),
  ]
);

export const blockers = pgTable(
  "blockers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    raisedBy: uuid("raised_by").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("Open"),
    raisedAt: timestamp("raised_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blockers_org_id_id_idx").on(t.orgId, t.id),
    index("blockers_org_project_idx").on(t.orgId, t.projectId),
  ]
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").notNull().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    projectId: uuid("project_id").notNull(),
    submissionId: uuid("submission_id"),
    blockerId: uuid("blocker_id"),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").notNull().default("pending"),
    uploadedBy: uuid("uploaded_by").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    multipartUploadId: text("multipart_upload_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attachments_org_id_id_idx").on(t.orgId, t.id),
    index("attachments_org_project_status_idx").on(t.orgId, t.projectId, t.status),
  ]
);
