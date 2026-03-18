export const ranking = (query, repos) => {
    const queryTokens = query
        .toLowerCase()
        .split(" ");
    
    for (const repo of repos) {
        let score = 0;
        for (const queryToken of queryTokens){
            const count = repo.tokens.filter(t => t === queryToken).length
            const reposWithToken = repos.filter(r => r.tokens.includes(queryToken)).length
            if (reposWithToken === 0) continue 
            const IDF = Math.log(repos.length / reposWithToken)
            const TF = count / repo.tokens.length;
            score += TF * IDF
        }
        repo.score = score
    }
    return repos.sort((a, b) => b.score - a.score)
}

