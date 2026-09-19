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
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
