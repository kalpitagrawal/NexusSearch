/**
 * SearchService — Business logic layer.
 *
 * Direct port & enhancement of SearchService.java
 *
 * Methods:
 *   - rebuildIndex()   — Load all docs from MongoDB, rebuild the in-memory inverted index
 *   - search()         — Search + BM25 ranking + MongoDB title/snippet enrichment + Pagination
 *   - indexUrl()       — Single-page or Recursive BFS Crawling & Indexing
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
 * Search the index, rank via BM25, enrich page results from DB, and return paginated object.
 *
 * @param {string} query
/**
 * Helper to extract main domain/hostname from a document URL.
 * E.g. "https://en.wikipedia.org/wiki/Algorithm" → "wikipedia.org"
 */
const extractDomain = (urlStr) => {
    try {
        const hostname = new URL(urlStr).hostname;
        const parts = hostname.split(".");
        if (parts.length >= 2) {
            return parts.slice(-2).join(".");
        }
        return hostname;
    } catch (_) {
        return "other";
    }
};

/**
 * Search the index, rank via BM25 + Phrase Boost, compute domain facets, apply domain filtering, and return paginated object.
 *
 * @param {string} query
 * @param {number} topK - Total candidates to rank from MinHeap
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Results per page
 * @param {string} targetDomain - Optional domain filter (e.g. "wikipedia.org" or "all")
 * @returns {Promise<{ query: string, totalResults: number, page: number, limit: number, totalPages: number, activeDomain: string, facets: object[], results: object[] }>}
 */
const search = async (query, topK = 50, page = 1, limit = 10, targetDomain = "all") => {

    const safeTopK = Math.min(Math.max(1, topK), 200);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);

    // 1. Retrieve top-K ranked results from BM25 ranking engine
    const allResults = SearchEngine.search(query, safeTopK);

    // 2. Build domain facets map across all candidate results
    const facetCounts = new Map();
    facetCounts.set("all", allResults.length);

    allResults.forEach(r => {
        const domain = extractDomain(r.documentId);
        facetCounts.set(domain, (facetCounts.get(domain) || 0) + 1);
    });

    const facets = Array.from(facetCounts.entries()).map(([domain, count]) => ({
        domain,
        count
    }));

    // 3. Apply domain filtering if targetDomain is specified and not "all"
    let filteredResults = allResults;
    if (targetDomain && targetDomain !== "all") {
        const cleanTarget = targetDomain.toLowerCase();
        filteredResults = allResults.filter(r => {
            const dom = extractDomain(r.documentId).toLowerCase();
            return dom === cleanTarget || r.documentId.toLowerCase().includes(cleanTarget);
        });
    }

    const totalResults = filteredResults.length;

    // 4. Compute pagination bounds
    const totalPages = Math.ceil(totalResults / safeLimit) || 1;
    const currentPage = Math.min(safePage, totalPages);
    const startIndex = (currentPage - 1) * safeLimit;
    const paginatedResults = filteredResults.slice(startIndex, startIndex + safeLimit);

    // 5. Enrich current page's results with title and snippet from MongoDB
    for (const result of paginatedResults) {
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
        totalResults,
        page: currentPage,
        limit: safeLimit,
        totalPages,
        activeDomain: targetDomain || "all",
        facets,
        results: paginatedResults,
    };
};

/**
 * Crawl & Index a URL — Supports Single Page or Recursive BFS Crawling.
 *
 * @param {string} seedUrl - Starting URL
 * @param {number} maxDepth - Max crawling depth (1 = seed page only)
 * @param {number} maxPages - Max total pages to index
 * @returns {Promise<object>} Detailed summary of indexed, skipped, and errored pages
 */
const indexUrl = async (seedUrl, maxDepth = 1, maxPages = 1) => {

    // Enforce limits for safety
    const depthLimit = Math.min(Math.max(1, maxDepth), 5);
    const pagesLimit = Math.min(Math.max(1, maxPages), 50);

    // BFS Queue: [{ url, depth }]
    const queue = [{ url: seedUrl, depth: 1 }];
    const visited = new Set();

    const indexedPages = [];
    const skippedPages = [];
    const errorPages = [];

    while (queue.length > 0 && indexedPages.length < pagesLimit) {
        const { url, depth } = queue.shift();

        if (visited.has(url)) continue;
        visited.add(url);

        // Check if already indexed in database
        const exists = await Document.exists({ url });
        if (exists) {
            skippedPages.push({ url, reason: "already_indexed" });
            continue;
        }

        try {
            // Fetch page, text content, and extracted links
            const page = await WebCrawler.crawl(url);
            const documentId = url;

            // Persist document to MongoDB
            const document = new Document({
                documentId,
                title: page.title,
                content: page.textContent,
                url,
                indexedAt: new Date(),
            });
            await document.save();

            // Process tokens and add to Inverted Index
            const tokens = TextProcessor.process(page.textContent);
            invertedIndex.addDocument(documentId, tokens);

            console.log(`[Depth ${depth}] Indexed: ${url} (${tokens.length} tokens)`);

            indexedPages.push({
                url,
                title: page.title,
                tokensIndexed: tokens.length,
                depth,
                childLinksFound: page.links.length
            });

            // Enqueue discovered child links if depth limit allows
            if (depth < depthLimit) {
                for (const childUrl of page.links) {
                    if (!visited.has(childUrl)) {
                        queue.push({ url: childUrl, depth: depth + 1 });
                    }
                }
            }

        } catch (err) {
            console.error(`[Depth ${depth}] Crawl Error (${url}):`, err.message);
            errorPages.push({ url, depth, error: err.message });
        }
    }

    // Format single-page response for backward compatibility if maxPages == 1
    if (pagesLimit === 1 && indexedPages.length === 1) {
        return {
            status: "indexed",
            url: indexedPages[0].url,
            title: indexedPages[0].title,
            tokensIndexed: indexedPages[0].tokensIndexed,
            childLinksFound: indexedPages[0].childLinksFound
        };
    }

    if (pagesLimit === 1 && skippedPages.length === 1 && indexedPages.length === 0) {
        return {
            status: "already_indexed",
            message: "This URL has already been indexed.",
            url: seedUrl,
        };
    }

    const maxDepthReached = indexedPages.reduce((max, p) => Math.max(max, p.depth), 0);
    const stoppedReason = indexedPages.length >= pagesLimit
        ? "max_pages_reached"
        : (maxDepthReached >= depthLimit ? "max_depth_reached" : "queue_empty");

    return {
        status: indexedPages.length > 0 ? "indexed" : "no_pages_indexed",
        summary: {
            totalPagesIndexed: indexedPages.length,
            totalPagesSkipped: skippedPages.length,
            totalPagesErrored: errorPages.length,
            maxDepthReached,
            requestedMaxDepth: depthLimit,
            requestedMaxPages: pagesLimit,
            stoppedReason
        },
        indexedPages,
        skippedPages,
        errorPages
    };
};

/**
 * Return index statistics.
 */
const getStats = async () => {

    const stats = invertedIndex.getStats();
    stats.documentsInDatabase = await Document.countDocuments();
    return stats;
};

/**
 * Generate a snippet from the document content,
 * centered around the first occurrence of a query term.
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

const getSuggestions = (prefix, limit = 5) => {
    if (!prefix || !prefix.trim()) return [];
    return invertedIndex.getSuggestions(prefix.trim(), limit);
};

export { rebuildIndex, search, indexUrl, getStats, getSuggestions };
