# 🔍 Search Engine — MERN Stack (BM25 Engine)

A full-stack web search engine built from scratch using Node.js, Express, and MongoDB. Features an in-memory inverted index, **BM25 ranking algorithm**, custom **Min-Heap top-K priority queue**, web crawler (`axios` + `cheerio`), and a sleek single-page frontend.

---

## 📌 Features & Highlights

- **BM25 Relevance Scoring**: Industry-standard ranking algorithm with term frequency saturation ($k_1=1.5$), document length normalization ($b=0.75$), and Robertson $+1$ term smoothing ($\log_{10}(1 + N/df)$).
- **Min-Heap Top-K Selection**: Efficient priority queue ($O(N \log K)$) selecting the top-$K$ highest-scoring results without sorting all candidates.
- **In-Memory Inverted Index**: `Map<token, PostingList>` data structure with `documentLengths` tracking for instant term lookup.
- **Persistent Local Database**: Local disk-backed database at `./data/db` using MongoDB WiredTiger engine — indexed documents persist permanently across server restarts (matching Java's H2 file database).
- **Web Crawler (`axios` + `cheerio`)**: HTML parsing pipeline fetching web pages and stripping non-content elements (`script`, `style`, `nav`, `footer`, `header`, `aside`, `.sidebar`, `.menu`, `.ad`).
- **REST API & Startup Rebuild**: Automatically rebuilds inverted index from stored documents on server startup (`rebuildIndex()`).
- **Modern UI**: Dark/monochrome glassmorphism design using JetBrains Mono typography, 4 views (Landing, Results, Index URL, Stats), HTML5 History API (browser Back/Forward support), and keyboard shortcuts (`/` to focus, `Esc` to go home).

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Web Framework | Express.js |
| Storage | Local MongoDB (`mongodb-memory-server` + WiredTiger) / MongoDB Atlas |
| HTML Parsing | Cheerio + Axios |
| Core Engine | Vanilla JavaScript (`PostingList`, `InvertedIndex`, `RankingEngine`, `MinHeap`) |
| Frontend | Vanilla HTML5 / CSS3 (JetBrains Mono) / JS |

---

## 🏗 Architecture Mapping (Java → MERN)

```
Java (Spring Boot)                →    MERN (Express + MongoDB)
─────────────────────                  ─────────────────────────
SearchEngineApplication.java      →    src/index.js
SearchController.java             →    src/controllers/search.controller.js
SearchService.java                →    src/services/search.service.js
Document.java (@Entity)           →    src/models/document.model.js
DocumentRepository.java           →    Mongoose model methods
WebCrawler.java (Jsoup)           →    src/crawler/WebCrawler.js (axios+cheerio)
PostingList.java                  →    src/engine/PostingList.js
InvertedIndex.java                →    src/engine/InvertedIndex.js
TextProcessor.java                →    src/engine/TextProcessor.js
SearchEngine.java                 →    src/engine/SearchEngine.js
RankingEngine.java                →    src/engine/RankingEngine.js
SearchResult.java                 →    src/engine/SearchResult.js
application.properties            →    .env
static/index.html                 →    public/index.html
static/style.css                  →    public/style.css
static/app.js                    →    public/app.js
```

---

## 📁 Project Structure

```text
GithubSearchEngine/
├── public/
│   ├── app.js               # Frontend routing, search, index & stats logic
│   ├── index.html           # Landing, Results, Index, and Stats views
│   └── style.css            # Design system, JetBrains Mono font, glassmorphism
├── src/
│   ├── controllers/
│   │   └── search.controller.js  # REST API handlers
│   ├── crawler/
│   │   └── WebCrawler.js    # Cheerio/Axios HTML scraper
│   ├── db/
│   │   └── index.js         # Persistent local DB & MongoDB connection
│   ├── engine/
│   │   ├── InvertedIndex.js # Map<token, PostingList> index
│   │   ├── PostingList.js   # Map<documentId, frequency>
│   │   ├── RankingEngine.js # BM25 scoring & MinHeap top-K selection
│   │   ├── SearchEngine.js  # Search pipeline orchestrator
│   │   ├── SearchResult.js  # Search result model
│   │   └── TextProcessor.js # Tokenizer & 12 stop-words filter
│   ├── models/
│   │   └── document.model.js# Mongoose Document schema
│   ├── routes/
│   │   └── search.routes.js # Express router (/api/search, /api/index, /api/stats)
│   ├── services/
│   │   └── search.service.js# Business logic, rebuildIndex(), snippet generator
│   ├── app.js               # Express application configuration
│   ├── constants.js         # DB constants
│   └── index.js             # Application entry point
├── .env                     # Environment variables
├── .gitignore
└── package.json
```

---

## ⚙️ Quick Start

### 1. Clone & Install
```bash
cd GithubSearchEngine
npm install
```

### 2. Configure Environment (`.env`)
By default, the engine runs in **Local Persistent Mode** (no MongoDB installation required):
```env
PORT=8080
CORS_ORIGIN=*
USE_MEMORY_DB=true
CRAWLER_TIMEOUT_MS=10000
CRAWLER_USER_AGENT=SearchEngineBot/1.0
```

*For MongoDB Atlas Production mode, set `USE_MEMORY_DB=false` and provide `MONGO_URI`.*

### 3. Start Development Server
```bash
npm run dev
```
Open **`http://localhost:8080`** in your browser.

---

## 🔌 API Endpoints

### 1. Search Index (`GET /api/search`)
Query the inverted index and return BM25-ranked results.

**Query Parameters:**
- `q` (required): Search query string (e.g. `react state`)
- `topK` (optional, default `10`): Max number of results to return

**Example:** `GET /api/search?q=react&topK=5`

**Response:**
```json
{
  "query": "react",
  "totalResults": 1,
  "results": [
    {
      "documentId": "https://react.dev/",
      "score": 0.7306553292815078,
      "title": "React",
      "snippet": "ReactThe library for web and native user interfaces... Create user interfaces from components..."
    }
  ]
}
```

---

### 2. Index Web Page (`POST /api/index`)
Crawl a URL, extract visible text, store document, and update inverted index.

**Request Body:**
```json
{
  "url": "https://en.wikipedia.org/wiki/Search_engine"
}
```

**Response:**
```json
{
  "status": "indexed",
  "url": "https://en.wikipedia.org/wiki/Search_engine",
  "title": "Search engine - Wikipedia",
  "tokensIndexed": 7376
}
```

---

### 3. View Index Stats (`GET /api/stats`)
Get live metric counters from the index and database.

**Response:**
```json
{
  "totalDocuments": 2,
  "totalTerms": 3443,
  "averageDocumentLength": 6732,
  "documentsInDatabase": 2
}
```

---

## 🧠 BM25 Ranking Formula

The ranking engine calculates document relevance using **Best Matching 25 (BM25)**:

$$\text{Score}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

- **$k_1 = 1.5$**: Controls term frequency saturation.
- **$b = 0.75$**: Controls document length normalization.
- **$\text{IDF}(q_i) = \log_{10}\left(1 + \frac{N}{df_i}\right)$**: Smoothed Inverse Document Frequency.

---

## 📄 License

MIT
