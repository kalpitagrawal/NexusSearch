import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InvertedIndex } from "../src/engine/InvertedIndex.js";
import { rank, countPhraseMatches } from "../src/engine/RankingEngine.js";

describe("Exact Phrase Matching & Boost", () => {
    it("counts exact adjacent token sequences", () => {
        const index = new InvertedIndex();
        // doc1: "data structure and algorithm" -> tokens: ["data", "structur", "algorithm"]
        index.addDocument("doc1", ["data", "structur", "algorithm"]);

        // doc2: "data in modern system structure" -> tokens: ["data", "modern", "system", "structur"]
        index.addDocument("doc2", ["data", "modern", "system", "structur"]);

        const phraseTokens = ["data", "structur"];
        assert.equal(countPhraseMatches("doc1", phraseTokens, index), 1);
        assert.equal(countPhraseMatches("doc2", phraseTokens, index), 0);
    });

    it("boosts documents matching quoted phrases over documents with isolated terms", () => {
        const index = new InvertedIndex();
        index.addDocument("docExact", ["distribut", "system", "design"]);
        index.addDocument("docSeparated", ["distribut", "cache", "network", "system"]);

        const queryTokens = ["distribut", "system"];
        const phrases = [["distribut", "system"]];
        const candidates = index.getCandidates(queryTokens);

        const results = rank(candidates, queryTokens, 5, index, phrases);

        assert.equal(results.length, 2);
        assert.equal(results[0].documentId, "docExact");
        assert.ok(results[0].score > results[1].score);
    });
});
