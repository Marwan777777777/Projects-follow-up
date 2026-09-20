/**
 * Shared mutation service for daily updates, blockers, and project reads.
 * All tenant writes go through withTenant.
 */

import { createHash, randomUUID } from "crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { withTenant, type SessionLike } from "@/db/tenant";
import { assertPermission } from "@/lib/permissions";
import { requestFingerprint } from "@/lib/fingerprint";
import { AppError } from "@/lib/errors";
import { FUTURE_SKEW_MS, OFFLINE_WINDOW_MS } from "@/lib/constants";
import { linkAttachmentsToSubmission } from "@/services/attachments";

async function auditEvent(
  client: PoolClient,
  args: {
    actorId: string;
    projectId: string | null;
    submissionId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  }
) {
  await client.query(
    `SELECT append_activity_event(
      $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7, $8, $9
    )`,
    [
      args.actorId,
      args.projectId,
      args.submissionId,
      args.action,
      args.entityType,
      args.entityId,
      args.field ?? null,
      args.oldValue ?? null,
      args.newValue ?? null,
    ]
  );
}

async function assertAssigned(
  client: PoolClient,
  projectId: string,
  userId: string,
  role: string
) {
  if (role === "Admin") {
    const p = await client.query(`SELECT id FROM projects WHERE id = $1 AND archived_at IS NULL`, [
      projectId,
    ]);
    if (!p.rows.length) throw new AppError(404, "Project not found");
    return;
  }
  const r = await client.query(
    `SELECT a.id FROM project_assignments a
     JOIN projects p ON p.id = a.project_id
     WHERE a.project_id = $1 AND a.user_id = $2 AND p.archived_at IS NULL`,
    [projectId, userId]
  );
  if (!r.rows.length) throw new AppError(403, "Not assigned to this project");
}

export type DailyUpdateInput = {
  submissionId: string;
  projectId: string;
  kind?: "daily_update";
  noChange?: boolean;
  notes?: string;
  projectStatus?: string;
  currentPhase?: string;
  clientSubmittedAt?: string;
  boq?: Array<{ id: string; installedQty: number; version: number }>;
  attachmentIds?: string[];
};

function validateClientTime(iso?: string): Date | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) {
    throw new AppError(400, "Invalid client_submitted_at");
  }
  const now = Date.now();
  if (t.getTime() > now + FUTURE_SKEW_MS) {
    throw new AppError(400, "Client timestamp is too far in the future");
  }
  if (t.getTime() < now - OFFLINE_WINDOW_MS) {
    throw new AppError(
      400,
      "This draft is too old to be submitted for its original date. Submit as today with a new submission ID."
    );
  }
  return t;
}

