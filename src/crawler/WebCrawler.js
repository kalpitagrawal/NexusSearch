/**
 * WebCrawler — Fetches and parses web pages + extracts links.
 *
 * Direct port & enhancement of WebCrawler.java (which uses Jsoup).
 * Uses axios (fetch HTML) + cheerio (parse HTML) — the Node.js equivalents of Jsoup.
 *
 * Features:
 *   1. Fetch HTML with custom User-Agent and Timeout
 *   2. Extract page title
 *   3. Extract all valid hyperlinks (<a href="...">) and resolve relative URLs
 *   4. Filter out non-HTTP links, media files, and anchor fragments
 *   5. Remove scripts, styles, and non-content elements
 *   6. Extract visible text content
 */
import axios from "axios";
import * as cheerio from "cheerio";

const TIMEOUT_MS = parseInt(process.env.CRAWLER_TIMEOUT_MS || "10000", 10);
const USER_AGENT = process.env.CRAWLER_USER_AGENT || "SearchEngineBot/1.0";

/**
 * Crawl a URL, extract title, text content, and hyperlinked URLs.
 *
 * @param {string} url - the URL to crawl
 * @returns {Promise<{ url: string, title: string, textContent: string, links: string[] }>} CrawledPage
 * @throws {Error} if the URL cannot be reached
 */
const crawl = async (url) => {

    const response = await axios.get(url, {
        headers: {
            "User-Agent": USER_AGENT,
        },
        timeout: TIMEOUT_MS,
        responseType: "text",
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 1. Extract page title
    const title = $("title").text().trim() || url;

    // 2. Extract valid hyperlinks before removing DOM elements
    const linksSet = new Set();
    $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        try {
            // Resolve relative URLs against the base page URL
            const absoluteUrl = new URL(href, url);

            // Filter: http & https only
            if (absoluteUrl.protocol === "http:" || absoluteUrl.protocol === "https:") {
                // Strip anchor hash fragments (#section)
                absoluteUrl.hash = "";

                const cleanUrl = absoluteUrl.href;

                // Exclude common binary/media extensions
                if (!cleanUrl.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz|mp3|mp4|css|js|woff|woff2)$/i)) {
                    linksSet.add(cleanUrl);
                }
            }
        } catch (_) {
            // Ignore malformed URLs
        }
    });

    // 3. Remove scripts, styles, and non-content elements
    $("script, style, nav, footer, header, aside, .sidebar, .menu, .ad").remove();

    // 4. Extract visible text content
    const textContent = $("body").text()
        .replace(/\s+/g, " ")
        .trim();

    return {
        url,
        title,
        textContent,
        links: Array.from(linksSet)
    };
};

export { crawl };
