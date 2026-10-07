/**
 * WebCrawler — Fetches web pages, extracts metadata/text, and discovers hyperlinks.
 *
 * Implements security guards against SSRF, DNS rebinding, oversized payloads,
 * and malicious redirects.
 */
import axios from "axios";
import * as cheerio from "cheerio";
import {
    validateUrlStructure,
    safeHttpAgent,
    safeHttpsAgent
} from "../utils/ssrfFilter.js";

const TIMEOUT_MS = parseInt(process.env.CRAWLER_TIMEOUT_MS || "10000", 10);
const USER_AGENT = process.env.CRAWLER_USER_AGENT || "NexusSearchBot/1.0";
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5 MB ceiling

/**
 * Normalizes a URL: lowercases hostname, strips hash, removes tracking query params,
 * and normalizes trailing slashes.
 * @param {string} urlStr
 * @returns {string}
 */
export const normalizeUrl = (urlStr) => {
    try {
        const u = new URL(urlStr);
        u.hash = "";

        // Strip common tracking parameters
        const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
        for (const param of trackingParams) {
            u.searchParams.delete(param);
        }

        // Normalize trailing slash on non-root paths
        if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
            u.pathname = u.pathname.slice(0, -1);
        }

        return u.href;
    } catch (_) {
        return urlStr;
    }
};

/**
 * Crawl a single target URL.
 *
 * @param {string} url - Target URL to crawl
 * @param {object} [options]
 * @param {boolean} [options.sameDomainOnly=false] - Only retain child links matching root domain
 * @returns {Promise<{ url: string, title: string, textContent: string, links: string[] }>}
 */
const crawl = async (url, options = {}) => {
    // 1. Initial SSRF URL validation
    validateUrlStructure(url);

    // 2. Fetch page with safe DNS agents, redirect validation, and length bounds
    const response = await axios.get(url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
        },
        timeout: TIMEOUT_MS,
        responseType: "text",
        maxContentLength: MAX_CONTENT_LENGTH,
        maxBodyLength: MAX_CONTENT_LENGTH,
        maxRedirects: 5,
        httpAgent: safeHttpAgent,
        httpsAgent: safeHttpsAgent,
        beforeRedirect: (redirectOptions) => {
            const redirectUrl = redirectOptions.href || `${redirectOptions.protocol}//${redirectOptions.host}${redirectOptions.path}`;
            validateUrlStructure(redirectUrl);
        }
    });

    // 3. Verify Content-Type is HTML
    const contentType = (response.headers["content-type"] || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        throw new Error(`Unsupported content type "${contentType}". Expected text/html.`);
    }

    const html = response.data;
    if (typeof html !== "string") {
        throw new Error("Received invalid non-text HTML body.");
    }

    const $ = cheerio.load(html);

    // 4. Extract page title
    const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;

    // 5. Extract hyperlinks prior to stripping elements
    const linksSet = new Set();
    const sourceHostname = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();

    $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        try {
            const absoluteUrl = new URL(href, url);

            if (absoluteUrl.protocol === "http:" || absoluteUrl.protocol === "https:") {
                const childHostname = absoluteUrl.hostname.replace(/^www\./i, "").toLowerCase();

                // Optional politeness: constrain crawler to the originating domain
                if (options.sameDomainOnly && childHostname !== sourceHostname) {
                    return;
                }

                // Filter out non-content / binary assets
                const pathLower = absoluteUrl.pathname.toLowerCase();
                if (pathLower.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz|mp3|mp4|css|js|woff|woff2|json|xml)$/)) {
                    return;
                }

                const cleanedUrl = normalizeUrl(absoluteUrl.href);
                linksSet.add(cleanedUrl);
            }
        } catch (_) {
            // Ignore malformed URLs
        }
    });

    // 6. Semantic tag & boilerplate selector filtering
    $("script, style, nav, footer, header, aside, .sidebar, .menu, .ad, noscript, iframe").remove();

    // 7. Extract visible body text
    const textContent = $("body").text()
        .replace(/\s+/g, " ")
        .trim();

    return {
        url: normalizeUrl(url),
        title,
        textContent,
        links: Array.from(linksSet)
    };
};

export { crawl };
