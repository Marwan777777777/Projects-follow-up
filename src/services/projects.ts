/**
 * Project mutations (Slice 2 / 2.5)
 * All writes go through withTenant (SET ROLE app_user + GUC) + append_activity_log
 */

import type { PoolClient } from "@neondatabase/serverless";
import { assertPermission } from "@/lib/permissions";
import { withTenant, type SessionLike } from "@/db/tenant";

export type CreateProjectInput = {
  projectName: string;
  clientName: string;
  location?: string;
  poNumber?: string;
  projectStatus?: string;
  projectPriority?: string;
  currentPhase?: string;
};

export type BoqLineInput = {
  itemNo: string;
  itemDescription: string;
  unit?: string;
  poQty: number;
  deliveredQty?: number;
  sortOrder?: number;
};

async function audit(
  client: PoolClient,
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  newValues?: Record<string, unknown>
) {
  await client.query(
    `SELECT append_activity_log($1::uuid, $2, $3::uuid, $4, NULL, $5::jsonb, NULL)`,
    [actorId, entityType, entityId, action, JSON.stringify(newValues ?? null)]
  );
}

export async function createProject(
  session: SessionLike,
  input: CreateProjectInput
) {
  assertPermission(session.user.role, "projects.create");

  const name = input.projectName?.trim();
  const clientName = input.clientName?.trim();
  if (!name || !clientName) {
    throw new Error("projectName and clientName are required");
  }

  return withTenant(session, async (client) => {
    const res = await client.query(
      `INSERT INTO projects (
         org_id, project_name, client_name, location, po_number,
         project_status, project_priority, current_phase
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_name, client_name, project_status, project_priority, current_phase, created_at`,
      [
        session.user.orgId,
        name,
        clientName,
        input.location?.trim() || null,
        input.poNumber?.trim() || null,
        input.projectStatus || "Not Started Yet",
        input.projectPriority || "Medium",
        input.currentPhase || "Site Survey",
      ]
    );
    const project = res.rows[0];

    await client.query(
      `INSERT INTO submissions (
         id, org_id, project_id, user_id, kind, request_fingerprint, notes, no_change
       ) VALUES (gen_random_uuid(), $1, $2, $3, 'admin_edit', $4, 'project created', false)`,
      [session.user.orgId, project.id, session.user.id, `create:${project.id}`]
    ).catch(() => {
      /* submissions table may not exist until slice-3 migrate */
    });

    await audit(client, session.user.id, "project", project.id, "create", {
      project_name: project.project_name,
      client_name: project.client_name,
    });

    return project;
  });
}

export async function addBoqItems(
  session: SessionLike,
  projectId: string,
  items: BoqLineInput[]
) {
  assertPermission(session.user.role, "boq.update_all");
  if (!items.length) throw new Error("At least one BOQ item required");

  return withTenant(session, async (client) => {
    const proj = await client.query(`SELECT id FROM projects WHERE id = $1`, [
      projectId,
    ]);
    if (!proj.rows.length) throw new Error("Project not found");

    const inserted = [];
    for (let i = 0; i < items.length; i++) {
      const line = items[i];
      const qty = Number(line.poQty);
      const delivered =
        line.deliveredQty == null ? qty : Number(line.deliveredQty);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new Error(`Invalid poQty for item ${line.itemNo}`);
      }
      if (!Number.isFinite(delivered) || delivered < 0 || delivered > qty) {
        throw new Error(`Invalid deliveredQty for item ${line.itemNo}`);
      }
      const r = await client.query(
        `INSERT INTO boq_items (
           org_id, project_id, sort_order, item_no, item_description, unit, po_qty, delivered_qty
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, item_no, item_description, unit, po_qty, delivered_qty`,
        [
          session.user.orgId,
          projectId,
          line.sortOrder ?? i,
          line.itemNo.trim(),
          line.itemDescription.trim(),
          line.unit || "nos",
          qty,
          delivered,
        ]
      );
      const row = r.rows[0];
      inserted.push(row);

      // One audit row per BOQ item with snapshot
      await audit(client, session.user.id, "boq_item", row.id, "create", {
        project_id: projectId,
        item_no: row.item_no,
        item_description: row.item_description,
        unit: row.unit,
        po_qty: row.po_qty,
      });
    }

    return inserted;
  });
}

export async function assignEngineer(
  session: SessionLike,
  projectId: string,
  userId: string
) {
  assertPermission(session.user.role, "assignments.manage");

  return withTenant(session, async (client) => {
    const proj = await client.query(`SELECT id FROM projects WHERE id = $1`, [
      projectId,
    ]);
    if (!proj.rows.length) throw new Error("Project not found");

    const user = await client.query(
      `SELECT id, role, status FROM users WHERE id = $1`,
      [userId]
    );
    if (!user.rows.length) throw new Error("User not found");
    if (user.rows[0].status !== "Active") {
      throw new Error("Cannot assign inactive user");
    }
    // Only Site Engineer may be assigned as field engineer
    if (user.rows[0].role !== "Site Engineer") {
      throw new Error("Only Site Engineer role can be assigned to a project");
    }

    const res = await client.query(
      `INSERT INTO project_assignments (org_id, project_id, user_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO NOTHING
       RETURNING id, project_id, user_id, assigned_at`,
      [session.user.orgId, projectId, userId, session.user.id]
    );

    const row = res.rows[0];
    if (row) {
      await audit(client, session.user.id, "project_assignment", row.id, "create", {
        project_id: projectId,
        user_id: userId,
      });
    }

    return row ?? { already_assigned: true, project_id: projectId, user_id: userId };
  });
}

export async function listProjects(session: SessionLike) {
  return withTenant(session, async (client) => {
    const params: unknown[] = [];
    const join =
      session.user.role === "Site Engineer"
        ? "JOIN project_assignments a ON a.project_id = p.id AND a.user_id = $1"
        : "";
    if (session.user.role === "Site Engineer") params.push(session.user.id);
    const res = await client.query(
      `SELECT p.id, p.project_name, p.client_name, p.project_status,
              p.project_priority, p.current_phase, p.po_number, p.created_at,
              (SELECT count(*)::int FROM boq_items b WHERE b.project_id = p.id) AS boq_count,
              (SELECT count(*)::int FROM project_assignments a2 WHERE a2.project_id = p.id) AS assignee_count
       FROM projects p
       ${join}
       WHERE p.archived_at IS NULL
       ORDER BY p.created_at DESC`,
      params
    );
    return res.rows;
  });
}

export async function listOrgUsers(session: SessionLike) {
  assertPermission(session.user.role, "users.manage");
  return withTenant(session, async (client) => {
    const res = await client.query(
      `SELECT id, full_name, username, email, role, status
       FROM users
       WHERE status = 'Active'
       ORDER BY full_name`
    );
    return res.rows;
  });
}

/** Engineers only — for assignment dropdown */
export async function listEngineers(session: SessionLike) {
  assertPermission(session.user.role, "assignments.manage");
  return withTenant(session, async (client) => {
    const res = await client.query(
      `SELECT id, full_name, username, email, role, status
       FROM users
       WHERE status = 'Active' AND role = 'Site Engineer'
       ORDER BY full_name`
    );
    return res.rows;
  });
}
