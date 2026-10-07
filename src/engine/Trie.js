/**
 * Trie (Prefix Tree) — Autocomplete and prefix matching index.
 *
 * Stores unstemmed vocabulary words weighted by corpus term frequency.
 * Uses a size-bounded min-heap during prefix traversal for top-K suggestion retrieval.
 */

class TrieNode {
    constructor() {
        /** @type {Map<string, TrieNode>} */
        this.children = new Map();
        this.isEndOfWord = false;
        this.frequency = 0;
        this.originalWord = "";
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    /**
     * Insert a word into the Trie with an aggregated frequency count.
     *
     * @param {string} word - Normalized unstemmed word
     * @param {number} [weight=1] - Word frequency count in document
     */
    insert(word, weight = 1) {
        if (!word || typeof word !== "string") return;
        const normalized = word.toLowerCase().trim();
        if (!normalized || normalized.length < 2) return;

        let curr = this.root;
        for (const char of normalized) {
            let child = curr.children.get(char);
            if (!child) {
                child = new TrieNode();
                curr.children.set(char, child);
            }
            curr = child;
        }

        curr.isEndOfWord = true;
        curr.frequency += weight;
        curr.originalWord = normalized;
    }

    /**
     * Retrieve top autocomplete suggestions for a prefix using a bounded Min-Heap.
     *
     * @param {string} prefix - Term prefix
     * @param {number} [maxResults=5] - Maximum number of suggestions to return
     * @returns {string[]} Array of suggested words sorted by frequency descending
     */
    getSuggestions(prefix, maxResults = 5) {
        if (!prefix || typeof prefix !== "string") return [];
        const normalized = prefix.toLowerCase().trim();
        if (!normalized) return [];

        let curr = this.root;
        for (const char of normalized) {
            const child = curr.children.get(char);
            if (!child) {
                return [];
            }
            curr = child;
        }

        // Bounded collection using min-heap logic to avoid unbounded subtree array allocations
        const heap = []; // Min-heap ordered by frequency ascending

        const pushToHeap = (candidate) => {
            if (heap.length < maxResults) {
                heap.push(candidate);
                heap.sort((a, b) => a.frequency - b.frequency);
            } else if (candidate.frequency > heap[0].frequency) {
                heap[0] = candidate;
                heap.sort((a, b) => a.frequency - b.frequency);
            }
        };

        const traverse = (node) => {
            if (node.isEndOfWord) {
                pushToHeap({ word: node.originalWord, frequency: node.frequency });
            }
            for (const childNode of node.children.values()) {
                traverse(childNode);
            }
        };

        traverse(curr);

        // Sort top-K candidates descending by frequency
        heap.sort((a, b) => b.frequency - a.frequency);
        return heap.map(item => item.word);
    }

    /**
     * Clear all nodes from the Trie.
     */
    clear() {
        this.root = new TrieNode();
    }
}

export { Trie, TrieNode };
