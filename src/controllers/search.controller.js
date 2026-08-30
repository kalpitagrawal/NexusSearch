/**
 * SearchController — REST API endpoint handlers.
 *
 * Direct port of SearchController.java
 * Uses your existing MERN patterns: asyncHandler, ApiError, ApiResponse.
 *
 * Endpoints:
 *   GET  /api/search?q=redis&topK=10  — Search the index
 *   POST /api/index  { url: "..." }    — Crawl and index a URL
 *   GET  /api/stats                    — Return index statistics
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as SearchService from "../services/search.service.js";

/**
 * GET /api/search?q=redis&topK=10
 *
 * Search the index and return ranked results.
 * Port of SearchController.search() in Java.
 */
const searchDocuments = asyncHandler(async (req, res) => {

    const { q, topK = "10" } = req.query;

    if (!q || q.trim() === "") {
        throw new ApiError(400, "Query parameter 'q' is required.");
    }

    const results = await SearchService.search(q, parseInt(topK, 10));

    return res.status(200).json(
        new ApiResponse(200, results, "Search results fetched successfully")
    );
});

/**
 * POST /api/index
 * Body: { "url": "https://example.com" }
 *
 * Crawl a URL and add it to the search index.
 * Port of SearchController.indexUrl() in Java.
 */
const indexUrl = asyncHandler(async (req, res) => {

    const { url } = req.body;

    if (!url || url.trim() === "") {
        throw new ApiError(400, "Field 'url' is required.");
    }

    try {
        const result = await SearchService.indexUrl(url);

        return res.status(200).json(
            new ApiResponse(200, result, "URL processed successfully")
        );

    } catch (error) {
        throw new ApiError(400, "Failed to crawl URL.", [error.message]);
    }
});

/**
 * GET /api/stats
 *
 * Return index statistics.
 * Port of SearchController.stats() in Java.
 */
const getStats = asyncHandler(async (req, res) => {

    const stats = await SearchService.getStats();

    return res.status(200).json(
        new ApiResponse(200, stats, "Stats fetched successfully")
    );
});

export { searchDocuments, indexUrl, getStats };
