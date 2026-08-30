/**
 * InvertedIndex — The core data structure of the search engine.
 *
 * Maps every processed token to a PostingList (which documents contain it and how often).
 * Also tracks document lengths for BM25 length normalization.
 *
 * Data Structure:
 *   index:           Map<token, PostingList>
 *   documentLengths: Map<documentId, numberOfTokens>
 *
 * Direct port of InvertedIndex.java
 */
import { PostingList } from "./PostingList.js";
import { trie } from "./Trie.js";

class InvertedIndex {

    constructor() {
        /** @type {Map<string, PostingList>} */
        this.index = new Map();

        /** @type {Map<string, number>} documentId → number of processed tokens */
        this.documentLengths = new Map();
    }

    /**
     * Add a document to the index.
     * For each token, creates or updates the PostingList entry and populates the Autocomplete Trie.
     *
     * @param {string} documentId
     * @param {string[]} tokens - processed tokens from TextProcessor
     */
    addDocument(documentId, tokens) {

        this.documentLengths.set(documentId, tokens.length);

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            let postingList = this.index.get(token);

            if (!postingList) {
                postingList = new PostingList();
                this.index.set(token, postingList);
            }

            postingList.addPosition(documentId, i);
            trie.insert(token, 1);
        }
    }

    /**
     * Get suggestions for a prefix.
     * @param {string} prefix
     * @param {number} [limit=5]
     * @returns {string[]}
     */
    getSuggestions(prefix, limit = 5) {
        return trie.getSuggestions(prefix, limit);
    }

    /**
     * Get the PostingList for a specific token.
     *
     * @param {string} token
     * @returns {PostingList|undefined}
     */
    getPostingList(token) {
        return this.index.get(token);
    }

    /**
     * Get all candidate document IDs that contain at least one query token.
     * Union of all posting lists for the query tokens.
     *
     * @param {string[]} queryTokens
     * @returns {Set<string>}
     */
    getCandidates(queryTokens) {

        const candidates = new Set();

        for (const token of queryTokens) {

            const postingList = this.index.get(token);

            if (postingList) {
                for (const docId of postingList.getDocuments()) {
                    candidates.add(docId);
                }
            }
        }

        return candidates;
    }

    /**
     * Get the number of processed tokens in a document.
     *
     * @param {string} documentId
     * @returns {number}
     */
    getDocumentLength(documentId) {
        return this.documentLengths.get(documentId) || 0;
    }

    /**
     * Get the total number of indexed documents.
     *
     * @returns {number}
     */
    getTotalDocuments() {
        return this.documentLengths.size;
    }

    /**
     * Get the average document length across all indexed documents.
     * Used by BM25 for length normalization.
     *
     * @returns {number}
     */
    getAverageDocumentLength() {

        if (this.documentLengths.size === 0) {
            return 0;
        }

        let totalLength = 0;

        for (const length of this.documentLengths.values()) {
            totalLength += length;
        }

        return totalLength / this.documentLengths.size;
    }

    // --- Stats for the API ---

    /**
     * Get the number of unique terms in the index.
     *
     * @returns {number}
     */
    getTotalTerms() {
        return this.index.size;
    }

    /**
     * Get index statistics as a plain object.
     *
     * @returns {{ totalDocuments: number, totalTerms: number, averageDocumentLength: number }}
     */
    getStats() {
        return {
            totalDocuments: this.getTotalDocuments(),
            totalTerms: this.getTotalTerms(),
            averageDocumentLength: this.getAverageDocumentLength(),
        };
    }

    /**
     * Clear the entire index. Used by rebuildIndex() on startup.
     */
    clear() {
        this.index.clear();
        this.documentLengths.clear();
    }
}

// Singleton — same instance shared across the entire app
// (equivalent of Spring @Component singleton bean)
const invertedIndex = new InvertedIndex();

export { InvertedIndex, invertedIndex };
