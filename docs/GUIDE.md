# 🧠 VectorSYNC Technical Implementation Guide

## 🚀 Overview
The **VectorSYNC Neural Bridge** is a local-first semantic indexer and search engine. This guide covers the technical nuances of the synchronization pipeline, the MariaDB vector schema, and the dashboard architecture.

---

## 🏗️ System Components

### 1. The Cortex (engine/)
The Python-based sync engine is responsible for the heavy lifting:
-   **File Observation:** Uses `watchdog` to monitor any modifications within the target Obsidian vault.
-   **Metadata Extraction:** Parses YAML frontmatter and inline content to extract #tags and filenames.
-   **Neural Chunking:** Intelligently splits long Markdown files into semantic windows to ensure embedding granularity.
-   **Vectorization:** Local generation of embeddings via `sentence-transformers` (Default model: `all-MiniLM-L6-v2`).

### 2. The Neural API (api/)
A Node.js backend that interfaces between the React frontend and the MariaDB Vector store:
-   **Hybrid Search:** Implements multi-mode retrieval using standard SQL for keywords and `VEC_DISTANCE` for semantic similarity.
-   **Volatile Security:** Passwords are provided via the CLI/Stdin and kept in memory to minimize risk.
-   **Graph Assembly:** Dynamically builds a relationship map of notes based on tag overlap and vector proximity.

## 🛠️ Installation & Deployment

Follow these 6 steps to bridge your local knowledge vault with our neural search engine.

### Step 1: Clone and Requirements
Clone the project repository to your local machine:
```bash
git clone https://github.com/MariaDB-Hackathon-MY-2026/VectorSYNC.git
cd VectorSYNC
```
**Prerequisites:**
- **Docker Desktop:** For hosting the MariaDB Vector database.
- **Node.js 18+:** For the dashboard and Neural API.
- **Python 3.10+:** For the semantic sync engine.

### Step 2: Navigate to Project Path
Ensure you are in the root directory of the project.
```bash
# Example for Windows
cd C:\Users\YourName\Documents\VectorSYNC
```

### Step 3: Spin Up MariaDB Vector
Open **Docker Desktop** and run the following command to start the pre-configured MariaDB 11.8 instance:
```bash
docker-compose up -d
```
*This handles the database creation and vector extension setup automatically.*

### Step 4: Initialize Cortex Sync Engine
Install Python dependencies and launch the file watcher. Keep this terminal running to monitor and re-index your Obsidian files in real-time.
```bash
pip install -r requirements.txt
python engine/main.py
```
*(You will be prompted to enter your Obsidian Vault absolute path during the first run)*

### Step 5: Launch Dashboard API & UI
In a **new terminal window**, move to the project root and start the full-stack development environment:
```bash
npm install
npm run dev
```

### Step 6: Access Neural Interface
Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

Your vault should now be conceptually indexed and searchable.

---

## 🔍 Architecture Deep-Dive

### Semantic Retrieval Logic
When a query enters the system, the Node server generates a temporary embedding for the query string. It then executes a distance-based search:
```sql
SELECT n.file_name, nc.content, VEC_DISTANCE(nc.embedding, VEC_FromText(?)) as distance
FROM note_chunks nc
JOIN notes n ON nc.note_id = n.id
ORDER BY distance ASC
LIMIT 25;
```

### Knowledge GraphAssembly
The graph is built by analyzing two layers:
1.  **Explicit:** Shared Tags (Relational).
2.  **Implicit:** Semantic proximity where `VEC_DISTANCE < 0.38` (Neural).

---

## 🧪 Development Workflow
To contribute to the engine:
1.  Navigate to `engine/`.
2.  Modify `cortex/processor.py` to adjust chunking logic.
3.  Test with a sample vault using `python engine/main.py`.

To contribute to the UI:
1.  Modify `src/components/` (the client source).
2.  Styling is handled exclusively via Tailwind CSS in `src/index.css`.

---
*Created by Team Dopamine for the MariaDB Vector Hackathon 2026.*
