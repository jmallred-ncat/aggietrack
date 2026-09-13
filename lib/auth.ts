import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { ac, admin as adminRole, advisor, student } from "./permissions";
import { prisma } from "./prisma";

const getBaseUrl = () => {
    if (typeof window !== "undefined") {
        return window.location.origin;
    }

    if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
    trustedOrigins: [
        "http://localhost:*",
        "https://*.vercel.app",
    ],
    protocol: process.env.NODE_ENV === "production" ? "https" : "http",
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