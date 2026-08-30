/**
 * SearchController — REST API endpoint handlers.
 *
 * Direct port of SearchController.java
 *
 * Returns flat JSON responses matching Java's ResponseEntity.ok(Map):
 *   - Search: { query, totalResults, results }
 *   - Index:  { status, url, title, tokensIndexed }
 *   - Stats:  { totalDocuments, totalTerms, averageDocumentLength, documentsInDatabase }
 *
 * Endpoints:
 *   GET  /api/search?q=redis&topK=10  — Search the index
 *   POST /api/index  { url: "..." }    — Crawl and index a URL
 *   GET  /api/stats                    — Return index statistics
 */
import * as SearchService from "../services/search.service.js";

/**
 * GET /api/search?q=redis&topK=10
 *
 * Search the index and return ranked results.
 * Port of SearchController.search() in Java.
 */
const searchDocuments = async (req, res) => {

    const { q, topK = "10" } = req.query;

    if (!q || q.trim() === "") {
        return res.status(400).json({
            error: "Query parameter 'q' is required."
        });
    }

    try {
        const parsedTopK = parseInt(topK, 10);
        const limit = isNaN(parsedTopK) || parsedTopK <= 0 ? 10 : parsedTopK;
        const results = await SearchService.search(q, limit);
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
 * Body: { "url": "https://example.com" }
 *
 * Crawl a URL and add it to the search index.
 * Port of SearchController.indexUrl() in Java.
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
 *
 * Return index statistics.
 * Port of SearchController.stats() in Java.
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

export { searchDocuments, indexUrl, getStats };