export async function submitDailyUpdate(session: SessionLike, input: DailyUpdateInput) {
  assertPermission(session.user.role, "boq.update_installed");

  const submissionId = input.submissionId?.trim();
  if (!submissionId) throw new AppError(400, "submissionId is required");
  const projectId = input.projectId;
  if (!projectId) throw new AppError(400, "projectId is required");

  const clientTs = validateClientTime(input.clientSubmittedAt);
  const attachmentIds = [...new Set((input.attachmentIds || []).filter(Boolean))].sort();

  const fingerprintPayload = {
    submission_id: submissionId,
    org_id: session.user.orgId,
    project_id: projectId,
    user_id: session.user.id,
    kind: "daily_update",
    no_change: !!input.noChange,
    notes: input.notes ?? "",
    project_status: input.projectStatus ?? null,
    current_phase: input.currentPhase ?? null,
    boq: (input.boq ?? [])
      .map((b) => ({
        id: b.id,
        installed_qty: Number(b.installedQty),
        version: b.version,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    attachment_ids: attachmentIds,
  };
  const fingerprint = requestFingerprint(fingerprintPayload);

  return withTenant(session, async (client) => {
    await assertAssigned(client, projectId, session.user.id, session.user.role);

    const existing = await client.query(
      `SELECT id, request_fingerprint, project_id, user_id, kind
       FROM submissions WHERE id = $1`,
      [submissionId]
    );

    if (existing.rows.length) {
      const row = existing.rows[0];
      if (row.request_fingerprint === fingerprint) {
        return { ok: true, replay: true, submissionId };
      }
      throw new AppError(
        409,
        "This submission ID has already been used for a different request",
        { submissionId }
      );
    }

    const conflicts: Array<Record<string, unknown>> = [];

    if (!input.noChange && input.boq?.length) {
      for (const line of input.boq) {
        const qty = Number(line.installedQty);
        if (!Number.isFinite(qty) || qty < 0) {
          throw new AppError(400, "Invalid installed quantity");
        }
        const cur = await client.query(
          `SELECT id, installed_qty, delivered_qty, po_qty, version, item_no, item_description
           FROM boq_items WHERE id = $1 AND project_id = $2`,
          [line.id, projectId]
        );
        if (!cur.rows.length) throw new AppError(404, "BOQ item not found");
        const row = cur.rows[0];
        if (Number(row.version) !== Number(line.version)) {
          conflicts.push({
            id: row.id,
            item_no: row.item_no,
            latest: {
              installed_qty: row.installed_qty,
              delivered_qty: row.delivered_qty,
              version: row.version,
            },
          });
          continue;
        }
        if (qty > Number(row.delivered_qty)) {
          throw new AppError(
            400,
            `Installed qty cannot exceed delivered qty for item ${row.item_no}`
          );
        }
      }
    }

    if (conflicts.length) {
      throw new AppError(409, "Stale BOQ versions", { conflicts });
    }

    await client.query(
      `INSERT INTO submissions (
         id, org_id, project_id, user_id, kind, submitted_at, client_submitted_at,
         request_fingerprint, notes, no_change
       ) VALUES ($1,$2,$3,$4,'daily_update', now(), $5, $6, $7, $8)`,
      [
        submissionId,
        session.user.orgId,
        projectId,
        session.user.id,
        clientTs,
        fingerprint,
        input.notes ?? null,
        !!input.noChange,
      ]
    );

    if (!input.noChange && input.boq?.length) {
      for (const line of input.boq) {
        const cur = await client.query(
          `SELECT installed_qty, version FROM boq_items WHERE id = $1`,
          [line.id]
        );
        const old = cur.rows[0];
        if (Number(old.installed_qty) === Number(line.installedQty)) continue;

        const upd = await client.query(
          `UPDATE boq_items
           SET installed_qty = $1, version = version + 1, updated_at = now()
           WHERE id = $2 AND version = $3
           RETURNING id, installed_qty, version`,
          [line.installedQty, line.id, line.version]
        );
        if (!upd.rows.length) {
          throw new AppError(409, "Stale BOQ versions");
        }
        await auditEvent(client, {
          actorId: session.user.id,
          projectId,
          submissionId,
          action: "update",
          entityType: "boq_item",
          entityId: line.id,
          field: "installed_qty",
          oldValue: String(old.installed_qty),
          newValue: String(line.installedQty),
        });
      }
    }

    if (input.projectStatus || input.currentPhase) {
      const proj = await client.query(
        `SELECT project_status, current_phase, version FROM projects WHERE id = $1`,
        [projectId]
      );
      const p = proj.rows[0];
      const sets: string[] = ["updated_at = now()", "version = version + 1"];
      const vals: unknown[] = [];
      if (input.projectStatus && input.projectStatus !== p.project_status) {
        vals.push(input.projectStatus);
        sets.push(`project_status = $${vals.length}`);
      }
      if (input.currentPhase && input.currentPhase !== p.current_phase) {
        vals.push(input.currentPhase);
        sets.push(`current_phase = $${vals.length}`);
      }
      if (vals.length) {
        vals.push(projectId);
        await client.query(
          `UPDATE projects SET ${sets.join(", ")} WHERE id = $${vals.length}`,
          vals
        );
        if (input.projectStatus && input.projectStatus !== p.project_status) {
          await auditEvent(client, {
            actorId: session.user.id,
            projectId,
            submissionId,
            action: "update",
            entityType: "project",
            entityId: projectId,
            field: "status",
            oldValue: p.project_status,
            newValue: input.projectStatus,
          });
        }
        if (input.currentPhase && input.currentPhase !== p.current_phase) {
          await auditEvent(client, {
            actorId: session.user.id,
            projectId,
            submissionId,
            action: "update",
            entityType: "project",
            entityId: projectId,
            field: "current_phase",
            oldValue: p.current_phase,
            newValue: input.currentPhase,
          });
        }
      }
    }

    if (input.noChange) {
      await auditEvent(client, {
        actorId: session.user.id,
        projectId,
        submissionId,
        action: "update",
        entityType: "project",
        entityId: projectId,
        field: "no_change",
        oldValue: null,
        newValue: "true",
      });
    }

    if (input.notes) {
      await auditEvent(client, {
        actorId: session.user.id,
        projectId,
        submissionId,
        action: "update",
        entityType: "project",
        entityId: projectId,
        field: "notes",
        oldValue: null,
        newValue: input.notes,
      });
    }

    if (attachmentIds.length) {
      await linkAttachmentsToSubmission(client, {
        orgId: session.user.orgId,
        userId: session.user.id,
        projectId,
        submissionId,
        attachmentIds,
      });
    }

    return { ok: true, replay: false, submissionId };
  });
}

export async function raiseBlocker(
  session: SessionLike,
  input: {
    projectId: string;
    description: string;
    severity: "Low" | "Medium" | "High";
    attachmentIds?: string[];
  }
) {
  assertPermission(session.user.role, "blockers.create");
  const description = input.description?.trim();
  if (!description) throw new AppError(400, "Description is required");
  if (!["Low", "Medium", "High"].includes(input.severity)) {
    throw new AppError(400, "Invalid severity");
  }

  const submissionId = randomUUID();
  const attachmentIds = [...new Set((input.attachmentIds || []).filter(Boolean))];

  return withTenant(session, async (client) => {
    await assertAssigned(client, input.projectId, session.user.id, session.user.role);

    const res = await client.query(
      `INSERT INTO blockers (
         org_id, project_id, raised_by, description, severity, status
       ) VALUES ($1,$2,$3,$4,$5,'Open')
       RETURNING id, project_id, description, severity, status, raised_at`,
      [session.user.orgId, input.projectId, session.user.id, description, input.severity]
    );
    const row = res.rows[0];

    const fp = requestFingerprint({
      kind: "blocker",
      blocker_id: row.id,
      project_id: input.projectId,
      user_id: session.user.id,
      attachment_ids: attachmentIds,
    });

    await client.query(
      `INSERT INTO submissions (
         id, org_id, project_id, user_id, kind, request_fingerprint, notes, no_change
       ) VALUES ($1,$2,$3,$4,'blocker',$5,$6,false)`,
      [submissionId, session.user.orgId, input.projectId, session.user.id, fp, description]
    );

    if (attachmentIds.length) {
      await linkAttachmentsToSubmission(client, {
        orgId: session.user.orgId,
        userId: session.user.id,
        projectId: input.projectId,
        submissionId,
        attachmentIds,
        blockerId: row.id,
      });
    }

    await auditEvent(client, {
      actorId: session.user.id,
      projectId: input.projectId,
      submissionId,
      action: "create",
      entityType: "blocker",
      entityId: row.id,
      newValue: JSON.stringify({
        description,
        severity: input.severity,
      }),
    });

    return row;
  });
}

export async function resolveBlocker(
  session: SessionLike,
  input: { blockerId: string; resolutionNote?: string }
) {
  assertPermission(session.user.role, "blockers.resolve");

  return withTenant(session, async (client) => {
    const cur = await client.query(
      `SELECT id, project_id, status, raised_by FROM blockers WHERE id = $1`,
      [input.blockerId]
    );
    if (!cur.rows.length) throw new AppError(404, "Blocker not found");
    const b = cur.rows[0];
    if (b.status === "Resolved") return b;

    const res = await client.query(
      `UPDATE blockers
       SET status = 'Resolved', resolved_at = now(), resolved_by = $1,
           resolution_note = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, project_id, status, resolution_note, resolved_at`,
      [session.user.id, input.resolutionNote?.trim() || null, input.blockerId]
    );
    const row = res.rows[0];

    const submissionId = randomUUID();
    const fp = createHash("sha256")
      .update(`resolve:${row.id}:${session.user.id}`)
      .digest("hex");
    await client.query(
      `INSERT INTO submissions (
         id, org_id, project_id, user_id, kind, request_fingerprint, notes, no_change
       ) VALUES ($1,$2,$3,$4,'admin_edit',$5,$6,false)`,
      [
        submissionId,
        session.user.orgId,
        b.project_id,
        session.user.id,
        fp,
        input.resolutionNote ?? null,
      ]
    );

    await auditEvent(client, {
      actorId: session.user.id,
      projectId: b.project_id,
      submissionId,
      action: "update",
      entityType: "blocker",
      entityId: row.id,
      field: "status",
      oldValue: "Open",
      newValue: "Resolved",
    });

    return row;
  });
}

export async function listAssignedProjects(session: SessionLike) {
  assertPermission(session.user.role, "projects.read");
  return withTenant(session, async (client) => {
    const res = await client.query(
      `SELECT p.id, p.project_name, p.client_name, p.location, p.project_status,
              p.project_priority, p.current_phase, p.po_number, p.created_at,
              (SELECT count(*)::int FROM boq_items b WHERE b.project_id = p.id) AS boq_count,
              (SELECT count(*)::int FROM blockers k WHERE k.project_id = p.id AND k.status = 'Open') AS open_blockers
       FROM projects p
       JOIN project_assignments a ON a.project_id = p.id AND a.user_id = $1
       WHERE p.archived_at IS NULL
       ORDER BY p.project_name`,
      [session.user.id]
    );
    return res.rows;
  });
}

export async function getProjectDetail(session: SessionLike, projectId: string) {
  assertPermission(session.user.role, "projects.read");
  return withTenant(session, async (client) => {
    await assertAssigned(client, projectId, session.user.id, session.user.role);

    const proj = await client.query(
      `SELECT id, project_name, client_name, location, po_number, contract_number,
              project_status, project_priority, current_phase, version, project_solutions,
              planned_start_date, target_completion_date
       FROM projects WHERE id = $1`,
      [projectId]
    );
    if (!proj.rows.length) throw new AppError(404, "Project not found");

    const boq = await client.query(
      `SELECT id, sort_order, item_no, item_description, unit, po_qty, delivered_qty,
              installed_qty, notes, version
       FROM boq_items WHERE project_id = $1 ORDER BY sort_order, item_no`,
      [projectId]
    );

    const assignees = await client.query(
      `SELECT u.id, u.full_name, u.username, u.role
       FROM project_assignments a
       JOIN users u ON u.id = a.user_id
       WHERE a.project_id = $1
       ORDER BY u.full_name`,
      [projectId]
    );

    const blockers = await client.query(
      `SELECT b.id, b.description, b.severity, b.status, b.raised_at, b.resolved_at,
              b.resolution_note, u.full_name AS raised_by_name
       FROM blockers b
       JOIN users u ON u.id = b.raised_by
       WHERE b.project_id = $1
       ORDER BY b.raised_at DESC`,
      [projectId]
    );

    const history = await client.query(
      `SELECT s.id, s.kind, s.submitted_at, s.client_submitted_at, s.notes, s.no_change,
              u.full_name AS actor_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       WHERE s.project_id = $1
       ORDER BY s.submitted_at DESC
       LIMIT 50`,
      [projectId]
    );

    const attachments = await client.query(
      `SELECT id, file_name, file_type, size_bytes, status, uploaded_at, created_at,
              submission_id, blocker_id
       FROM attachments
       WHERE project_id = $1 AND status = 'ready' AND deleted_at IS NULL
       ORDER BY coalesce(uploaded_at, created_at) DESC
       LIMIT 100`,
      [projectId]
    );

    return {
      project: proj.rows[0],
      boq: boq.rows,
      assignees: assignees.rows,
      blockers: blockers.rows,
      history: history.rows,
      attachments: attachments.rows,
    };
  });
}

export async function listBlockers(
  session: SessionLike,
  filters?: { status?: string; projectId?: string }
) {
  assertPermission(session.user.role, "blockers.read");
  return withTenant(session, async (client) => {
    const params: unknown[] = [];
    const where: string[] = ["1=1"];
    if (filters?.status) {
      params.push(filters.status);
      where.push(`b.status = $${params.length}`);
    }
    if (filters?.projectId) {
      params.push(filters.projectId);
      where.push(`b.project_id = $${params.length}`);
    }
    if (session.user.role === "Site Engineer") {
      params.push(session.user.id);
      where.push(
        `EXISTS (SELECT 1 FROM project_assignments a WHERE a.project_id = b.project_id AND a.user_id = $${params.length})`
      );
    }
    const res = await client.query(
      `SELECT b.id, b.project_id, p.project_name, b.description, b.severity, b.status,
              b.raised_at, b.resolved_at, b.resolution_note, u.full_name AS raised_by_name
       FROM blockers b
       JOIN projects p ON p.id = b.project_id
       JOIN users u ON u.id = b.raised_by
       WHERE ${where.join(" AND ")}
       ORDER BY b.status ASC, b.raised_at DESC`,
      params
    );
    return res.rows;
  });
}

export async function listActivity(session: SessionLike, limit = 80) {
  assertPermission(session.user.role, "activity.read");
  return withTenant(session, async (client) => {
    const params: unknown[] = [Math.min(limit, 200)];
    let scope = "";
    if (session.user.role === "Site Engineer") {
      params.push(session.user.id);
      scope = `AND (
        a.actor_id = $2
        OR EXISTS (
          SELECT 1 FROM project_assignments pa
          WHERE pa.project_id = a.project_id AND pa.user_id = $2
        )
      )`;
    }
    const res = await client.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.field, a.old_value, a.new_value,
              a.timestamp, a.created_at, a.project_id, p.project_name, u.full_name AS actor_name
       FROM activity_log a
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE 1=1 ${scope}
       ORDER BY COALESCE(a.timestamp, a.created_at) DESC
       LIMIT $1`,
      params
    );
    return res.rows;
  });
}

export async function dashboardStats(session: SessionLike) {
  assertPermission(session.user.role, "projects.read");
  return withTenant(session, async (client) => {
    const counts = await client.query(
      `SELECT
         count(*) FILTER (WHERE archived_at IS NULL)::int AS total,
         count(*) FILTER (WHERE archived_at IS NULL AND project_status IN ('In Progress','Delayed'))::int AS active,
         count(*) FILTER (WHERE archived_at IS NULL AND project_status = 'On Hold')::int AS on_hold,
         count(*) FILTER (WHERE archived_at IS NULL AND project_status = 'Completed')::int AS completed
       FROM projects`
    );
    const openBlockers = await client.query(
      `SELECT count(*)::int AS c FROM blockers WHERE status = 'Open'`
    );
    return {
      projects: counts.rows[0],
      openBlockers: openBlockers.rows[0]?.c ?? 0,
    };
  });
}
