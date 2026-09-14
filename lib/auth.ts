import { betterAuth, type User } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { ac, admin as adminRole, advisor, student } from "./permissions";
import { prisma } from "./prisma";

const APP_ROLES = ["STUDENT", "ADVISOR", "ADMIN"] as const;

function resolveAppRole(role: unknown) {
    return APP_ROLES.includes(role as (typeof APP_ROLES)[number])
        ? (role as (typeof APP_ROLES)[number])
        : "STUDENT";
}

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: {
        allowedHosts: [
            "localhost:*",
            "127.0.0.1:*",
            "*.vercel.app",
            "https://*.aggietrack.space"
        ],
        fallback: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        protocol: "auto",
    },
    trustedOrigins: [
        "http://localhost:*",
        "https://*.vercel.app",
        "https://*.aggietrack.space"
    ],
    advanced: {
        trustedProxyHeaders: true,
        useSecureCookies: process.env.VERCEL === "1",
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            const { sendPasswordResetEmail } = await import("./email");
            const recipient = user as typeof user & { firstName?: string };
            await sendPasswordResetEmail(
                {
                    email: recipient.email,
                    firstName: recipient.firstName,
                    name: recipient.name,
                },
                url,
            ).catch((error) => {
                console.error("Password reset email failed:", error);
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            const { sendWelcomeEmail } = await import("./email");
            const recipient = user as typeof user & { firstName?: string };
            await sendWelcomeEmail(
                {
                    email: recipient.email,
                    firstName: recipient.firstName,
                    name: recipient.name,
                },
                url,
            ).catch((error) => {
                console.error("Welcome email failed:", error);
            });
        },
    },
    user: {
        additionalFields: {
            firstName: { type: "string", required: true },
            lastName: { type: "string", required: true },
        }
    },
    databaseHooks: {
        user: {
            create: {
                async before(user: User & Record<string, unknown>) {
                    return { data: { ...user, role: resolveAppRole(user.role) } };
                },
            },
            update: {
                async before(user: Partial<User> & Record<string, unknown>) {
                    if (!("role" in user) || user.role === undefined) {
                        return;
                    }
                    return { data: { ...user, role: resolveAppRole(user.role) } };
                },
            },
        },
    },
    plugins: [admin({
        ac,
        roles: {
            STUDENT: student,
            ADVISOR: advisor,
            ADMIN: adminRole
        },
        defaultRole: "STUDENT",
        adminRoles: ["ADMIN"]
    })]
});
