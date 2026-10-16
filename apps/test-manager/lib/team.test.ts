import assert from "node:assert/strict";
import { test } from "node:test";
import { organizationAssignment } from "./members";
import { memberActionError } from "./team";

const actor = "admin@example.test";

test("team guards refuse self-removal, removing the last admin, and revoking a verified member", () => {
  assert.equal(memberActionError(actor, { email: actor, role: "admin", emailVerified: true }, "remove", 2), "You cannot remove yourself.");
  assert.equal(memberActionError(actor, { email: "only@example.test", role: "admin", emailVerified: true }, "remove", 1), "The last admin cannot be removed.");
  assert.equal(memberActionError(actor, { email: "member@example.test", role: "user", emailVerified: true }, "revoke", 2), "Verified members are removed, not revoked.");
  assert.equal(memberActionError(actor, { email: "member@example.test", role: "user", emailVerified: true }, "promote", 2), null);
  assert.equal(memberActionError(actor, { email: "other@example.test", role: "admin", emailVerified: true }, "demote", 2), null);
});

test("an organization role is separate from admin access", () => {
  assert.deepEqual(organizationAssignment("  Quality coordinator  ", " Owns the release. "), { organizationRole: "Quality coordinator", responsibilities: "Owns the release." });
  assert.deepEqual(organizationAssignment("", ""), { organizationRole: "", responsibilities: "" });
  assert.throws(() => organizationAssignment("x".repeat(81), ""), /80/);
  assert.throws(() => organizationAssignment("Tester", "x".repeat(401)), /400/);
});
