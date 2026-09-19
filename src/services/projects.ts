/**
 * Project mutations (Slice 2)
 * All writes go through withTenant + append_activity_log
 */

import type { PoolClient } from "@neondatabase/serverless";
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
  if (session.user.role !== "Admin") {
    throw new Error("Only Admin can create projects");
  }

  const name = input.projectName?.trim();
  const clientName = input.clientName?.trim();
  if (!name || !clientName) {
    throw new Error("projectName and clientName are required");
  }

  return withTenant(session, async (_db, client) => {
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

    await audit(client, session.user.id, "project", project.id, "created", {
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
  if (session.user.role !== "Admin") {
    throw new Error("Only Admin can add BOQ items");
  }
  if (!items.length) throw new Error("At least one BOQ item required");

  return withTenant(session, async (_db, client) => {
    // Verify project belongs to this tenant (RLS also enforces)
    const proj = await client.query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    );
    if (!proj.rows.length) throw new Error("Project not found");

    const inserted = [];
    for (let i = 0; i < items.length; i++) {
      const line = items[i];
      const r = await client.query(
        `INSERT INTO boq_items (
           org_id, project_id, sort_order, item_no, item_description, unit, po_qty
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, item_no, item_description, unit, po_qty`,
        [
          session.user.orgId,
          projectId,
          line.sortOrder ?? i,
          line.itemNo.trim(),
          line.itemDescription.trim(),
          line.unit || "EA",
          line.poQty,
        ]
      );
      inserted.push(r.rows[0]);
    }

    await audit(client, session.user.id, "project", projectId, "boq_items_added", {
      count: inserted.length,
      items: inserted.map((x) => x.item_no),
    });

    return inserted;
  });
}

export async function assignEngineer(
  session: SessionLike,
  projectId: string,
  userId: string
) {
  if (session.user.role !== "Admin") {
    throw new Error("Only Admin can assign engineers");
  }

  return withTenant(session, async (_db, client) => {
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

    const res = await client.query(
      `INSERT INTO project_assignments (org_id, project_id, user_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO NOTHING
       RETURNING id, project_id, user_id, assigned_at`,
      [session.user.orgId, projectId, userId, session.user.id]
    );

    const row = res.rows[0];
    if (row) {
      await audit(client, session.user.id, "project", projectId, "engineer_assigned", {
        user_id: userId,
        assignment_id: row.id,
      });
    }

    return row ?? { already_assigned: true, project_id: projectId, user_id: userId };
  });
}

export async function listProjects(session: SessionLike) {
  return withTenant(session, async (_db, client) => {
    const res = await client.query(
      `SELECT p.id, p.project_name, p.client_name, p.project_status,
              p.project_priority, p.current_phase, p.po_number, p.created_at,
              (SELECT count(*)::int FROM boq_items b WHERE b.project_id = p.id) AS boq_count,
              (SELECT count(*)::int FROM project_assignments a WHERE a.project_id = p.id) AS assignee_count
       FROM projects p
       ORDER BY p.created_at DESC`
    );
    return res.rows;
  });
}

export async function listOrgUsers(session: SessionLike) {
  if (session.user.role !== "Admin") {
    throw new Error("Only Admin can list users");
  }
  return withTenant(session, async (_db, client) => {
    const res = await client.query(
      `SELECT id, full_name, username, email, role, status
       FROM users
       WHERE status = 'Active'
       ORDER BY full_name`
    );
    return res.rows;
  });
}
