/**
 * SearchResult — Value object holding a single search result.
 *
 * Created by RankingEngine with documentId + score.
 * Enriched by SearchService with title + snippet from the database.
 *
 * Direct port of SearchResult.java
 */
class SearchResult {

    /**
     * @param {string} documentId
     * @param {number} score - BM25 relevance score
     * @param {string} [title]
     * @param {string} [snippet]
     */
    constructor(documentId, score, title = null, snippet = null) {
        this.documentId = documentId;
        this.score = score;
        this.title = title;
        this.snippet = snippet;
    }

    toString() {
        return `${this.documentId} → ${this.score}`;
    }
}

export { SearchResult };
