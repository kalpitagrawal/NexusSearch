/**
 * SearchController — REST API endpoint handlers.
 */
import * as SearchService from "../services/search.service.js";

/**
 * Maps crawl errors to standard HTTP status codes.
 * @param {Error} error
 * @returns {number}
 */
const mapCrawlErrorToStatus = (error) => {
    const msg = (error.message || "").toLowerCase();
    const code = error.code || "";

    if (code === "ECONNABORTED" || msg.includes("timeout")) {
        return 504; // Gateway Timeout
    }
    if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "EAI_AGAIN") {
        return 502; // Bad Gateway
    }
    if (msg.includes("unsupported content type")) {
        return 415; // Unsupported Media Type
    }
    if (
        msg.includes("blocked") ||
        msg.includes("disallowed") ||
        msg.includes("invalid protocol") ||
        msg.includes("invalid url")
    ) {
        return 400; // Bad Request
    }
    return 500;
};

/**
 * GET /api/search?q=query&topK=50&page=1&limit=10&domain=all
 */
export const searchDocuments = async (req, res) => {
    const { q, topK = "50", page = "1", limit = "10", domain = "all" } = req.query;

    if (!q || q.trim() === "") {
        return res.status(400).json({
            error: "Query parameter 'q' is required."
        });
    }

    try {
        const parsedTopK = parseInt(topK, 10) || 50;
        const parsedPage = parseInt(page, 10) || 1;
        const parsedLimit = parseInt(limit, 10) || 10;

        const results = await SearchService.search(q, parsedTopK, parsedPage, parsedLimit, domain);
        return res.status(200).json(results);
    } catch (error) {
        return res.status(500).json({
            error: "Search failed.",
            message: error.message
        });
    }
};

/**
 * POST /api/index
 * Body: { url: "...", maxDepth: 1, maxPages: 1, sameDomainOnly: false }
 */
export const indexUrl = async (req, res) => {
    const { url, maxDepth = 1, maxPages = 1, sameDomainOnly = false } = req.body;

    if (!url || typeof url !== "string" || url.trim() === "") {
        return res.status(400).json({
            error: "Field 'url' is required."
        });
    }

    try {
        const parsedDepth = parseInt(maxDepth, 10) || 1;
        const parsedPages = parseInt(maxPages, 10) || 1;

        const result = await SearchService.indexUrl(url.trim(), parsedDepth, parsedPages, {
            sameDomainOnly: Boolean(sameDomainOnly)
        });

        return res.status(200).json(result);
    } catch (error) {
        const statusCode = mapCrawlErrorToStatus(error);
        return res.status(statusCode).json({
            error: error.message || "Failed to crawl URL.",
            message: error.message,
            url
        });
    }
};

/**
 * GET /api/stats
 */
export const getStats = async (req, res) => {
    try {
        const stats = await SearchService.getStats();
        return res.status(200).json(stats);
    } catch (error) {
        return res.status(500).json({
            error: "Failed to fetch stats.",
            message: error.message
        });
    }
};

/**
 * GET /api/suggest?q=prefix&limit=5
 */
export const getSuggestions = async (req, res) => {
    const { q, limit = "5" } = req.query;

    if (!q || q.trim() === "") {
        return res.status(200).json({ query: "", suggestions: [] });
    }

    try {
        const parsedLimit = parseInt(limit, 10) || 5;
        const suggestions = SearchService.getSuggestions(q.trim(), parsedLimit);
        return res.status(200).json({
            query: q.trim(),
            suggestions
        });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to fetch suggestions.",
            message: error.message
        });
    }
};

/**
 * GET /api/document?url=...
 */
export const getDocument = async (req, res) => {
    const { url } = req.query;
    if (!url || url.trim() === "") {
        return res.status(400).json({ error: "Parameter 'url' is required." });
    }

    try {
        const doc = await SearchService.getDocument(url.trim());
        if (!doc) {
            return res.status(404).json({ error: "Document not found in index." });
        }
        return res.status(200).json(doc);
    } catch (error) {
        return res.status(500).json({
            error: "Failed to fetch document.",
            message: error.message
        });
    }
};
