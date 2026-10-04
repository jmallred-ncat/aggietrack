export function getMigrateUrl() {
    const raw = process.env.DATABASE_URL_UNPOOLED
        ?? process.env.POSTGRES_URL_NON_POOLING
        ?? process.env.DIRECT_URL
        ?? process.env.DATABASE_URL;

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
