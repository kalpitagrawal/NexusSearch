/**
 * PostingList — Tracks which documents contain a given term and how often.
 *
 * Data Structure: Map<documentId, frequency>
 *
 * Direct port of PostingList.java
 * Previously this was a raw Map<String, Integer> inside InvertedIndex.
 * Extracted into its own class for a cleaner abstraction — instead of
 * reaching into a raw Map and calling .get()/.size(), consumers call
 * meaningful methods like .getFrequency(docId) and .getDocumentFrequency().
 */
class PostingList {

    constructor() {
        /**
         * Map<string, number> — documentId → term frequency in that document.
         * @type {Map<string, number>}
         */
        this.frequencies = new Map();
    }

    /**
     * Record one occurrence of this term in the given document.
     * If the document already exists, its frequency is incremented.
     *
     * @param {string} documentId
     */
    add(documentId) {
        const current = this.frequencies.get(documentId) || 0;
        this.frequencies.set(documentId, current + 1);
    }

    /**
     * Get the term frequency (TF) for a specific document.
     * Returns 0 if the document doesn't contain this term.
     *
     * @param {string} documentId
     * @returns {number} frequency count
     */
    getFrequency(documentId) {
        return this.frequencies.get(documentId) || 0;
    }

    /**
     * Get the document frequency (DF) — how many distinct documents contain this term.
     * Used in IDF calculation.
     *
     * @returns {number}
     */
    getDocumentFrequency() {
        return this.frequencies.size;
    }

    /**
     * Get all document IDs that contain this term.
     * Used for candidate retrieval.
     *
     * @returns {Set<string>}
     */
    getDocuments() {
        return new Set(this.frequencies.keys());
    }
}

export { PostingList };
