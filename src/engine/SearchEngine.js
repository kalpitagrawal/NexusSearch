/**
 * SearchEngine — The search pipeline facade.
 *
 * Orchestrates:
 *   1. Tokenization and phrase extraction via TextProcessor
 *   2. Retrieval of matching candidates from InvertedIndex
 *   3. Scoring and top-K selection via RankingEngine
 */
import * as TextProcessor from "./TextProcessor.js";
import { getActiveIndex } from "./InvertedIndex.js";
import * as RankingEngine from "./RankingEngine.js";

/**
 * Retrieve matching candidates and query tokens for a query string.
 * @param {string} query
 * @returns {{ queryTerms: string[], phrases: string[][], candidates: Set<string>, index: import('./InvertedIndex.js').InvertedIndex }}
 */
const getQueryCandidates = (query) => {
    const { tokens, phrases } = TextProcessor.processQuery(query);
    const queryTerms = [...new Set(tokens)];
    const index = getActiveIndex();
    const candidates = index.getCandidates(queryTerms);
    return { queryTerms, phrases, candidates, index };
};

/**
 * Search the index for documents matching the query.
 *
 * @param {string} query - Raw search query
 * @param {number} topK - Capacity of the Min-Heap priority queue
 * @param {Set<string>|Array<string>} [candidateSubset=null] - Optional candidate subset (e.g. filtered by domain)
 * @returns {import('./SearchResult.js').SearchResult[]}
 */
const search = (query, topK, candidateSubset = null) => {
    if (topK <= 0) {
        throw new Error("topK must be greater than 0");
    }

    const { queryTerms, phrases, candidates, index } = getQueryCandidates(query);
    const targetCandidates = candidateSubset ? candidateSubset : candidates;

    return RankingEngine.rank(
        targetCandidates,
        queryTerms,
        topK,
        index,
        phrases
    );
};

export { search, getQueryCandidates };
