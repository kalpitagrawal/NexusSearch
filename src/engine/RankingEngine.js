/**
 * RankingEngine — Scores and ranks candidate documents using BM25
 * + Exact Phrase Matching (Quoted Queries).
 *
 * BM25 Parameters:
 *   k1 = 1.5  — Term frequency saturation
 *   b  = 0.75 — Document length normalization
 *
 * Phrase Search:
 *   Verifies exact token adjacency (pos_next == pos_prev + 1) for quoted phrases.
 *   Applies a 2.5x multiplier boost per exact phrase match to bring exact matches to the top.
 */
import { SearchResult } from "./SearchResult.js";

/**
 * MinHeap — A min-heap priority queue for efficient top-K selection.
 */
class MinHeap {

    constructor() {
        /** @type {SearchResult[]} */
        this.heap = [];
    }

    get size() {
        return this.heap.length;
    }

    peek() {
        return this.heap[0];
    }

    offer(result) {
        this.heap.push(result);
        this._bubbleUp(this.heap.length - 1);
    }

    poll() {
        if (this.heap.length === 0) return undefined;

        const min = this.heap[0];
        const last = this.heap.pop();

        if (this.heap.length > 0 && last) {
            this.heap[0] = last;
            this._sinkDown(0);
        }

        return min;
    }

    toArray() {
        return [...this.heap];
    }

    /** @private */
    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index].score < this.heap[parentIndex].score) {
                [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    /** @private */
    _sinkDown(index) {
        const length = this.heap.length;

        while (true) {
            let smallest = index;
            const left = 2 * index + 1;
            const right = 2 * index + 2;

            if (left < length && this.heap[left].score < this.heap[smallest].score) {
                smallest = left;
            }
            if (right < length && this.heap[right].score < this.heap[smallest].score) {
                smallest = right;
            }

            if (smallest !== index) {
                [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
                index = smallest;
            } else {
                break;
            }
        }
    }
}


/**
 * Rank candidate documents using BM25 and exact phrase matching.
 *
 * @param {Set<string>} candidates - set of candidate document IDs
 * @param {string[]} queryTokens - processed query tokens
 * @param {number} topK - number of results to return
 * @param {import('./InvertedIndex.js').InvertedIndex} index - inverted index
 * @param {string[][]} [phrases=[]] - optional list of exact quoted phrases
 * @returns {SearchResult[]} - top-K results sorted by score descending
 */
const rank = (candidates, queryTokens, topK, index, phrases = []) => {

    const queue = new MinHeap();
    const totalDocuments = index.getTotalDocuments();

    for (const documentId of candidates) {

        const score = calculateScore(
            documentId,
            queryTokens,
            totalDocuments,
            index,
            phrases
        );

        if (score <= 0) continue;

        const result = new SearchResult(documentId, score);

        if (queue.size < topK) {
            queue.offer(result);
        } else if (result.score > queue.peek().score) {
            queue.poll();
            queue.offer(result);
        }
    }

    const results = queue.toArray();
    results.sort((a, b) => b.score - a.score);

    return results;
};


/**
 * Calculate BM25 + Phrase Boost score for a document.
 *
 * @private
 */
const calculateScore = (documentId, queryTokens, totalDocuments, index, phrases = []) => {

    let score = 0;

    const k1 = 1.5;
    const b = 0.75;

    const averageDocumentLength = index.getAverageDocumentLength();
    const documentLength = index.getDocumentLength(documentId);

    if (averageDocumentLength === 0 || documentLength === 0) {
        return 0;
    }

    for (const token of queryTokens) {

        const postings = index.getPostingList(token);

        if (!postings) {
            continue;
        }

        const tf = postings.getFrequency(documentId);
        const df = postings.getDocumentFrequency();

        if (df !== 0) {
            // Robertson BM25 IDF formula with +1 smoothing
            const idf = Math.log10(1 + (totalDocuments / df));

            const lengthFactor = 1 - b + b * (documentLength / averageDocumentLength);

            const numerator = tf * (k1 + 1) * idf;
            const denominator = tf + k1 * lengthFactor;

            const termScore = numerator / denominator;

            score += termScore;
        }
    }

    // --- EXACT PHRASE SEARCH BOOST ---
    if (phrases.length > 0 && score > 0) {
        let totalPhraseMatches = 0;
        let matchedAllPhrases = true;

        for (const phraseTokens of phrases) {
            const matches = countPhraseMatches(documentId, phraseTokens, index);
            if (matches > 0) {
                totalPhraseMatches += matches;
            } else {
                matchedAllPhrases = false;
            }
        }

        if (matchedAllPhrases && totalPhraseMatches > 0) {
            // Apply 2.5x multiplier boost per phrase match
            score = score * (1 + totalPhraseMatches * 2.5);
        } else {
            // Penalize documents that do not match the exact quoted phrase
            score = score * 0.1;
        }
    }

    return score;
};

/**
 * Verify exact adjacency of phrase tokens in a document.
 *
 * @param {string} documentId
 * @param {string[]} phraseTokens
 * @param {import('./InvertedIndex.js').InvertedIndex} index
 * @returns {number} number of exact occurrences
 */
const countPhraseMatches = (documentId, phraseTokens, index) => {
    if (!phraseTokens || phraseTokens.length < 2) return 0;

    const firstPosting = index.getPostingList(phraseTokens[0]);
    if (!firstPosting) return 0;

    const firstPositions = firstPosting.getPositions(documentId);
    if (firstPositions.length === 0) return 0;

    const wordPositionsList = [];
    for (let j = 1; j < phraseTokens.length; j++) {
        const posting = index.getPostingList(phraseTokens[j]);
        if (!posting) return 0;
        const positions = posting.getPositions(documentId);
        if (positions.length === 0) return 0;
        wordPositionsList.push(new Set(positions));
    }

    let exactMatches = 0;

    for (const p of firstPositions) {
        let isExactMatch = true;
        for (let j = 0; j < wordPositionsList.length; j++) {
            const expectedPos = p + (j + 1);
            if (!wordPositionsList[j].has(expectedPos)) {
                isExactMatch = false;
                break;
            }
        }
        if (isExactMatch) {
            exactMatches++;
        }
    }

    return exactMatches;
};

export { rank, MinHeap, countPhraseMatches };
