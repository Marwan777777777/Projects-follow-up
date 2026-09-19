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

## Slice 1 Scope (current)
- roles, organizations/users/projects/boq_items with RLS
- the isolation test
- org-code login with per-request status checks
- a minimal role-gated shell that works at 390px and 1440px
- scripts/create-org

## Pinned Stack
- Next.js App Router + TypeScript
- Neon Postgres + Drizzle ORM
- Auth.js (Credentials + JWT)
- Tailwind + shadcn/ui
- Cloudflare R2 (later)
- Resend (later)
- Vercel Cron (later)
