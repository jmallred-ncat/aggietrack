import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";
import { PrismaClient } from "./generated/prisma/client";

neonConfig.webSocketConstructor = ws;

function sanitizeConnectionString(raw: string) {
    try {
        const url = new URL(raw);
        url.searchParams.delete("channel_binding");
        return url.toString();
    } catch {
        return raw;
    }
}

function getConnectionString() {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
        throw new Error("DATABASE_URL is not set");
    }
    return sanitizeConnectionString(raw);
}

function createAdapter() {
    const connectionString = getConnectionString();
    if (connectionString.includes("neon.tech")) {
        return new PrismaNeon({ connectionString });
    }
    return new PrismaPg({ connectionString });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    adapter: createAdapter(),
});

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
