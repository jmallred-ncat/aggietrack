import { randomUUID } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client";
import { personalEmail } from "./email-policy";
import { getPrisma } from "./prisma";

// The seeded admin is unverified until that person signs in and claims the account.
export async function seedAdmin(db: PrismaClient = getPrisma(), email = process.env.TEST_MANAGER_ADMIN_EMAIL) {
  if (!email) throw new Error("Set TEST_MANAGER_ADMIN_EMAIL to the personal email that can claim the admin account.");
  const normalized = personalEmail(email);
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) return existing;
  return db.user.create({ data: { id: randomUUID(), name: "Admin", email: normalized, emailVerified: false, role: "admin", banned: false } });
}
