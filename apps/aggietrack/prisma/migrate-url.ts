type MigrateEnv = Record<string, string | undefined>;

export function readMigrateUrl(env: MigrateEnv = process.env) {
    return env.DATABASE_URL_UNPOOLED
        ?? env.POSTGRES_URL_NON_POOLING
        ?? env.DIRECT_URL
        ?? env.DATABASE_URL;
}

export function getMigrateUrl(env: MigrateEnv = process.env) {
    const raw = readMigrateUrl(env);

    if (!raw) {
        return raw;
    }

    try {
        const url = new URL(raw);
        url.searchParams.delete("channel_binding");
        const timeout = Number(url.searchParams.get("connect_timeout"));
        if (!Number.isFinite(timeout) || timeout < 30) {
            url.searchParams.set("connect_timeout", "30");
        }
        return url.toString();
    } catch {
        return raw;
    }
}
