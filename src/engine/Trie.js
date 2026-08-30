/**
 * Trie (Prefix Tree) — Data structure for real-time search autocompletion & prefix matching.
 *
 * Each node represents a single character. Words sharing prefixes share common ancestor nodes.
 * Tracks term frequency across indexed documents to rank top autocomplete suggestions.
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
     * Insert a word into the Trie with an optional frequency weight.
     *
     * @param {string} word
     * @param {number} [weight=1]
     */
    insert(word, weight = 1) {
        if (!word || typeof word !== "string") return;
        const normalized = word.toLowerCase().trim();
        if (!normalized) return;

        let curr = this.root;
        for (const char of normalized) {
            if (!curr.children.has(char)) {
                curr.children.set(char, new TrieNode());
            }
            curr = curr.children.get(char);
        }
        curr.isEndOfWord = true;
        curr.frequency += weight;
        curr.originalWord = normalized;
    }

    /**
     * Get top autocomplete suggestions for a given prefix.
     *
     * @param {string} prefix
     * @param {number} [maxResults=5]
     * @returns {string[]} array of suggested words sorted by frequency descending
     */
    getSuggestions(prefix, maxResults = 5) {
        if (!prefix || typeof prefix !== "string") return [];
        const normalized = prefix.toLowerCase().trim();
        if (!normalized) return [];

        let curr = this.root;
        for (const char of normalized) {
            if (!curr.children.has(char)) {
                return []; // No matches for prefix
            }
            curr = curr.children.get(char);
        }

        // Collect all descendant words
        const results = [];
        this._collectWords(curr, results);

        // Sort by frequency descending and return top maxResults
        results.sort((a, b) => b.frequency - a.frequency);
        return results.slice(0, maxResults).map(item => item.word);
    }

    /** @private */
    _collectWords(node, results) {
        if (node.isEndOfWord) {
            results.push({ word: node.originalWord, frequency: node.frequency });
        }
        for (const childNode of node.children.values()) {
            this._collectWords(childNode, results);
        }
    }

    /**
     * Clear the Trie.
     */
    clear() {
        this.root = new TrieNode();
    }
}

// Global Trie Component Instance
const trie = new Trie();

export { Trie, trie };
