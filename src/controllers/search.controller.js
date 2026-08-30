/**
 * SearchController — REST API endpoint handlers.
 *
 * Direct port of SearchController.java
 *
 * Endpoints:
 *   GET  /api/search?q=redis&topK=10  — Search the index
 *   POST /api/index  { url: "..." }    — Crawl and index a URL
 *   GET  /api/stats                    — Return index statistics
 *   GET  /api/suggest?q=alg            — Return autocompletion suggestions
 */
import * as SearchService from "../services/search.service.js";

/**
 * GET /api/search?q=redis&topK=10
 */
const searchDocuments = async (req, res) => {
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
 */
const indexUrl = async (req, res) => {
    const { url, maxDepth = 1, maxPages = 1 } = req.body;

    if (!url || url.trim() === "") {
        return res.status(400).json({
            error: "Field 'url' is required."
        });
    }

    try {
        const parsedDepth = parseInt(maxDepth, 10) || 1;
        const parsedPages = parseInt(maxPages, 10) || 1;

        const result = await SearchService.indexUrl(url, parsedDepth, parsedPages);
        return res.status(200).json(result);

    } catch (error) {
        return res.status(400).json({
            error: "Failed to crawl URL.",
            message: error.message,
            url
        });
    }
};

/**
 * GET /api/stats
 */
const getStats = async (req, res) => {
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
 * GET /api/suggest?q=alg&limit=5
 */
const getSuggestions = async (req, res) => {
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

export { searchDocuments, indexUrl, getStats, getSuggestions };
