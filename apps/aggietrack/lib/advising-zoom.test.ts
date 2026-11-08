import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeZoomUrl } from "./advising-zoom";

describe("Zoom allowlist", () => {
    it("accepts https zoom hosts and drops the hash", () => {
        const campus = normalizeZoomUrl("https://ncat.zoom.us/j/123?pwd=abc#section");
        assert.equal(campus.ok, true);
        if (campus.ok) assert.equal(campus.url, "https://ncat.zoom.us/j/123?pwd=abc");
        assert.equal(normalizeZoomUrl("https://zoom.us/j/1").ok, true);
    });

    it("rejects unsafe and confusing links", () => {
        for (const input of [
            "",
            "   ",
            "http://zoom.us/j/1",
            "javascript:alert(1)",
            "data:text/html,hi",
            "https://user:pass@ncat.zoom.us/j/1",
            "https://zoom.us.evil.com/j/1",
            "https://evil.com/zoom.us",
            "https://evil.com#@zoom.us",
            "https://notzoom.us/j/1",
            "zoom.us/j/1",
        ]) {
            const result = normalizeZoomUrl(input);
            assert.equal(result.ok, false, input);
        }
    });
});
