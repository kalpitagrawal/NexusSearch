/**
 * RankingEngine — Scores and ranks candidate documents using BM25
 * + Exact Phrase Matching (Quoted Queries).
 *
 * BM25 Parameters:
 *   k1 = 1.5  — Term frequency saturation parameter
 *   b  = 0.75 — Document length normalization parameter
 *
 * IDF Formulation:
 *   Standard BM25 smoothed IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
 *   Guarantees non-negative weight even when df > N / 2.
 *
 * Selection:
 *   Uses a bounded Min-Heap of capacity K to select the top-K highest scoring results
 *   in O(N log K) time, where N is the number of matching candidate documents.
 */
import { SearchResult } from "./SearchResult.js";

/**
 * MinHeap — A size-bounded min-heap priority queue for top-K selection.
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
 * Rank candidate documents using BM25 and exact phrase verification.
 *
 * @param {Set<string>|Array<string>} candidates - Matching candidate document IDs
 * @param {string[]} queryTokens - Processed query tokens
 * @param {number} topK - Number of top results to retain in Min-Heap
 * @param {import('./InvertedIndex.js').InvertedIndex} index - Inverted index
 * @param {string[][]} [phrases=[]] - Optional exact quoted phrase token sequences
 * @returns {SearchResult[]} Top-K results sorted descending by score
 */
const rank = (candidates, queryTokens, topK, index, phrases = []) => {
    if (!candidates || (candidates.size === 0 && (!Array.isArray(candidates) || candidates.length === 0))) {
        return [];
    }

    const safeTopK = Math.max(1, topK);
    const queue = new MinHeap();
    const totalDocuments = index.getTotalDocuments();
    const averageDocumentLength = index.getAverageDocumentLength();

    if (totalDocuments === 0 || averageDocumentLength === 0) {
        return [];
    }

    // 1. Precompute term IDF and posting lists ONCE for all candidates
    const termMetadata = [];
    for (const token of queryTokens) {
        const postings = index.getPostingList(token);
        if (!postings) continue;

        const df = postings.getDocumentFrequency();
        if (df === 0) continue;

        // Standard BM25 smoothed IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
        const idf = Math.log(1 + ((totalDocuments - df + 0.5) / (df + 0.5)));
        termMetadata.push({ token, postings, idf });
    }

    if (termMetadata.length === 0) {
        return [];
    }

    // 2. Score candidates and insert into bounded MinHeap of capacity K
    for (const documentId of candidates) {
        const score = calculateScore(
            documentId,
            termMetadata,
            averageDocumentLength,
            index,
            phrases
        );

        if (score <= 0) continue;

        const result = new SearchResult(documentId, score);

        if (queue.size < safeTopK) {
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
 * Calculate BM25 score with precomputed term IDFs and optional exact phrase boost.
 *
 * @private
 */
const calculateScore = (documentId, termMetadata, averageDocumentLength, index, phrases = []) => {
    let score = 0;
    const k1 = 1.5;
    const b = 0.75;

    const documentLength = index.getDocumentLength(documentId);
    if (documentLength === 0) {
        return 0;
    }

    const lengthFactor = 1 - b + b * (documentLength / averageDocumentLength);

    for (const { postings, idf } of termMetadata) {
        const tf = postings.getFrequency(documentId);
        if (tf === 0) continue;

        const numerator = tf * (k1 + 1) * idf;
        const denominator = tf + k1 * lengthFactor;
        score += numerator / denominator;
    }

    // Exact phrase search boost
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
            score = score * (1 + totalPhraseMatches * 2.5);
        } else {
            score = score * 0.1;
        }
    }

    return score;
};

/**
 * Verify exact adjacency of phrase tokens in a document via positional posting offsets.
 *
 * @param {string} documentId
 * @param {string[]} phraseTokens
 * @param {import('./InvertedIndex.js').InvertedIndex} index
 * @returns {number} Number of exact phrase occurrences
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
