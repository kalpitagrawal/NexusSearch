/**
 * RankingEngine — Scores and ranks candidate documents using BM25.
 *
 * BM25 (Best Matching 25) is the industry-standard ranking function
 * used by real search engines. It improves on basic TF-IDF by:
 *   1. Term frequency saturation — diminishing returns for repeated terms
 *   2. Document length normalization — shorter docs with the same term frequency score higher
 *
 * Parameters:
 *   k1 = 1.5  — Controls term frequency saturation
 *   b  = 0.75 — Controls document length normalization (0 = no normalization, 1 = full)
 *
 * Formula per term:
 *   IDF = log10(totalDocuments / documentFrequency)
 *   lengthFactor = 1 - b + b * (documentLength / averageDocumentLength)
 *   termScore = (tf * (k1 + 1) * IDF) / (tf + k1 * lengthFactor)
 *   totalScore = sum of termScores for all query terms
 *
 * Uses a Min-Heap (PriorityQueue) for efficient top-K selection.
 * Instead of sorting ALL candidates (O(n log n)), we maintain a heap of size K
 * and only keep the K highest-scoring results (O(n log K)).
 *
 * Direct port of RankingEngine.java
 */
import { SearchResult } from "./SearchResult.js";

/**
 * MinHeap — A min-heap priority queue for efficient top-K selection.
 * Direct port of Java's PriorityQueue<SearchResult> with Comparator.comparingDouble(getScore).
 *
 * The min-heap always keeps the LOWEST score at the top.
 * When we find a candidate with a higher score than the heap's minimum,
 * we remove the min and insert the new candidate.
 * At the end, the heap contains exactly the top-K highest scoring results.
 */
class MinHeap {

    constructor() {
        /** @type {SearchResult[]} */
        this.heap = [];
    }

    get size() {
        return this.heap.length;
    }

    /**
     * Peek at the minimum element (lowest score).
     * @returns {SearchResult|undefined}
     */
    peek() {
        return this.heap[0];
    }

    /**
     * Insert a result into the heap.
     * @param {SearchResult} result
     */
    offer(result) {
        this.heap.push(result);
        this._bubbleUp(this.heap.length - 1);
    }

    /**
     * Remove and return the minimum element (lowest score).
     * @returns {SearchResult|undefined}
     */
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

    /**
     * Get all elements as an array (unordered).
     * @returns {SearchResult[]}
     */
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
 * Rank candidate documents using BM25 and return the top-K results.
 *
 * @param {Set<string>} candidates - set of candidate document IDs
 * @param {string[]} queryTokens - processed query tokens
 * @param {number} topK - number of results to return
 * @param {import('./InvertedIndex.js').InvertedIndex} index - the inverted index
 * @returns {SearchResult[]} - top-K results sorted by score descending
 */
const rank = (candidates, queryTokens, topK, index) => {

    const queue = new MinHeap();
    const totalDocuments = index.getTotalDocuments();

    for (const documentId of candidates) {

        const score = calculateScore(
            documentId,
            queryTokens,
            totalDocuments,
            index
        );

        const result = new SearchResult(documentId, score);

        if (queue.size < topK) {

            queue.offer(result);

        } else if (result.score > queue.peek().score) {

            queue.poll();
            queue.offer(result);
        }
    }

    // Sort descending by score
    const results = queue.toArray();
    results.sort((a, b) => b.score - a.score);

    return results;
};


/**
 * Calculate the BM25 score for a document against the query tokens.
 *
 * @param {string} documentId
 * @param {string[]} queryTokens
 * @param {number} totalDocuments
 * @param {import('./InvertedIndex.js').InvertedIndex} index
 * @returns {number} BM25 score
 *
 * @private
 */
const calculateScore = (documentId, queryTokens, totalDocuments, index) => {

    let score = 0;

    const k1 = 1.5;
    const b = 0.75;

    const averageDocumentLength = index.getAverageDocumentLength();
    const documentLength = index.getDocumentLength(documentId);

    for (const token of queryTokens) {

        const postings = index.getPostingList(token);

        if (!postings) {
            continue;
        }

        const tf = postings.getFrequency(documentId);
        const df = postings.getDocumentFrequency();

        if (df !== 0) {

            const idf = Math.log10(totalDocuments / df);

            const lengthFactor = 1 - b + b * (documentLength / averageDocumentLength);

            const numerator = tf * (k1 + 1) * idf;
            const denominator = tf + k1 * lengthFactor;

            const termScore = numerator / denominator;

            score += termScore;
        }
    }

    return score;
};

export { rank, MinHeap };
