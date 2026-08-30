/**
 * TextProcessor — Normalizes raw text into searchable tokens.
 *
 * Pipeline:
 *   1. Lowercase the text
 *   2. Replace all non-alphanumeric characters with spaces
 *   3. Split on whitespace
 *   4. Filter out blank tokens
 *   5. Filter out stop words
 *
 * Direct port of TextProcessor.java
 * Same stop words set as the Java version.
 */

const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "am",
    "and", "or", "of", "to", "in", "for"
]);

/**
 * Process raw text into a list of searchable tokens.
 *
 * @param {string} text - raw text to process
 * @returns {string[]} - list of processed tokens
 */
const process = (text) => {

    if (!text) return [];

    // Step 1: Lowercase
    // Step 2: Replace non-alphanumeric with spaces
    const normalizedText = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ");

    // Step 3: Split on whitespace
    // Step 4: Filter blank tokens
    // Step 5: Filter stop words
    return normalizedText
        .split(/\s+/)
        .filter(word => word.length > 0)
        .filter(word => !STOP_WORDS.has(word));
};

/**
 * Process a user search query, extracting both overall tokens
 * and any exact quoted phrases (e.g. "data structure").
 *
 * @param {string} query
 * @returns {{ tokens: string[], phrases: string[][] }}
 */
const processQuery = (query) => {
    if (!query) return { tokens: [], phrases: [] };

    const phrases = [];

    // Extract exact phrases inside double quotes
    const quoteRegex = /"([^"]+)"/g;
    let match;

    while ((match = quoteRegex.exec(query)) !== null) {
        const rawPhrase = match[1];
        const phraseTokens = process(rawPhrase);
        if (phraseTokens.length > 1) {
            phrases.push(phraseTokens);
        }
    }

    // Process all tokens in query (including tokens from phrases)
    const tokens = process(query);

    return {
        tokens,
        phrases
    };
};

export { process, processQuery, STOP_WORDS };
