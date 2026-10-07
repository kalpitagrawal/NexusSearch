import dns from "dns";
import http from "http";
import https from "https";
import ipaddr from "ipaddr.js";

const IPV4_BLOCKED_RANGES = {
    unspecified: ipaddr.parseCIDR("0.0.0.0/8"),
    broadcast: ipaddr.parseCIDR("255.255.255.255/32"),
    multicast: ipaddr.parseCIDR("224.0.0.0/4"),
    linkLocal: ipaddr.parseCIDR("169.254.0.0/16"),
    loopback: ipaddr.parseCIDR("127.0.0.0/8"),
    private10: ipaddr.parseCIDR("10.0.0.0/8"),
    private172: ipaddr.parseCIDR("172.16.0.0/12"),
    private192: ipaddr.parseCIDR("192.168.0.0/16"),
    carrierGradeNat: ipaddr.parseCIDR("100.64.0.0/10")
};

const IPV6_BLOCKED_RANGES = {
    unspecified: ipaddr.parseCIDR("::/128"),
    linkLocal: ipaddr.parseCIDR("fe80::/10"),
    multicast: ipaddr.parseCIDR("ff00::/8"),
    loopback: ipaddr.parseCIDR("::1/128"),
    uniqueLocal: ipaddr.parseCIDR("fc00::/7")
};

/**
 * Check if an IP address falls into any private, loopback, multicast, or reserved ranges.
 * @param {string} ipStr
 * @returns {boolean}
 */
export const isBlockedIp = (ipStr) => {
    if (!ipStr || typeof ipStr !== "string") return true;

    try {
        let addr = ipaddr.parse(ipStr.trim());

        // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
        if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
            addr = addr.toIPv4Address();
        }

        if (addr.kind() === "ipv4") {
            for (const range of Object.values(IPV4_BLOCKED_RANGES)) {
                if (addr.match(range)) {
                    return true;
                }
            }
            return false;
        }

        if (addr.kind() === "ipv6") {
            for (const range of Object.values(IPV6_BLOCKED_RANGES)) {
                if (addr.match(range)) {
                    return true;
                }
            }
            return false;
        }

        return true;
    } catch (_) {
        return true;
    }
};

/**
 * Validate URL structure and hostname against internal domains.
 * @param {string} urlStr
 * @returns {URL}
 */
export const validateUrlStructure = (urlStr) => {
    if (!urlStr || typeof urlStr !== "string") {
        throw new Error("URL must be a non-empty string.");
    }

    let parsed;
    try {
        parsed = new URL(urlStr);
    } catch (_) {
        throw new Error(`Invalid URL format: "${urlStr}".`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Invalid protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".onion")
    ) {
        throw new Error(`Access to local or private hostname "${hostname}" is blocked.`);
    }

    // Direct IP entered in URL
    if (ipaddr.isValid(hostname) && isBlockedIp(hostname)) {
        throw new Error(`Access to private/reserved IP "${hostname}" is blocked.`);
    }

    return parsed;
};

/**
 * Safe DNS lookup function for Node http/https Agents.
 * Intercepts DNS resolution at connection time to defeat DNS rebinding (TOCTOU).
 */
export const safeLookup = (hostname, options, callback) => {
    if (typeof options === "function") {
        callback = options;
        options = {};
    }

    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err);

        if (!addresses || addresses.length === 0) {
            return callback(new Error(`DNS resolution returned no addresses for ${hostname}`));
        }

        for (const addr of addresses) {
            const ip = typeof addr === "string" ? addr : addr.address;
            if (isBlockedIp(ip)) {
                return callback(new Error(`Access to blocked IP address (${ip}) is disallowed.`));
            }
        }

        if (options && options.all) {
            return callback(null, addresses);
        }

        const first = addresses[0];
        const ip = typeof first === "string" ? first : first.address;
        const family = typeof first === "string" ? 4 : first.family;
        return callback(null, ip, family);
    });
};

export const safeHttpAgent = new http.Agent({
    lookup: safeLookup,
    keepAlive: false,
    timeout: 10000
});

export const safeHttpsAgent = new https.Agent({
    lookup: safeLookup,
    keepAlive: false,
    timeout: 10000
});
