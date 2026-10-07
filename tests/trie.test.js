import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Trie } from "../src/engine/Trie.js";

describe("Trie Prefix Tree", () => {
    it("inserts real words and suggests prefixes ordered by frequency", () => {
        const trie = new Trie();
        trie.insert("algorithm", 5);
        trie.insert("algebra", 2);
        trie.insert("algorithmic", 10);
        trie.insert("allocate", 8);

        const algSuggestions = trie.getSuggestions("alg", 5);
        assert.deepEqual(algSuggestions, ["algorithmic", "algorithm", "algebra"]);
    });

    it("respects the maxResults limit", () => {
        const trie = new Trie();
        for (let i = 1; i <= 20; i++) {
            trie.insert(`testing${i}`, i);
        }

        const suggestions = trie.getSuggestions("test", 5);
        assert.equal(suggestions.length, 5);
        assert.equal(suggestions[0], "testing20");
        assert.equal(suggestions[1], "testing19");
    });

    it("returns empty array for non-existent prefix or empty input", () => {
        const trie = new Trie();
        trie.insert("react", 10);

        assert.deepEqual(trie.getSuggestions("vue"), []);
        assert.deepEqual(trie.getSuggestions(""), []);
        assert.deepEqual(trie.getSuggestions(null), []);
    });

    it("clears all words properly", () => {
        const trie = new Trie();
        trie.insert("search", 1);
        trie.clear();
        assert.deepEqual(trie.getSuggestions("sea"), []);
    });
});
