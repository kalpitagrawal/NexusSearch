import "dotenv/config"
import { textProcessor } from "../indexer/tokenizer.js";
import { Repo } from "../models/repo.model.js"
import axios from "axios"
import connectDB from "../db/index.js"

const languages = [
    "JavaScript",
    "Python",
    "Java",
    "C",
    "C++",
    "C#",
    "TypeScript",
    "Go",
];

const keywords = [
    "backend",
    "frontend",
    "fullstack",
    "nodejs",
    "express",
    "nestjs",
    "mongodb",
    "mysql",
    "postgresql",
    "database",
    "sql",
    "nosql",
    "react",
    "nextjs",
    "vue",
    "angular",
    "html",
    "css",
    "javascript",
    "typescript",
    "tailwind",
    "bootstrap",
    "sass",
    "redux",
    "zustand",
    "api",
    "rest",
    "graphql",
    "authentication",
    "authorization",
    "jwt",
    "oauth",
    "websockets",
    "socketio",
    "microservices",
    "monolith",
    "docker",
    "kubernetes",
    "ci/cd",
    "devops",
    "aws",
    "azure",
    "gcp",
    "serverless",
    "linux",
    "nginx",
    "apache",
    "git",
    "github",
    "gitlab",
    "bitbucket",
    "testing",
    "jest",
    "mocha",
    "cypress",
    "playwright",
    "unit testing",
    "integration testing",
    "debugging",
    "performance",
    "optimization",
    "security",
    "encryption",
    "hashing",
    "data structures",
    "algorithms",
    "recursion",
    "dynamic programming",
    "binary search",
    "sorting",
    "oop",
    "functional programming",
    "design patterns",
    "system design",
    "scalability",
    "caching",
    "redis",
    "message queue",
    "rabbitmq",
    "kafka",
    "cron jobs",
    "web scraping",
    "automation",
    "machine learning",
    "deep learning",
    "ai",
    "nlp",
    "computer vision",
    "data science",
    "big data",
    "hadoop",
    "spark",
    "blockchain",
    "web3",
    "smart contracts",
    "solidity",
    "testing library"
];

const testKeywords = keywords.slice(0, 2);
const testLanguages = languages.slice(0, 2);

const fetchRepos = async (keyword, language) => {
    try {
        const response = await axios.get(`https://api.github.com/search/repositories`, {
            params: {
                q: `${keyword}+language:${language}`,
                per_page: 10
            },
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
            }
        })
    
        const items = response.data.items
    
        const repos = items.map((currentItem) => ({
            repoId: currentItem.id,
            repoName: currentItem.name,
            owner: currentItem.owner.login,
            repoDescription: currentItem.description,
            language: currentItem.language,
            stars: currentItem.stargazers_count,
            url: currentItem.html_url
        }))
    
        return repos;
    } catch (error) {
        console.log(`Failed to fetch repos for ${keyword} + ${language}:`, error.message)
        return []
    }
}

const fetchReadme = async (owner, repoName) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repoName}/readme`, {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
            }
        })

        const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
        return content;
    } catch (error) {
        console.log(`Failed to fetch Readme for ${repoName}:`,error.message)
        return ""
    }
}

const crawler = async () => {
    await connectDB()

    for (const keyword of testKeywords) {
        for (const language of testLanguages) {

            const repos = await fetchRepos(keyword, language)

            for (const repo of repos) {

                const exists = await Repo.findOne({ repoId: repo.repoId })
                if (exists) continue

                const readme = await fetchReadme(repo.owner, repo.repoName)
                const tokens = textProcessor(repo.repoName, repo.repoDescription, readme)

                await Repo.create({
                    ...repo,
                    tokens
                })

                console.log(`Saved: ${repo.repoName}`)
            }
        }
    }
    console.log("Crawling complete!")
}

crawler();