/**
 * SearchEngine — The search pipeline facade.
 *
 * Orchestrates the full search flow:
 *   1. Process the query through TextProcessor
 *   2. Deduplicate query tokens (Set)
 *   3. Retrieve candidate documents from the InvertedIndex
 *   4. Rank candidates using RankingEngine (BM25)
 *   5. Return top-K results
 *
 * Direct port of SearchEngine.java
 */
import * as TextProcessor from "./TextProcessor.js";
import { invertedIndex } from "./InvertedIndex.js";
import * as RankingEngine from "./RankingEngine.js";

/**
 * Search the index for documents matching the query.
 *
 * @param {string} query - raw search query
 * @param {number} topK - number of results to return
 * @returns {import('./SearchResult.js').SearchResult[]}
 * @throws {Error} if topK <= 0
 */
const search = (query, topK) => {

    if (topK <= 0) {
        throw new Error("topK must be greater than 0");
    }

    // Step 1: Process query into tokens
    const tokens = TextProcessor.process(query);

    // Step 2: Deduplicate query tokens
    const queryTerms = [...new Set(tokens)];

    // Step 3: Get candidate documents (union of posting lists)
    const candidates = invertedIndex.getCandidates(queryTerms);

    // Step 4 & 5: Rank candidates using BM25 and return top-K
    return RankingEngine.rank(
        candidates,
        queryTerms,
        topK,
        invertedIndex
    );
};

export { search };
