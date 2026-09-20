# Projects Follow Up — Master SaaS Build Specification

See the full specification provided by the product owner.
This file is the authoritative source for implementation.

**Working rules (from product owner):**
- Work ONE slice at a time. The slice plan in the task overrides Section 11 (Build Order).
- Never build anything outside the current slice's scope.
- Do not change the pinned stack, the tenant model, the identity model, or the audit-log shape.
- If the spec is ambiguous or contradicts itself, stop and ask.
- Work on a branch named slice-N. Commit in small steps. Never merge to main yourself.
- When done, STOP and send the required report format.

## Slice 3 Scope (current)
Operational loop (internal MVP):
- Assigned projects for Site Engineers
- Daily update (installed qty, status, phase, notes, no-change)
- Client-generated submission_id + fingerprint idempotency
- Local draft persistence; 72h offline window
- Blocker raise / resolve
- Activity / history feeds
- Admin dashboard KPIs (Active = In Progress + Delayed, BOQ install rate, At-Risk)
- Permission layer (no scattered role checks in new code)
- Additive schema: submissions, blockers, activity_event function

Still later: R2 attachments, cron/compliance emails, PDF export.

## Assumptions stated (12.7) for this slice
- Out-of-window timestamps are **rejected** with a recoverable error (stale-draft "submit as today" path).
- Submission kind for project creation / admin resolve = `admin_edit`; blocker raise = `blocker`.
- Zero-PO BOQ lines excluded from install-rate denominator.
- Blocker-only activity does **not** increment revision (no revision UI yet).
- Dedicated transaction for pre-auth functions remains caller-managed (existing).
- Session revalidation uses `auth_session_check` SECURITY DEFINER (existing).
- Admin phone More includes Sign out.
- Platform admin bootstrap still deferred.
