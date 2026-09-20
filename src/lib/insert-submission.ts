/**
 * Race-safe submission insert. PRIMARY KEY is (org_id, id).
 * Concurrent retries with the same fingerprint replay; a different payload 409s.
 */
import type { PoolClient } from "@neondatabase/serverless";
import { AppError } from "@/lib/errors";

export type SubmissionKind = "daily_update" | "blocker" | "admin_edit" | "attachment";

export async function insertSubmissionIdempotent(
  client: PoolClient,
  args: {
    id: string;
    orgId: string;
    projectId: string;
    userId: string;
    kind: SubmissionKind;
    fingerprint: string;
    notes?: string | null;
    noChange?: boolean;
    clientSubmittedAt?: Date | null;
  }
): Promise<{ replay: boolean }> {
  const inserted = await client.query(
    `INSERT INTO submissions (
       id, org_id, project_id, user_id, kind, submitted_at, client_submitted_at,
       request_fingerprint, notes, no_change
     ) VALUES ($1,$2,$3,$4,$5, now(), $6, $7, $8, $9)
     ON CONFLICT (org_id, id) DO NOTHING
     RETURNING id`,
    [
      args.id,
      args.orgId,
      args.projectId,
      args.userId,
      args.kind,
      args.clientSubmittedAt ?? null,
      args.fingerprint,
      args.notes ?? null,
      !!args.noChange,
    ]
  );
  if (inserted.rows.length) return { replay: false };

  const existing = await client.query(
    `SELECT request_fingerprint FROM submissions WHERE id = $1`,
    [args.id]
  );
  if (!existing.rows.length) {
    throw new AppError(500, "Submission conflict could not be resolved");
  }
  if (existing.rows[0].request_fingerprint === args.fingerprint) {
    return { replay: true };
  }
  throw new AppError(
    409,
    "This submission ID has already been used for a different request",
    { submissionId: args.id }
  );
}
