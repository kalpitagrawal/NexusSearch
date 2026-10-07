/**
 * Search Routes — Maps HTTP endpoints to controller handlers.
 *
 * Routes (mounted at /api):
 *   GET  /search?q=...&topK=...  →  searchDocuments
 *   POST /index                   →  indexUrl (Rate-limited)
 *   GET  /stats                   →  getStats
 *   GET  /suggest?q=...           →  getSuggestions
 *   GET  /document?url=...        →  getDocument
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    searchDocuments,
    indexUrl,
    getStats,
    getSuggestions,
    getDocument
} from "../controllers/search.controller.js";

const router = Router();

// Demo-mode rate limiter for crawl requests: 10 requests per 15 minutes per IP
const crawlRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many crawl requests from this IP. Please wait 15 minutes before indexing more pages.",
        status: "rate_limited"
    }
});

router.route("/search").get(searchDocuments);
router.route("/index").post(crawlRateLimiter, indexUrl);
router.route("/stats").get(getStats);
router.route("/suggest").get(getSuggestions);
router.route("/document").get(getDocument);

export default router;
