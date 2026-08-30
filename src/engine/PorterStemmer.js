/**
 * PorterStemmer — Standard Martin Porter Stemming Algorithm (1980).
 *
 * Reduces English words to their root/stem form:
 *   running    → run
 *   runs       → run
 *   crawling   → crawl
 *   crawled    → crawl
 *   algorithms → algorithm
 *   indexing   → index
 *   indexed    → index
 *
 * Ensures query words and document tokens align at their morphological root.
 */

const step1aRules = [
    { suffix: "sses", replacement: "ss" },
    { suffix: "ies", replacement: "i" },
    { suffix: "ss", replacement: "ss" },
    { suffix: "s", replacement: "" }
];

const step2Rules = [
    { suffix: "ational", replacement: "ate" },
    { suffix: "tional", replacement: "tion" },
    { suffix: "enci", replacement: "ence" },
    { suffix: "anci", replacement: "ance" },
    { suffix: "izer", replacement: "ize" },
    { suffix: "abli", replacement: "able" },
    { suffix: "alli", replacement: "al" },
    { suffix: "entli", replacement: "ent" },
    { suffix: "eli", replacement: "e" },
    { suffix: "ousli", replacement: "ous" },
    { suffix: "ization", replacement: "ize" },
    { suffix: "ation", replacement: "ate" },
    { suffix: "ator", replacement: "ate" },
    { suffix: "alism", replacement: "al" },
    { suffix: "iveness", replacement: "ive" },
    { suffix: "fulness", replacement: "ful" },
    { suffix: "ousness", replacement: "ous" },
    { suffix: "aliti", replacement: "al" },
    { suffix: "iviti", replacement: "ive" },
    { suffix: "biliti", replacement: "ble" }
];

const step3Rules = [
    { suffix: "icate", replacement: "ic" },
    { suffix: "ative", replacement: "" },
    { suffix: "alize", replacement: "al" },
    { suffix: "iciti", replacement: "ic" },
    { suffix: "ical", replacement: "ic" },
    { suffix: "ful", replacement: "" },
    { suffix: "ness", replacement: "" }
];

const step4Rules = [
    "al", "ance", "ence", "er", "ic", "able", "ible", "ant",
    "ement", "ment", "ent", "ion", "ou", "ism", "ate", "iti", "ous", "ive", "ize"
];

function isVowel(letter) {
    return ["a", "e", "i", "o", "u"].includes(letter);
}

function hasVowel(stem) {
    for (let i = 0; i < stem.length; i++) {
        if (isVowel(stem[i])) return true;
    }
    return false;
}

function getMeasure(stem) {
    let count = 0;
    let inVowelSequence = false;

    for (let i = 0; i < stem.length; i++) {
        const vowel = isVowel(stem[i]);
        if (vowel) {
            inVowelSequence = true;
        } else {
            if (inVowelSequence) {
                count++;
                inVowelSequence = false;
            }
        }
    }
    return count;
}

function endsWithDoubleConsonant(stem) {
    if (stem.length < 2) return false;
    const last = stem[stem.length - 1];
    const prev = stem[stem.length - 2];
    return last === prev && !isVowel(last);
}

function cvc(stem) {
    if (stem.length < 3) return false;
    const c1 = !isVowel(stem[stem.length - 3]);
    const v = isVowel(stem[stem.length - 2]);
    const c2 = !isVowel(stem[stem.length - 1]);
    const lastChar = stem[stem.length - 1];
    return c1 && v && c2 && !["w", "x", "y"].includes(lastChar);
}

/**
 * Stem an English word to its root.
 *
 * @param {string} word
 * @returns {string} stemmed word
 */
function stem(word) {
    if (!word || word.length <= 2) return word;

    let w = word.toLowerCase();

    // Step 1a
    for (const rule of step1aRules) {
        if (w.endsWith(rule.suffix)) {
            w = w.slice(0, -rule.suffix.length) + rule.replacement;
            break;
        }
    }

    // Step 1b
    let step1bExtra = false;
    if (w.endsWith("eed")) {
        const stemStr = w.slice(0, -3);
        if (getMeasure(stemStr) > 0) {
            w = stemStr + "ee";
        }
    } else if (w.endsWith("ed")) {
        const stemStr = w.slice(0, -2);
        if (hasVowel(stemStr)) {
            w = stemStr;
            step1bExtra = true;
        }
    } else if (w.endsWith("ing")) {
        const stemStr = w.slice(0, -3);
        if (hasVowel(stemStr)) {
            w = stemStr;
            step1bExtra = true;
        }
    }

    if (step1bExtra) {
        if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) {
            w += "e";
        } else if (endsWithDoubleConsonant(w) && !["l", "s", "z"].includes(w[w.length - 1])) {
            w = w.slice(0, -1);
        } else if (getMeasure(w) === 1 && cvc(w)) {
            w += "e";
        }
    }

    // Step 1c
    if (w.endsWith("y")) {
        const stemStr = w.slice(0, -1);
        if (hasVowel(stemStr)) {
            w = stemStr + "i";
        }
    }

    // Step 2
    for (const rule of step2Rules) {
        if (w.endsWith(rule.suffix)) {
            const stemStr = w.slice(0, -rule.suffix.length);
            if (getMeasure(stemStr) > 0) {
                w = stemStr + rule.replacement;
            }
            break;
        }
    }

    // Step 3
    for (const rule of step3Rules) {
        if (w.endsWith(rule.suffix)) {
            const stemStr = w.slice(0, -rule.suffix.length);
            if (getMeasure(stemStr) > 0) {
                w = stemStr + rule.replacement;
            }
            break;
        }
    }

    // Step 4
    for (const suffix of step4Rules) {
        if (w.endsWith(suffix)) {
            const stemStr = w.slice(0, -suffix.length);
            if (getMeasure(stemStr) > 1) {
                if (suffix === "ion") {
                    const lastChar = stemStr[stemStr.length - 1];
                    if (lastChar === "s" || lastChar === "t") {
                        w = stemStr;
                    }
                } else {
                    w = stemStr;
                }
            }
            break;
        }
    }

    // Step 5a
    if (w.endsWith("e")) {
        const stemStr = w.slice(0, -1);
        const m = getMeasure(stemStr);
        if (m > 1 || (m === 1 && !cvc(stemStr))) {
            w = stemStr;
        }
    }

    // Step 5b
    if (getMeasure(w) > 1 && endsWithDoubleConsonant(w) && w.endsWith("l")) {
        w = w.slice(0, -1);
    }

    return w;
}

export { stem };
