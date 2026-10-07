import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBlockedIp, validateUrlStructure } from "../src/utils/ssrfFilter.js";

describe("SSRF IP & URL Validation", () => {
    it("blocks private, loopback, link-local, and carrier-grade NAT IPs", () => {
        // Loopback
        assert.equal(isBlockedIp("127.0.0.1"), true);
        assert.equal(isBlockedIp("127.255.255.255"), true);
        assert.equal(isBlockedIp("::1"), true);
        // IPv4-mapped IPv6
        assert.equal(isBlockedIp("::ffff:127.0.0.1"), true);
        assert.equal(isBlockedIp("::ffff:10.0.0.1"), true);

        // Cloud metadata / link-local
        assert.equal(isBlockedIp("169.254.169.254"), true);
        assert.equal(isBlockedIp("fe80::1"), true);

        // RFC 1918 Private ranges
        assert.equal(isBlockedIp("10.0.0.1"), true);
        assert.equal(isBlockedIp("172.16.5.10"), true);
        assert.equal(isBlockedIp("192.168.1.1"), true);

        // Carrier-grade NAT (100.64.0.0/10)
        assert.equal(isBlockedIp("100.64.0.1"), true);
        assert.equal(isBlockedIp("100.127.255.254"), true);

        // Public IPs should pass
        assert.equal(isBlockedIp("8.8.8.8"), false);
        assert.equal(isBlockedIp("1.1.1.1"), false);
        assert.equal(isBlockedIp("93.184.216.34"), false); // example.com
    });

    it("validates URL schemes and blocks internal hostnames", () => {
        assert.throws(() => validateUrlStructure("ftp://example.com"), /Only HTTP and HTTPS/);
        assert.throws(() => validateUrlStructure("file:///etc/passwd"), /Only HTTP and HTTPS/);
        assert.throws(() => validateUrlStructure("http://localhost:8080"), /local or private hostname/);
        assert.throws(() => validateUrlStructure("http://app.internal/status"), /local or private hostname/);
        assert.throws(() => validateUrlStructure("http://printer.local/"), /local or private hostname/);

        // Valid public URL
        const parsed = validateUrlStructure("https://en.wikipedia.org/wiki/Algorithm");
        assert.equal(parsed.hostname, "en.wikipedia.org");
    });
});
