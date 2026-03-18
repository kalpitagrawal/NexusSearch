

export const textProcessor =  (repoName, repoDescription, Readme) => {
    const completeText = `${repoName} ${repoDescription} ${Readme}`
    const stopWords = new Set([
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
        "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
        "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further",
        "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
        "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my",
        "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
        "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such", "than",
        "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
        "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were",
        "what", "when", "where", "which", "while", "who", "whom", "why", "with", "you", "your",
        "yours", "yourself", "yourselves"
    ])
    const tokens = completeText
        .toLowerCase()
        .replace(/(<([^>]+)>)/ig, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\n/g, " ")  
        .split(/\s+/)

    const filteredTokens = tokens.filter(word => !stopWords.has(word) && word.length > 0);

    return filteredTokens;

}