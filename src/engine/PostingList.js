/**
 * PostingList — Tracks which documents contain a given term, how often,
 * and the exact positional offsets of each term occurrence.
 *
 * Data Structure: Map<documentId, number[]>
 *
 * Supports both standard BM25 Term Frequency (TF) and Exact Phrase Search
 * via positional index lookup.
 */
class PostingList {

    constructor() {
        /**
         * Map<string, number[]> — documentId → array of token positional offsets.
         * @type {Map<string, number[]>}
         */
        this.postings = new Map();
    }

    /**
     * Record an occurrence of this term in the given document at positional index `position`.
     *
     * @param {string} documentId
     * @param {number} position - 0-indexed position in processed token stream
     */
    addPosition(documentId, position) {
        let positions = this.postings.get(documentId);
        if (!positions) {
            positions = [];
            this.postings.set(documentId, positions);
        }
        positions.push(position);
    }

    /**
     * Record one occurrence (fallback helper).
     * @param {string} documentId
     */
    add(documentId) {
        this.addPosition(documentId, this.getFrequency(documentId));
    }

    /**
     * Get the term frequency (TF) for a specific document.
     *
     * @param {string} documentId
     * @returns {number} frequency count
     */
    getFrequency(documentId) {
        const positions = this.postings.get(documentId);
        return positions ? positions.length : 0;
    }

    /**
     * Get array of token positions for a term in a specific document.
     *
     * @param {string} documentId
     * @returns {number[]}
     */
    getPositions(documentId) {
        return this.postings.get(documentId) || [];
    }

    /**
     * Get the document frequency (DF) — how many distinct documents contain this term.
     *
     * @returns {number}
     */
    getDocumentFrequency() {
        return this.postings.size;
    }

    /**
     * Get all document IDs that contain this term.
     *
     * @returns {Set<string>}
     */
    getDocuments() {
        return new Set(this.postings.keys());
    }
}

export { PostingList };
