import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MinHeap } from "../src/engine/RankingEngine.js";
import { SearchResult } from "../src/engine/SearchResult.js";

describe("MinHeap Priority Queue", () => {
    it("maintains minimum score at root", () => {
        const heap = new MinHeap();
        heap.offer(new SearchResult("doc3", 3.5));
        heap.offer(new SearchResult("doc1", 1.2));
        heap.offer(new SearchResult("doc2", 2.8));

        assert.equal(heap.size, 3);
        assert.equal(heap.peek().score, 1.2);
        assert.equal(heap.peek().documentId, "doc1");
    });

    it("polls elements in ascending score order", () => {
        const heap = new MinHeap();
        heap.offer(new SearchResult("d5", 5));
        heap.offer(new SearchResult("d2", 2));
        heap.offer(new SearchResult("d8", 8));
        heap.offer(new SearchResult("d1", 1));

        assert.equal(heap.poll().score, 1);
        assert.equal(heap.poll().score, 2);
        assert.equal(heap.poll().score, 5);
        assert.equal(heap.poll().score, 8);
        assert.equal(heap.poll(), undefined);
    });

    it("correctly bounds capacity for top-K selection", () => {
        const K = 3;
        const heap = new MinHeap();
        const scores = [4.1, 1.2, 9.5, 3.3, 7.8, 6.0];

        for (let i = 0; i < scores.length; i++) {
            const res = new SearchResult(`doc${i}`, scores[i]);
            if (heap.size < K) {
                heap.offer(res);
            } else if (res.score > heap.peek().score) {
                heap.poll();
                heap.offer(res);
            }
        }

        assert.equal(heap.size, K);
        const topElements = heap.toArray().sort((a, b) => b.score - a.score);
        assert.deepEqual(
            topElements.map(e => e.score),
            [9.5, 7.8, 6.0]
        );
    });
});
