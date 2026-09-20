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

## Slice 3 Scope (hardening complete)
Operational loop + attachments + post-slice hardening:
- GRANT app_user membership is migration-time, not per request
- Single `append_activity_log` reads actor from `app.current_user_id`
- Race-safe submission insert (`ON CONFLICT (org_id, id)`)
- Composite FKs to users; CHECKs on kind / severity / status
- Neon tests: two-org isolation through services, idempotency, engineer scoping

## Slice 4 Scope (next)
Admin monitoring:
- Dashboard filters/search, At-Risk (exact §9.6), compliance widget
- Blocker log filters, Activity feed (engineer filter, old vs new)
- Project drill-down, PDF export, visibility-aware polling (§8.13)
- PHASE_LABELS everywhere
