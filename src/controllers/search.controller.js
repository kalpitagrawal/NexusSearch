import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Repo } from "../models/repo.model.js";
import { ranking } from "../indexer/tfidf.js";

const searchRepos = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.trim() === "") {
        throw new ApiError(400, "Search query is required");
    }

    const repos = await Repo.find({}).lean();

    if (repos.length === 0) {
        throw new ApiError(404, "No repos found in the database. Run the crawler first.");
    }

    const rankedRepos = ranking(q, repos);

    // Filter out repos with 0 score
    const results = rankedRepos
        .filter(repo => repo.score > 0)
        .map(repo => ({
            repoName: repo.repoName,
            owner: repo.owner,
            description: repo.repoDescription,
            language: repo.language,
            stars: repo.stars,
            url: repo.url,
            score: parseFloat(repo.score.toFixed(6))
        }));

    return res.status(200).json(
        new ApiResponse(200, {
            query: q,
            totalResults: results.length,
            results
        }, "Search results fetched successfully")
    );
});

export { searchRepos };
