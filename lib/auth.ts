import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
    baseURL: {
        allowedHosts: [
            "localhost:*",
            "*.vercel.app",
        ],
        protocol: process.env.NODE_ENV === "production" ? "https" : "http",
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
    }
});