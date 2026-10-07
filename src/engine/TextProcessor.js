/**
 * TextProcessor — Normalizes raw text into searchable tokens with Porter Stemming.
 *
 * Pipeline:
 *   1. Lowercase text
 *   2. Replace non-alphanumeric characters with spaces
 *   3. Split on whitespace
 *   4. Filter stop words & single-character tokens
 *   5. Track unstemmed word frequencies for autocomplete Trie
 *   6. Apply Porter Stemmer to reduce words to root form for the Inverted Index
 */
import { stem } from "./PorterStemmer.js";

const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "am",
    "and", "or", "of", "to", "in", "for",
    "on", "at", "by", "with", "from", "as",
    "this", "that", "it", "not", "be", "was"
]);

/**
 * Process raw text into a list of stemmed tokens for indexing and search.
 *
 * @param {string} text - Raw text to process
 * @returns {string[]} List of processed stemmed tokens
 */
const process = (text) => {
    if (!text || typeof text !== "string") return [];

    const normalizedText = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ");

    return normalizedText
        .split(/\s+/)
        .filter(word => word.length > 0 && !STOP_WORDS.has(word))
        .map(word => stem(word));
};

/**
 * Process a document for indexing, extracting both stemmed tokens for the inverted index
 * and aggregated counts of original unstemmed words for the autocomplete Trie.
 *
 * @param {string} text - Raw document text
 * @returns {{ stemmedTokens: string[], wordCounts: Map<string, number> }}
 */
const processDocument = (text) => {
    if (!text || typeof text !== "string") {
        return { stemmedTokens: [], wordCounts: new Map() };
    }

    const normalizedText = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ");

    const rawWords = normalizedText
        .split(/\s+/)
        .filter(word => word.length > 1 && !STOP_WORDS.has(word));

    const stemmedTokens = [];
    const wordCounts = new Map();

    for (const word of rawWords) {
        stemmedTokens.push(stem(word));
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    return { stemmedTokens, wordCounts };
};

/**
 * Process a user search query, extracting both overall stemmed tokens
 * and any exact quoted phrases (e.g. "data structure").
 *
 * @param {string} query
 * @returns {{ tokens: string[], phrases: string[][] }}
 */
const processQuery = (query) => {
    if (!query || typeof query !== "string") return { tokens: [], phrases: [] };

    const phrases = [];
    const quoteRegex = /"([^"]+)"/g;
    let match;

    while ((match = quoteRegex.exec(query)) !== null) {
        const rawPhrase = match[1];
        const phraseTokens = process(rawPhrase);
        if (phraseTokens.length > 1) {
            phrases.push(phraseTokens);
        }
    }

    const tokens = process(query);

    return {
        tokens,
        phrases
    };
};

export { process, processDocument, processQuery, STOP_WORDS };
