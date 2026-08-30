/**
 * SearchService — Business logic layer.
 *
 * Direct port of SearchService.java
 *
 * Separates business logic from the controller (route handlers),
 * exactly like the Java version separates SearchService from SearchController.
 *
 * Methods:
 *   - rebuildIndex()   — Load all docs from MongoDB, rebuild the in-memory inverted index
 *   - search()         — Search + enrich results with title & snippet from DB
 *   - indexUrl()       — Crawl a URL, persist to DB, add to index
 *   - getStats()       — Return index + DB statistics
 *   - generateSnippet() — Extract ~200 chars centered around first query term
 */
import { Document } from "../models/document.model.js";
import { invertedIndex } from "../engine/InvertedIndex.js";
import * as TextProcessor from "../engine/TextProcessor.js";
import * as SearchEngine from "../engine/SearchEngine.js";
import * as WebCrawler from "../crawler/WebCrawler.js";

/**
 * On startup, load all documents from the database
 * and rebuild the inverted index.
 *
 * Port of @PostConstruct rebuildIndex() in SearchService.java
 */
const rebuildIndex = async () => {

    const documents = await Document.find({}).lean();

    if (documents.length === 0) {
        console.log("No documents in database. Index is empty.");
        return;
    }

    console.log(`Rebuilding index from ${documents.length} documents...`);

    invertedIndex.clear();

    for (const doc of documents) {

        const tokens = TextProcessor.process(doc.content);

        invertedIndex.addDocument(doc.documentId, tokens);
    }

    console.log(
        `Index rebuilt. ${invertedIndex.getTotalDocuments()} documents, ${invertedIndex.getTotalTerms()} terms.`
    );
};

/**
 * Search the index and enrich results with title + snippet.
 *
 * Port of SearchService.search() in Java.
 *
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<{ query: string, totalResults: number, results: object[] }>}
 */
const search = async (query, topK) => {

    const results = SearchEngine.search(query, topK);

    // Enrich results with title and snippet from the database
    for (const result of results) {

        const doc = await Document.findOne({
            documentId: result.documentId,
        }).lean();

        if (doc) {
            result.title = doc.title;
            result.snippet = generateSnippet(doc.content, query);
        }
    }

    return {
        query,
        totalResults: results.length,
        results,
    };
};

/**
 * Crawl a URL, store the document, and add it to the index.
 *
 * Port of SearchService.indexUrl() in Java.
 *
 * @param {string} url
 * @returns {Promise<object>}
 */
const indexUrl = async (url) => {

    // Check if already indexed
    const exists = await Document.exists({ url });

    if (exists) {
        return {
            status: "already_indexed",
            message: "This URL has already been indexed.",
            url,
        };
    }

    // Crawl the page
    const page = await WebCrawler.crawl(url);

    // Create a document ID from the URL (same as Java version)
    const documentId = url;

    // Persist to database
    const document = new Document({
        documentId,
        title: page.title,
        content: page.textContent,
        url,
        indexedAt: new Date(),
    });

    await document.save();

    // Add to the inverted index
    const tokens = TextProcessor.process(page.textContent);
    invertedIndex.addDocument(documentId, tokens);

    console.log(`Indexed: ${url} (${tokens.length} tokens)`);

    return {
        status: "indexed",
        url,
        title: page.title,
        tokensIndexed: tokens.length,
    };
};

/**
 * Return index statistics.
 *
 * Port of SearchService.getStats() in Java.
 *
 * @returns {Promise<object>}
 */
const getStats = async () => {

    const stats = invertedIndex.getStats();

    stats.documentsInDatabase = await Document.countDocuments();

    return stats;
};

/**
 * Generate a snippet from the document content,
 * centered around the first occurrence of a query term.
 *
 * Port of SearchService.generateSnippet() in Java.
 * Same algorithm: find first query word position, extract ~200 chars centered around it.
 *
 * @param {string} content
 * @param {string} query
 * @returns {string}
 *
 * @private
 */
const generateSnippet = (content, query) => {

    if (!content || content.length === 0) {
        return "";
    }

    const lowerContent = content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);

    let bestPos = -1;

    for (const word of queryWords) {
        const pos = lowerContent.indexOf(word);
        if (pos !== -1) {
            bestPos = pos;
            break;
        }
    }

    const snippetLength = 200;

    if (bestPos === -1) {
        // No query term found; return the beginning
        const end = Math.min(snippetLength, content.length);
        return content.substring(0, end) + (content.length > snippetLength ? "..." : "");
    }

    const start = Math.max(0, bestPos - 60);
    const end = Math.min(content.length, start + snippetLength);

    let snippet = content.substring(start, end);

    if (start > 0) {
        snippet = "..." + snippet;
    }
    if (end < content.length) {
        snippet = snippet + "...";
    }

    return snippet;
};

export { rebuildIndex, search, indexUrl, getStats };
