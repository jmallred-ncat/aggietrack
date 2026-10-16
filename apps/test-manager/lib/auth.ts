import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, magicLink } from "better-auth/plugins";
import { getPrisma } from "./prisma";
import { personalEmail } from "./email-policy";
import { claimNameMessage, nameNeedsClaim } from "./members";
import { sendMagicLinkEmail } from "./email";
import { onSharedDatabaseReset, prepareDatabase } from "./shared-database";

// localhost and 127.0.0.1 are different origins. Local sign-in works from either host; hosted URLs stay exact.
export function trustedOriginsFor(baseURL: string) {
  const configured = new URL(baseURL);
  const origins = new Set([configured.origin]);
  if (configured.hostname === "127.0.0.1" || configured.hostname === "localhost") {
    for (const hostname of ["127.0.0.1", "localhost"]) {
      const alias = new URL(configured.origin);
      alias.hostname = hostname;
      origins.add(alias.origin);
    }
  }
  return [...origins];
}

// Explicit configuration keeps this auth silo independent of AggieTrack.
export function createTestAuth({ db = getPrisma(), secret = process.env.TEST_MANAGER_AUTH_SECRET, baseURL = process.env.TEST_MANAGER_AUTH_URL ?? "http://127.0.0.1:3001", sendMagicLink = sendMagicLinkEmail, linkLimit = 5 } = {}) {
  if (!secret || secret.length < 32) throw new Error("Set TEST_MANAGER_AUTH_SECRET to a unique secret of at least 32 characters.");
  return betterAuth({
    appName: "AggieTrack Test Manager",
    secret,
    baseURL,
    trustedOrigins: trustedOriginsFor(baseURL),
    database: prismaAdapter(db, { provider: "sqlite" }),
    emailAndPassword: { enabled: false },
    advanced: { cookiePrefix: "aggietrack-test-manager", crossSubDomainCookies: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    rateLimit: { enabled: true },
    hooks: {
      before: createAuthMiddleware(async ctx => {
        if (ctx.path !== "/sign-in/magic-link") return;
        let email: string;
        try { email = personalEmail(ctx.body?.email); }
        catch (error) { throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Use a personal email address." }); }
        ctx.body.email = email;
        const existing = await db.user.findUnique({ where: { email } });
        if (!existing) throw new APIError("FORBIDDEN", { message: "Ask an admin to invite you before signing in." });
        if (existing.emailVerified || !nameNeedsClaim(existing.name)) return;
        const name = typeof ctx.body?.name === "string" ? ctx.body.name.trim() : "";
        if (!name || name.length > 100 || name === "Admin") throw new APIError("BAD_REQUEST", { message: claimNameMessage });
        await db.user.update({ where: { email }, data: { name } });
      }),
    },
    databaseHooks: {
      user: { create: { before: async user => {
        try {
          const email = personalEmail(user.email);
          const role = typeof user.role === "string" && user.role ? user.role : "user";
          return { data: { ...user, email, role } };
        }
        catch { throw new APIError("BAD_REQUEST", { message: "Use a personal email address." }); }
      } }, update: { before: async user => {
        if (user.email === undefined) return;
        try { return { data: { ...user, email: personalEmail(user.email) } }; }
        catch { throw new APIError("BAD_REQUEST", { message: "Use a personal email address." }); }
      } } },
    },
    plugins: [
      magicLink({ expiresIn: 600, storeToken: "hashed", disableSignUp: true, rateLimit: { window: 60, max: linkLimit }, sendMagicLink }),
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
    ],
  });
}
let auth: ReturnType<typeof createTestAuth> | undefined;
onSharedDatabaseReset(() => { auth = undefined; });
export function getAuth() { return auth ??= createTestAuth(); }
export async function getWorkspaceSession(headers: Headers) {
  await prepareDatabase();
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user.emailVerified || session.user.banned) return null;
  try { personalEmail(session.user.email); } catch { return null; }
  return session;
}
