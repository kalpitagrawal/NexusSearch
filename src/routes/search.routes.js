/**
 * Search Routes — Maps HTTP endpoints to controller handlers.
 *
 * Port of SearchController.java's @RequestMapping annotations.
 *
 * Routes (mounted at /api):
 *   GET  /search?q=...&topK=...  →  searchDocuments
 *   POST /index                   →  indexUrl
 *   GET  /stats                   →  getStats
 */
import { Router } from "express";
import { searchDocuments, indexUrl, getStats, getSuggestions } from "../controllers/search.controller.js";

const router = Router();

router.route("/search").get(searchDocuments);
router.route("/index").post(indexUrl);
router.route("/stats").get(getStats);
router.route("/suggest").get(getSuggestions);

export default router;
