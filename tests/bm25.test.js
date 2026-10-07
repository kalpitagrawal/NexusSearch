import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InvertedIndex } from "../src/engine/InvertedIndex.js";
import { rank } from "../src/engine/RankingEngine.js";
import * as TextProcessor from "../src/engine/TextProcessor.js";

describe("BM25 Relevance Scoring & Ordering", () => {
    it("ranks higher frequency and shorter documents higher", () => {
        const index = new InvertedIndex();

        // Doc 1: Short document mentioning 'database' twice
        const doc1Tokens = ["databas", "databas", "system"];
        index.addDocument("doc1", doc1Tokens);

        // Doc 2: Long document mentioning 'database' once among filler terms
        const doc2Tokens = ["databas", "filler", "extra", "word", "more", "padding", "content"];
        index.addDocument("doc2", doc2Tokens);

        // Doc 3: Mentioning 'system' only
        const doc3Tokens = ["system", "network"];
        index.addDocument("doc3", doc3Tokens);

        const candidates = index.getCandidates(["databas"]);
        const results = rank(candidates, ["databas"], 10, index);

        assert.equal(results.length, 2);
        assert.equal(results[0].documentId, "doc1");
        assert.equal(results[1].documentId, "doc2");
        assert.ok(results[0].score > results[1].score);
    });

    it("evaluates O(1) average document length correctly after document additions and clears", () => {
        const index = new InvertedIndex();
        assert.equal(index.getAverageDocumentLength(), 0);

        index.addDocument("d1", ["a", "b", "c", "d"]); // 4
        index.addDocument("d2", ["e", "f"]); // 2
        assert.equal(index.getAverageDocumentLength(), 3);

        // Update d1 with 6 tokens
        index.addDocument("d1", ["a", "b", "c", "d", "e", "f"]); // 6
        assert.equal(index.getAverageDocumentLength(), 4);

        index.clear();
        assert.equal(index.getAverageDocumentLength(), 0);
        assert.equal(index.getTotalDocuments(), 0);
    });
});
