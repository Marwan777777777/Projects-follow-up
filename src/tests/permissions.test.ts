/**
 * Permission layer tests (Spec 10.23) — no DB required.
 *   npx tsx src/tests/permissions.test.ts
 */

import { hasPermission, permissionsFor } from "../lib/permissions";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok ", msg);
}

assert(hasPermission("Admin", "users.manage"), "Admin can manage users");
assert(hasPermission("Admin", "boq.update_all"), "Admin can update all BOQ");
assert(!hasPermission("Site Engineer", "users.manage"), "Engineer cannot manage users");
assert(!hasPermission("Site Engineer", "boq.update_all"), "Engineer cannot update PO/delivered");
assert(hasPermission("Site Engineer", "boq.update_installed"), "Engineer can update installed qty");
assert(hasPermission("Site Engineer", "blockers.create"), "Engineer can raise blockers");
assert(!hasPermission("Site Engineer", "blockers.resolve"), "Engineer cannot resolve blockers");
assert(!hasPermission("Admin", "projects.read") === false, "Admin can read projects");
assert(permissionsFor("Site Engineer").includes("projects.read"), "Engineer can read assigned projects");
assert(!hasPermission("Nobody", "projects.read"), "Unknown role has no permissions");

console.log("\nPermission tests passed.");
