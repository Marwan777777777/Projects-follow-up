/**
 * Single audit helper.
 * Actor is read inside append_activity_log from app.current_user_id GUC.
 * Never pass actor from client / service payload.
 */
import type { PoolClient } from "@neondatabase/serverless";

export async function auditEvent(
  client: PoolClient,
  args: {
    projectId?: string | null;
    submissionId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  await client.query(
    `SELECT append_activity_log(
      $1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb
    )`,
    [
      args.projectId ?? null,
      args.submissionId ?? null,
      args.action,
      args.entityType,
      args.entityId ?? null,
      args.field ?? null,
      args.oldValue ?? null,
      args.newValue ?? null,
      args.oldValues ? JSON.stringify(args.oldValues) : null,
      args.newValues ? JSON.stringify(args.newValues) : null,
      args.metadata ? JSON.stringify(args.metadata) : null,
    ]
  );
}
