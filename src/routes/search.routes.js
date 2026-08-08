import { Router } from "express";
import { searchRepos } from "../controllers/search.controller.js";

const router = Router();

router.route("/").get(searchRepos);

export default router;
