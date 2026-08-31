# Full-Stack Web Search Engine

A high-performance web search engine built from scratch using Node.js, Express, MongoDB Atlas, and Vanilla JavaScript. The system implements an in-memory inverted index, Okapi BM25 ranking model, Trie-based autocomplete, Porter Stemmer normalization, Min-Heap top-K candidate selection, and a recursive web crawler.

## Live Deployments

- **Web Application (Vercel):** [https://search-engine-henna.vercel.app](https://search-engine-henna.vercel.app)
- **API Server (Render):** [https://searchengine-e8uv.onrender.com](https://searchengine-e8uv.onrender.com)
- **Cloud Database:** MongoDB Atlas

---

## Key Features

- **Okapi BM25 Ranking Engine:** Evaluates document relevance using term frequency saturation ($k_1 = 1.5$), document length normalization ($b = 0.75$), and smoothed Inverse Document Frequency.
- **Trie Prefix Autocomplete:** Maintains an in-memory Trie index for instant prefix lookup and search query recommendations.
- **Porter Stemming Algorithm:** Reduces terms to their word stems (e.g., "running" -> "run") for enhanced recall.
- **Min-Heap Priority Queue:** Optimizes top-K document retrieval in $O(N \log K)$ time complexity without fully sorting all candidate documents.
- **Single & Recursive Web Crawler:** Fetches external URLs, extracts content, strips boilerplate elements (`script`, `style`, `nav`, `footer`, `ad`), extracts outbound hyperlinked URLs, and indexes pages up to configurable depth limits.
- **In-Memory Inverted Index:** Utilizes a `Map<token, PostingList>` structure paired with document length tracking for sub-millisecond query evaluation.
- **Dual Storage Engine:** Supports local disk-backed storage via WiredTiger for offline development and MongoDB Atlas for production persistence.
- **Automated Index Reconstruction:** Automatically loads and rebuilds the inverted index into RAM upon server startup.

---

## System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                 FRONTEND (Vercel)                                 |
|               Single-Page Application (HTML5, Vanilla CSS, JS Engine)              |
+-----------------------------------------------------------------------------------+
                                         |
                                         | REST API / Reverse Proxy
                                         v
+-----------------------------------------------------------------------------------+
|                                 BACKEND (Render)                                  |
|                                    Express.js                                     |
|  +-------------------+   +--------------------+   +----------------------------+  |
|  |   Web Crawler     |   |   Text Processor   |   |   Trie Autocomplete        |  |
|  |  Axios / Cheerio  |   |  Porter Stemmer    |   |   Prefix Index             |  |
|  +-------------------+   +--------------------+   +----------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                       In-Memory Inverted Index                              |  |
|  |                       Map<token, PostingList>                               |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                 BM25 Ranking Engine + Min-Heap Top-K                        |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Persistent Storage
                                         v
+-----------------------------------------------------------------------------------+
|                              DATABASE (MongoDB Atlas)                             |
|                             Document Store & Schemas                              |
+-----------------------------------------------------------------------------------+
```

---

## Technical Stack

- **Backend Runtime:** Node.js (ES Modules)
- **Web Framework:** Express.js
- **Database Layer:** MongoDB Atlas / Mongoose ORM
- **HTML Parsing Engine:** Cheerio & Axios
- **Core Algorithms:** Custom implementation of Inverted Index, BM25, Min-Heap, Trie, and Porter Stemmer
- **Frontend Stack:** HTML5, CSS3 (JetBrains Mono design system), Vanilla JS (Fetch API, History API)
- **Hosting Platforms:** Render (API Service), Vercel (Frontend CDN), MongoDB Atlas (Cloud DB)

---

## Project Structure

```text
GithubSearchEngine/
├── public/
│   ├── app.js               # Frontend router, state manager, and view engine
│   ├── index.html           # Single-page interface markup
│   └── style.css            # Custom design tokens, glassmorphism layout, typography
├── src/
│   ├── controllers/
│   │   └── search.controller.js  # HTTP request controllers
│   ├── crawler/
│   │   └── WebCrawler.js    # Axios & Cheerio scraper pipeline
│   ├── db/
│   │   └── index.js         # Connection initializer for Atlas / local memory DB
│   ├── engine/
│   │   ├── InvertedIndex.js # Inverted index data structure
│   │   ├── MinHeap.js       # Priority queue for top-K document selection
│   │   ├── PorterStemmer.js # Suffix-stripping stemming implementation
│   │   ├── PostingList.js   # Document frequency map
│   │   ├── RankingEngine.js # BM25 relevance calculation module
│   │   ├── SearchEngine.js  # Orchestrator for searching and indexing
│   │   ├── SearchResult.js  # Ranked result item model
│   │   ├── TextProcessor.js # Tokenizer, stop-word filter, stemmer integration
│   │   └── Trie.js          # Prefix tree implementation for autocomplete
│   ├── models/
│   │   └── document.model.js# Mongoose document schema
│   ├── routes/
│   │   └── search.routes.js # API route declarations
│   ├── services/
│   │   └── search.service.js# Core business operations & index rebuild logic
│   ├── app.js               # Express application configuration
│   ├── constants.js         # Application constants
│   └── index.js             # Server entry point
├── .env                     # Environment variable definitions
├── vercel.json              # Vercel deployment & API rewrite configuration
├── package.json
└── README.md
```

---

## Algorithm Specifications

### BM25 Relevance Scoring

Document scoring is executed using the Okapi BM25 formulation:

$$\text{Score}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

Where:
- $k_1 = 1.5$: Controls term frequency saturation.
- $b = 0.75$: Adjusts document length normalization penalty.
- $\text{IDF}(q_i) = \log_{10}\left(1 + \frac{N}{df_i}\right)$: Robertson $+1$ smoothed Inverse Document Frequency.
- $|D|$: Length of the target document in terms.
- $\text{avgdl}$: Average term count across all indexed documents.

### Min-Heap Top-K Selection

Instead of executing a global sort ($O(N \log N)$) across all matching documents, candidate results are filtered through a Min-Heap of capacity $K$. The computational complexity per query reduces to $O(N \log K)$, where $N$ is the number of matched documents.

---

## API Reference

### 1. Execute Search Query
`GET /api/search`

Executes tokenization, stemming, BM25 scoring, and top-K candidate extraction.

**Query Parameters:**
- `q` (string, required): The search terms.
- `topK` (number, optional, default: `10`): Maximum results to retrieve.
- `page` (number, optional, default: `1`): Pagination page index.
- `limit` (number, optional, default: `10`): Results per page.
- `domain` (string, optional): Filter results by domain.

**Response (200 OK):**
```json
{
  "query": "react state",
  "totalResults": 1,
  "totalPages": 1,
  "currentPage": 1,
  "results": [
    {
      "documentId": "https://react.dev/",
      "score": 1.482,
      "title": "React",
      "snippet": "React - The library for web and native user interfaces..."
    }
  ]
}
```

---

### 2. Index Web Page
`POST /api/index`

Crawls target web address, processes text content, persists document to database, and updates inverted index.

**Request Body:**
```json
{
  "url": "https://react.dev/",
  "maxDepth": 1,
  "maxPages": 1
}
```

**Response (200 OK):**
```json
{
  "status": "indexed",
  "url": "https://react.dev/",
  "title": "React",
  "tokensIndexed": 908,
  "childLinksFound": 60
}
```

---

### 3. Autocomplete & Suggestions
`GET /api/suggest`

Queries the in-memory Trie for prefix matches.

**Query Parameters:**
- `q` (string, required): Prefix string.
- `limit` (number, optional, default: `5`): Maximum suggestions to return.

**Response (200 OK):**
```json
{
  "prefix": "rea",
  "suggestions": ["react", "reading", "realtime"]
}
```

---

### 4. System Metrics
`GET /api/stats`

Retrieves system-wide index and database metrics.

**Response (200 OK):**
```json
{
  "totalDocuments": 15,
  "totalTerms": 4820,
  "averageDocumentLength": 1240,
  "documentsInDatabase": 15
}
```

---

## Local Development Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/kalpitagrawal/SearchEngine.git
   cd SearchEngine/GithubSearchEngine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```env
   PORT=8080
   CORS_ORIGIN=*
   USE_MEMORY_DB=true
   CRAWLER_TIMEOUT_MS=10000
   CRAWLER_USER_AGENT=SearchEngineBot/1.0
   ```

4. Start local development server:
   ```bash
   npm run dev
   ```

5. Access local environment at `http://localhost:8080`.

---

## Production Deployment Configuration

### Render Backend Setup
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `USE_MEMORY_DB`: `false`
  - `MONGO_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/searchengine`
  - `CORS_ORIGIN`: `*`

### Vercel Frontend Setup
- **Output Directory:** `public`
- **Framework Preset:** `Other`
- API calls are proxied through `vercel.json` rewrites to Render.

---

## License

This project is open-source and available under the [MIT License](LICENSE).
