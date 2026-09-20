/**
 * Server-side permission layer (Spec 2.17).
 * UI visibility is not authorization.
 */

export type AppRole = "Admin" | "Site Engineer";

export type Permission =
  | "projects.read"
  | "projects.create"
  | "projects.update"
  | "projects.archive"
  | "boq.read"
  | "boq.update_installed"
  | "boq.update_all"
  | "blockers.create"
  | "blockers.resolve"
  | "blockers.read"
  | "users.manage"
  | "activity.read"
  | "compliance.read"
  | "reports.export"
  | "attachments.read"
  | "assignments.manage";

const ADMIN: ReadonlySet<Permission> = new Set([
  "projects.read",
  "projects.create",
  "projects.update",
  "projects.archive",
  "boq.read",
  "boq.update_installed",
  "boq.update_all",
  "blockers.create",
  "blockers.resolve",
  "blockers.read",
  "users.manage",
  "activity.read",
  "compliance.read",
  "reports.export",
  "attachments.read",
  "assignments.manage",
]);

const ENGINEER: ReadonlySet<Permission> = new Set([
  "projects.read",
  "boq.read",
  "boq.update_installed",
  "blockers.create",
  "blockers.read",
  "activity.read",
  "reports.export",
  "attachments.read",
]);

const BY_ROLE: Record<AppRole, ReadonlySet<Permission>> = {
  Admin: ADMIN,
  "Site Engineer": ENGINEER,
};

export function hasPermission(role: string, permission: Permission): boolean {
  const set = BY_ROLE[role as AppRole];
  return !!set && set.has(permission);
}

export function assertPermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

export function permissionsFor(role: string): Permission[] {
  const set = BY_ROLE[role as AppRole];
  return set ? [...set] : [];
}
