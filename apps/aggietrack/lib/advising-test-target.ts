import { readMigrateUrl } from "../prisma/migrate-url";

const scratchName = /^aggietrack_(scratch|ui_review|upgrade|probe|repair)[a-z0-9_]*$/;
const appUrlKeys = ["DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL"] as const;

export type AdvisingTestTarget =
    | { ok: true; url: string; database: string }
    | { ok: false; reason: string };

function databaseName(raw: string | undefined): string | null {
    if (!raw) return null;
    try {
        const name = decodeURIComponent(new URL(raw).pathname.replace(/^\//, ""));
        return name || null;
    } catch {
        return null;
    }
}

/** Accept only an explicit local disposable database. This never reads a fallback URL. */
type TargetEnv = Record<string, string | undefined>;

export function resolveAdvisingTestTarget(env: TargetEnv): AdvisingTestTarget {
    const raw = env.AGT17_DATABASE_URL?.trim() ?? "";
    if (!raw) return { ok: false, reason: "AGT17_DATABASE_URL is unset" };
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        return { ok: false, reason: "AGT17_DATABASE_URL is not a URL" };
    }
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        return { ok: false, reason: "AGT17_DATABASE_URL is not a postgres URL" };
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost") {
        return { ok: false, reason: "AGT17_DATABASE_URL host is not local" };
    }
    if (raw.toLowerCase().includes("neon.tech")) {
        return { ok: false, reason: "AGT17_DATABASE_URL points outside the disposable scratch" };
    }
    const name = databaseName(raw);
    if (!name || !scratchName.test(name)) {
        return { ok: false, reason: "AGT17_DATABASE_URL is not a disposable scratch database" };
    }
    for (const key of appUrlKeys) {
        if (databaseName(env[key]) === name) {
            return { ok: false, reason: `AGT17_DATABASE_URL matches ${key}` };
        }
    }
    return { ok: true, url: raw, database: name };
}

/** The connector runs only after the target is accepted. A rejection returns null first. */
export function openAdvisingTestClient<T>(target: AdvisingTestTarget, connect: (url: string) => T): T | null {
    if (!target.ok) return null;
    return connect(target.url);
}

export function migrateDatabaseName(env: TargetEnv): string | null {
    return databaseName(readMigrateUrl(env));
}

/** Point every migrate-url input at the validated scratch database before Prisma starts. */
export function migrateEnvForScratch(scratchUrl: string, baseEnv: TargetEnv): NodeJS.ProcessEnv {
    const target = resolveAdvisingTestTarget({ ...baseEnv, AGT17_DATABASE_URL: scratchUrl });
    if (!target.ok) throw new Error(target.reason);
    const next: Record<string, string | undefined> = { ...baseEnv };
    for (const key of Object.keys(next)) {
        if (key.includes("DATABASE") || key.startsWith("PG") || key.includes("POSTGRES") || key === "SEED_ON_DEPLOY") delete next[key];
    }
    next.AGT17_DATABASE_URL = target.url;
    next.DATABASE_URL = target.url;
    next.DIRECT_URL = target.url;
    next.DATABASE_URL_UNPOOLED = target.url;
    next.POSTGRES_URL_NON_POOLING = target.url;
    next.POSTGRES_URL = target.url;
    next.SEED_ON_DEPLOY = "false";
    if (migrateDatabaseName(next) !== target.database) {
        throw new Error("migrate URL did not resolve to the scratch database");
    }
    return next as NodeJS.ProcessEnv;
}
