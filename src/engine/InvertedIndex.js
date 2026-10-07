/**
 * InvertedIndex — Core search index mapping tokens to positional posting lists.
 *
 * Encapsulates:
 *   - Term-to-PostingList index
 *   - Document length tracking with incremental O(1) average length calculation
 *   - Embedded Trie prefix tree for autocomplete suggestions
 */
import { PostingList } from "./PostingList.js";
import { Trie } from "./Trie.js";

class InvertedIndex {
    constructor() {
        /** @type {Map<string, PostingList>} */
        this.index = new Map();

        /** @type {Map<string, number>} documentId → number of processed tokens */
        this.documentLengths = new Map();

        /** @type {number} Running sum of all document lengths for O(1) average calculation */
        this.totalDocumentLength = 0;

        /** @type {Trie} Embedded prefix tree for unstemmed vocabulary suggestions */
        this.trie = new Trie();
    }

    /**
     * Add a document to the index.
     *
     * @param {string} documentId
     * @param {string[]} tokens - Processed stemmed tokens
     * @param {Map<string, number>} [wordCounts=null] - Unique unstemmed word occurrences for the Trie
     */
    addDocument(documentId, tokens, wordCounts = null) {
        // If document was already indexed, subtract prior length
        if (this.documentLengths.has(documentId)) {
            this.totalDocumentLength -= this.documentLengths.get(documentId);
        }

        this.documentLengths.set(documentId, tokens.length);
        this.totalDocumentLength += tokens.length;

        // Populate inverted index postings with token positions
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            let postingList = this.index.get(token);

            if (!postingList) {
                postingList = new PostingList();
                this.index.set(token, postingList);
            }

            postingList.addPosition(documentId, i);
        }

        // Populate autocomplete Trie once per unique word with aggregated count
        if (wordCounts && wordCounts instanceof Map) {
            for (const [word, count] of wordCounts.entries()) {
                this.trie.insert(word, count);
            }
        }
    }

    /**
     * Get suggestions for a prefix from the embedded Trie.
     * @param {string} prefix
     * @param {number} [limit=5]
     * @returns {string[]}
     */
    getSuggestions(prefix, limit = 5) {
        return this.trie.getSuggestions(prefix, limit);
    }

    /**
     * Get the PostingList for a specific token.
     * @param {string} token
     * @returns {PostingList|undefined}
     */
    getPostingList(token) {
        return this.index.get(token);
    }

    /**
     * Get all candidate document IDs that contain at least one query token.
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
     * @param {string} documentId
     * @returns {number}
     */
    getDocumentLength(documentId) {
        return this.documentLengths.get(documentId) || 0;
    }

    /**
     * Get the total number of indexed documents.
     * @returns {number}
     */
    getTotalDocuments() {
        return this.documentLengths.size;
    }

    /**
     * Get the average document length across all indexed documents in O(1).
     * @returns {number}
     */
    getAverageDocumentLength() {
        if (this.documentLengths.size === 0) {
            return 0;
        }
        return this.totalDocumentLength / this.documentLengths.size;
    }

    /**
     * Get the number of unique terms in the index.
     * @returns {number}
     */
    getTotalTerms() {
        return this.index.size;
    }

    /**
     * Get index statistics as a plain object.
     * @returns {{ totalDocuments: number, totalTerms: number, averageDocumentLength: number }}
     */
    getStats() {
        return {
            totalDocuments: this.getTotalDocuments(),
            totalTerms: this.getTotalTerms(),
            averageDocumentLength: Math.round(this.getAverageDocumentLength() * 100) / 100,
        };
    }

    /**
     * Clear the index and reset all state.
     */
    clear() {
        this.index.clear();
        this.documentLengths.clear();
        this.totalDocumentLength = 0;
        this.trie.clear();
    }
}

// Active singleton instance
let activeIndex = new InvertedIndex();

const getActiveIndex = () => activeIndex;
const setActiveIndex = (newIndex) => {
    activeIndex = newIndex;
};

export { InvertedIndex, activeIndex as invertedIndex, getActiveIndex, setActiveIndex };
