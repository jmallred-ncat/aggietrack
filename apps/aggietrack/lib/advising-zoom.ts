/** A Zoom link may be shown as a link only after this allowlist accepts it. */

export type ZoomCheck =
    | { ok: true; url: string }
    | { ok: false; reason: "empty" | "unsafe" };

export function zoomFailure(input: string): { title: string; description: string } | null {
    const trimmed = input.trim();
    if (!trimmed) {
        return { title: "Enter a Zoom link", description: "Paste the https link for this session." };
    }
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return { title: "Check the Zoom link", description: "Enter a valid Zoom URL." };
    }
    if (url.protocol === "http:") {
        return { title: "Use a secure link", description: "The link must start with https://." };
    }
    if (url.protocol !== "https:") {
        return { title: "Check the Zoom link", description: "Enter a valid Zoom URL." };
    }
    if (url.username || url.password) {
        return { title: "Use a Zoom link", description: "Use a zoom.us address." };
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (host !== "zoom.us" && !host.endsWith(".zoom.us")) {
        return { title: "Use a Zoom link", description: "Use a zoom.us address." };
    }
    if (!normalizeZoomUrl(trimmed).ok) {
        return { title: "Check the Zoom link", description: "Enter a valid Zoom URL." };
    }
    return null;
}

export function normalizeZoomUrl(input: string): ZoomCheck {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, reason: "empty" };
    if (trimmed.length > 2000) return { ok: false, reason: "unsafe" };
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) return { ok: false, reason: "unsafe" };

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return { ok: false, reason: "unsafe" };
    }
    if (url.protocol !== "https:") return { ok: false, reason: "unsafe" };
    if (url.username || url.password) return { ok: false, reason: "unsafe" };
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (host !== "zoom.us" && !host.endsWith(".zoom.us")) return { ok: false, reason: "unsafe" };
    if (host.includes("..")) return { ok: false, reason: "unsafe" };
    url.hash = "";
    return { ok: true, url: url.toString() };
}
