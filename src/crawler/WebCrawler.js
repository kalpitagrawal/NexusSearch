/**
 * WebCrawler — Fetches and parses web pages.
 *
 * Direct port of WebCrawler.java (which uses Jsoup).
 * Uses axios (fetch HTML) + cheerio (parse HTML) — the Node.js equivalents of Jsoup.
 *
 * Pipeline:
 *   1. Fetch the HTML page with a custom User-Agent and timeout
 *   2. Parse it with cheerio (like Jsoup.parse())
 *   3. Extract the page title
 *   4. Remove non-content elements: script, style, nav, footer, header, aside, .sidebar, .menu, .ad
 *   5. Extract visible text content from the body
 *   6. Return a CrawledPage object { url, title, textContent }
 */
import axios from "axios";
import * as cheerio from "cheerio";

const TIMEOUT_MS = parseInt(process.env.CRAWLER_TIMEOUT_MS || "10000", 10);
const USER_AGENT = process.env.CRAWLER_USER_AGENT || "SearchEngineBot/1.0";

/**
 * Crawl a URL and extract its content.
 *
 * @param {string} url - the URL to crawl
 * @returns {Promise<{ url: string, title: string, textContent: string }>} CrawledPage
 * @throws {Error} if the URL cannot be reached
 */
const crawl = async (url) => {

    const response = await axios.get(url, {
        headers: {
            "User-Agent": USER_AGENT,
        },
        timeout: TIMEOUT_MS,
        // Get raw HTML
        responseType: "text",
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract the page title
    const title = $("title").text().trim();

    // Remove scripts, styles, and non-visible elements
    // (Same selectors as WebCrawler.java)
    $("script, style, nav, footer, header, aside, .sidebar, .menu, .ad").remove();

    // Extract visible text content
    const textContent = $("body").text()
        .replace(/\s+/g, " ")
        .trim();

    return { url, title, textContent };
};

export { crawl };
