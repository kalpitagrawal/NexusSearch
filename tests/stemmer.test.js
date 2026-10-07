import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stem } from "../src/engine/PorterStemmer.js";

describe("PorterStemmer", () => {
    it("stems basic plurals and third person singular", () => {
        assert.equal(stem("cats"), "cat");
        assert.equal(stem("processes"), "process");
        assert.equal(stem("ponies"), "poni");
        assert.equal(stem("ties"), "ti");
    });

    it("stems past participle and gerund forms", () => {
        assert.equal(stem("motoring"), "motor");
        assert.equal(stem("sing"), "sing");
        assert.equal(stem("feed"), "feed");
        assert.equal(stem("agreed"), "agre");
        assert.equal(stem("plastered"), "plaster");
    });

    it("handles short words without improper truncation", () => {
        assert.equal(stem("as"), "as");
        assert.equal(stem("at"), "at");
        assert.equal(stem("be"), "be");
    });

    it("handles non-string or empty inputs safely", () => {
        assert.equal(stem(""), "");
        assert.equal(stem(null), "");
        assert.equal(stem(undefined), "");
    });
});
