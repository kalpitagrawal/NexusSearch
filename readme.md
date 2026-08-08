# 🔍 GitHub Repo Search Engine

A search engine for GitHub repositories — built from scratch using Node.js, Express, and MongoDB. Fetches real repo data via the GitHub API, processes it through a text pipeline, and ranks results using TF-IDF.

---

## 📌 What It Does

- Crawls GitHub repos using the GitHub REST API
- Indexes **repo name**, **description**, and **README content**
- Processes text (strip HTML → lowercase → remove stop words → tokenize)
- Ranks search results using **TF-IDF**
- Exposes a clean REST API to query the index

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| HTTP Client | Axios |
| Algorithm | TF-IDF |

---

<!-- ## 📁 Project Structure 


search-engine/
├── src/
│   ├── crawler/        # Fetches repo data from GitHub API
│   ├── indexer/        # Text processing + TF-IDF scoring
│   ├── models/         # MongoDB schemas
│   ├── routes/         # Express search API routes
│   └── app.js          # Entry point
├── .env                # GitHub token, MongoDB URI
├── .gitignore
└── package.json -->


---

<!-- ## ⚙️ Setup

### 1. Clone the repo

```bash
git clone https://github.com/kalpitagrawal/search-engine.git
cd search-engine
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a `.env` file

```env
GITHUB_TOKEN=your_github_personal_access_token
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

> **Get a GitHub token:** GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new token (no special scopes needed for public repos)

### 4. Run the crawler to populate the database

```bash
node src/crawler/index.js
```

### 5. Start the server

```bash
node src/app.js
```

--- -->
<!-- 
## 🔌 API

### `GET /search?q=your+query`

Returns ranked list of repos matching the query.

**Example:**
```
GET /search?q=react state management
```

**Response:**
```json
{
  "query": "react state management",
  "results": [
    {
      "name": "reduxjs/redux",
      "description": "Predictable state container for JS apps",
      "score": 0.87,
      "url": "https://github.com/reduxjs/redux"
    }
  ]
}
```

--- -->

## 🧠 How It Works

```
GitHub API
    ↓
Fetch repo name + description + README
    ↓
Text Processing Pipeline
  → Strip HTML
  → Lowercase
  → Remove stop words
  → Tokenize
    ↓
Build Inverted Index in MongoDB
    ↓
TF-IDF Scoring on query
    ↓
Ranked Results
```

### TF-IDF in plain English

- **TF (Term Frequency):** How often does a word appear in a document?
- **IDF (Inverse Document Frequency):** How rare is this word across all documents?
- A word that appears often in one repo but rarely in others → high score → more relevant

---

## Planned Features

- [ ] Pagination
- [ ] Caching popular queries
- [ ] Autocomplete using a Prefix Tree (Trie)
- [ ] Rate limiting
- [ ] Search analytics (most searched terms, CTR)
- [ ] Filter by language

---

## 📄 License

MIT
