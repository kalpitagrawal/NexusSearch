/**
 * SearchService — Business logic layer for indexing, BM25 searching,
 * domain faceting, and snippet generation.
 */
import { Document } from "../models/document.model.js";
import { InvertedIndex, getActiveIndex, setActiveIndex } from "../engine/InvertedIndex.js";
import * as TextProcessor from "../engine/TextProcessor.js";
import * as SearchEngine from "../engine/SearchEngine.js";
import * as RankingEngine from "../engine/RankingEngine.js";
import * as WebCrawler from "../crawler/WebCrawler.js";

let isReady = false;
let isRebuilding = false;

/**
 * Returns current index status for health and readiness checks.
 */
export const getIndexStatus = () => {
    const index = getActiveIndex();
    return {
        isReady,
        isRebuilding,
        totalDocuments: index.getTotalDocuments(),
        totalTerms: index.getTotalTerms()
    };
};

/**
 * Rebuild the inverted index from MongoDB asynchronously without blocking the event loop.
 * Streams documents via a Mongoose cursor and atomically swaps in the fresh index.
 */
export const rebuildIndex = async () => {
    if (isRebuilding) return;
    isRebuilding = true;

    try {
        console.log("Starting index build via streaming cursor...");
        const freshIndex = new InvertedIndex();
        let count = 0;

        const cursor = Document.find({}, { documentId: 1, content: 1 }).cursor();

        for await (const doc of cursor) {
            if (doc.content) {
                const { stemmedTokens, wordCounts } = TextProcessor.processDocument(doc.content);
                freshIndex.addDocument(doc.documentId, stemmedTokens, wordCounts);
                count++;
            }
        }

        // Atomically swap the new index into place
        setActiveIndex(freshIndex);
        isReady = true;

        console.log(
            `Index build complete. ${freshIndex.getTotalDocuments()} documents, ${freshIndex.getTotalTerms()} terms indexed.`
        );
    } catch (err) {
        console.error("Error during index rebuild:", err.message);
    } finally {
        isRebuilding = false;
    }
};

/**
 * Extract clean domain name by stripping leading "www.".
 * e.g. "https://www.bbc.co.uk/news" → "bbc.co.uk"
 *      "https://en.wikipedia.org/wiki/Algorithm" → "en.wikipedia.org"
 *
 * @param {string} urlStr
 * @returns {string}
 */
export const extractDomain = (urlStr) => {
    try {
        const hostname = new URL(urlStr).hostname.toLowerCase();
        return hostname.replace(/^www\./i, "");
    } catch (_) {
        return "other";
    }
};

/**
 * Search the index, rank via BM25 + Min-Heap top-K, enrich results in a single batch query,
 * and calculate domain facets over all matching candidates.
 *
 * @param {string} query
 * @param {number} [topK=50]
 * @param {number} [page=1]
 * @param {number} [limit=10]
 * @param {string} [targetDomain="all"]
 * @returns {Promise<object>}
 */
export const search = async (query, topK = 50, page = 1, limit = 10, targetDomain = "all") => {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);

    // 1. Retrieve query candidates and metadata
    const { queryTerms, phrases, candidates, index } = SearchEngine.getQueryCandidates(query);

    // 2. Build domain facets across the entire candidate set (O(N), no scoring overhead)
    const facetCounts = new Map();
    facetCounts.set("all", candidates.size);

    for (const docId of candidates) {
        const domain = extractDomain(docId);
        facetCounts.set(domain, (facetCounts.get(domain) || 0) + 1);
    }

    const facets = Array.from(facetCounts.entries()).map(([domain, count]) => ({
        domain,
        count
    }));

    // 3. Apply exact domain filter if specified
    let targetCandidates = candidates;
    if (targetDomain && targetDomain !== "all") {
        const cleanTarget = targetDomain.toLowerCase();
        targetCandidates = new Set();
        for (const docId of candidates) {
            if (extractDomain(docId) === cleanTarget) {
                targetCandidates.add(docId);
            }
        }
    }

    const totalResults = targetCandidates.size;

    // 4. Compute pagination parameters
    const totalPages = Math.ceil(totalResults / safeLimit) || 1;
    const currentPage = Math.min(safePage, totalPages);
    const startIndex = (currentPage - 1) * safeLimit;

    // 5. Rank with a bounded Min-Heap sized to required depth K = page * limit (capped at 200)
    // Preserves O(N log K) retrieval complexity for deep pagination
    const requiredK = Math.min(currentPage * safeLimit, 200);
    const rankedResults = RankingEngine.rank(
        targetCandidates,
        queryTerms,
        requiredK,
        index,
        phrases
    );

    const paginatedResults = rankedResults.slice(startIndex, startIndex + safeLimit);

    // 6. Enrich current page results in a SINGLE batch MongoDB query ($in), avoiding N+1 queries
    const docIds = paginatedResults.map(r => r.documentId);
    if (docIds.length > 0) {
        const docs = await Document.find(
            { documentId: { $in: docIds } },
            { documentId: 1, title: 1, content: 1 }
        ).lean();

        const docMap = new Map(docs.map(d => [d.documentId, d]));

        for (const result of paginatedResults) {
            const doc = docMap.get(result.documentId);
            if (doc) {
                result.title = doc.title || result.documentId;
                result.snippet = generateSnippet(doc.content, query);
            }
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
        results: paginatedResults
    };
};

