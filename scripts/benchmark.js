/**
 * Benchmark Script — Validates and measures algorithmic performance:
 *   1. InvertedIndex construction throughput
 *   2. Trie prefix autocomplete lookup latency (mean & p99)
 *   3. BM25 + Min-Heap top-K search latency across synthetic corpus
 */
import { InvertedIndex } from "../src/engine/InvertedIndex.js";
import { rank } from "../src/engine/RankingEngine.js";
import * as TextProcessor from "../src/engine/TextProcessor.js";

const VOCABULARY = [
    "algorithm", "algebra", "algorithmic", "allocate", "allotment", "analysis", "analytics",
    "application", "applied", "applet", "backend", "binary", "benchmark", "boolean",
    "compiler", "complexity", "concurrency", "database", "distributed", "dynamic",
    "engine", "enumeration", "execution", "framework", "frontend", "garbage", "graph",
    "hashmap", "heuristic", "indexing", "interface", "iteration", "javascript", "kernel",
    "latency", "lexical", "memory", "minheap", "multithreading", "network", "node",
    "optimization", "parser", "pipeline", "pointer", "polymorphism", "query", "queue",
    "ranking", "recursion", "reduction", "retrieval", "router", "runtime", "scalability",
    "search", "socket", "sorting", "stack", "storage", "streaming", "structure",
    "throughput", "tokenization", "tree", "trie", "unicode", "variable", "vector", "virtual"
];

function generateDocument(docId, wordCount = 300) {
    const words = [];
    for (let i = 0; i < wordCount; i++) {
        const randWord = VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)];
        words.push(randWord);
    }
    return {
        documentId: `doc_${docId}`,
        content: words.join(" ")
    };
}

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

async function runBenchmark() {
    console.log("=================================================");
    console.log("   NexusSearch Algorithmic Performance Benchmark  ");
    console.log("=================================================\n");

    const index = new InvertedIndex();
    const NUM_DOCS = 100;
    const WORDS_PER_DOC = 300;

    console.log(`1. Generating & Indexing ${NUM_DOCS} synthetic documents (${NUM_DOCS * WORDS_PER_DOC} words total)...`);

    const t0 = performance.now();
    for (let i = 1; i <= NUM_DOCS; i++) {
        const doc = generateDocument(i, WORDS_PER_DOC);
        const { stemmedTokens, wordCounts } = TextProcessor.processDocument(doc.content);
        index.addDocument(doc.documentId, stemmedTokens, wordCounts);
    }
    const tIndex = performance.now() - t0;

    console.log(`   ✓ Indexed ${index.getTotalDocuments()} docs with ${index.getTotalTerms()} unique terms in ${tIndex.toFixed(2)} ms.`);
    console.log(`   ✓ Average document length: ${index.getAverageDocumentLength().toFixed(1)} tokens.\n`);

    // 2. Trie Autocomplete Latency Benchmark
    console.log("2. Benchmarking Trie Autocomplete (GET /api/suggest)...");
    const testPrefixes = ["al", "alg", "da", "di", "se", "re", "op", "qu"];
    const TRIE_RUNS = 1000;
    const trieLatencies = [];

    for (let i = 0; i < TRIE_RUNS; i++) {
        const prefix = testPrefixes[i % testPrefixes.length];
        const start = performance.now();
        index.getSuggestions(prefix, 5);
        trieLatencies.push(performance.now() - start);
    }

    const trieMean = trieLatencies.reduce((a, b) => a + b, 0) / trieLatencies.length;
    const trieP99 = percentile(trieLatencies, 99);

    console.log(`   Runs: ${TRIE_RUNS} requests across various 2-3 char prefixes`);
    console.log(`   Mean Latency: ${(trieMean * 1000).toFixed(2)} µs (${trieMean.toFixed(4)} ms)`);
    console.log(`   p99 Latency:  ${(trieP99 * 1000).toFixed(2)} µs (${trieP99.toFixed(4)} ms)\n`);

    // 3. BM25 Search + Min-Heap Top-K Benchmark
    console.log("3. Benchmarking BM25 Search + MinHeap Top-K (GET /api/search)...");
    const testQueries = ["algorithm", "database system", "distributed search", "indexing memory", "pipeline"];
    const SEARCH_RUNS = 500;
    const searchLatencies = [];

    for (let i = 0; i < SEARCH_RUNS; i++) {
        const q = testQueries[i % testQueries.length];
        const start = performance.now();
        const { tokens, phrases } = TextProcessor.processQuery(q);
        const queryTerms = [...new Set(tokens)];
        const candidates = index.getCandidates(queryTerms);
        rank(candidates, queryTerms, 10, index, phrases);
        searchLatencies.push(performance.now() - start);
    }

    const searchMean = searchLatencies.reduce((a, b) => a + b, 0) / searchLatencies.length;
    const searchP99 = percentile(searchLatencies, 99);

    console.log(`   Runs: ${SEARCH_RUNS} searches (topK = 10)`);
    console.log(`   Mean Latency: ${searchMean.toFixed(4)} ms`);
    console.log(`   p99 Latency:  ${searchP99.toFixed(4)} ms\n`);

    console.log("=================================================");
    console.log("   Benchmark Summary Complete                     ");
    console.log("=================================================");
}

runBenchmark();
