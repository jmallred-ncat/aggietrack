import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { ac, admin as adminRole, advisor, student } from "./permissions";
import { prisma } from "./prisma";

const APP_ROLES = ["STUDENT", "ADVISOR", "ADMIN"] as const;

function resolveAppRole(role: unknown) {
    return APP_ROLES.includes(role as (typeof APP_ROLES)[number])
        ? role
        : "STUDENT";
}

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: {
        allowedHosts: [
            "localhost:*",
            "127.0.0.1:*",
            "*.vercel.app",
        ],
        fallback: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        protocol: "auto",
    },
    trustedOrigins: [
        "http://localhost:*",
        "https://*.vercel.app",
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
                async before(user: { role?: unknown }) {
                    return { data: { ...user, role: resolveAppRole(user.role) } };
                },
            },
            update: {
                async before(user: { role?: unknown }) {
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