/**
 * Crawl & Index a URL — Supports Single Page or Depth-Limited Iterative BFS Crawling.
 *
 * @param {string} seedUrl - Starting URL
 * @param {number} [maxDepth=1] - Max crawling depth (default 1, max 2 in demo mode)
 * @param {number} [maxPages=1] - Max pages to index (default 1, max 5 in demo mode)
 * @param {object} [options={}] - Optional crawler settings (e.g. sameDomainOnly)
 * @returns {Promise<object>} Detailed crawl and index summary
 */
export const indexUrl = async (seedUrl, maxDepth = 1, maxPages = 1, options = {}) => {
    // Enforce demo-mode safety caps to protect server & database
    const depthLimit = Math.min(Math.max(1, maxDepth), 2);
    const pagesLimit = Math.min(Math.max(1, maxPages), 5);

    const queue = [{ url: seedUrl, depth: 1 }];
    const visited = new Set();

    const indexedPages = [];
    const skippedPages = [];
    const errorPages = [];

    const activeIdx = getActiveIndex();

    while (queue.length > 0 && indexedPages.length < pagesLimit) {
        const { url, depth } = queue.shift();

        if (visited.has(url)) continue;
        visited.add(url);

        // Check if already indexed via indexed documentId (O(1) B-tree lookup)
        const exists = await Document.exists({ documentId: url });
        if (exists) {
            skippedPages.push({ url, reason: "already_indexed" });
            continue;
        }

        try {
            const page = await WebCrawler.crawl(url, options);
            const documentId = page.url;

            // Persist document to MongoDB
            const document = new Document({
                documentId,
                title: page.title,
                content: page.textContent,
                url: page.url,
                indexedAt: new Date()
            });
            await document.save();

            // Extract tokens and words; update active inverted index & Trie
            const { stemmedTokens, wordCounts } = TextProcessor.processDocument(page.textContent);
            activeIdx.addDocument(documentId, stemmedTokens, wordCounts);

            console.log(`[Depth ${depth}] Indexed: ${page.url} (${stemmedTokens.length} tokens)`);

            indexedPages.push({
                url: page.url,
                title: page.title,
                tokensIndexed: stemmedTokens.length,
                depth,
                childLinksFound: page.links.length
            });

            // Enqueue child links if depth allows
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

    // Single-page response format for backward compatibility
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
            url: seedUrl
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
 * Return index and database metrics.
 */
export const getStats = async () => {
    const stats = getActiveIndex().getStats();
    stats.documentsInDatabase = await Document.countDocuments();
    return stats;
};

/**
 * Generate a ~200 character snippet centered around the first occurrence of a query term.
 */
export const generateSnippet = (content, query) => {
    if (!content || typeof content !== "string" || content.length === 0) {
        return "";
    }

    const lowerContent = content.toLowerCase();
    const queryWords = (query || "").toLowerCase().split(/\s+/).filter(w => w.length > 1);

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

/**
 * Retrieve autocomplete suggestions for a prefix.
 */
export const getSuggestions = (prefix, limit = 5) => {
    if (!prefix || !prefix.trim()) return [];
    return getActiveIndex().getSuggestions(prefix.trim(), limit);
};

/**
 * Retrieve a stored document by documentId for cached viewing.
 */
export const getDocument = async (documentId) => {
    if (!documentId) return null;
    const doc = await Document.findOne({ documentId }).lean();
    if (!doc) return null;
    return {
        id: doc._id,
        documentId: doc.documentId,
        url: doc.url,
        title: doc.title,
        content: doc.content,
        indexedAt: doc.indexedAt,
        tokenLength: getActiveIndex().getDocumentLength(doc.documentId) || 0
    };
};
