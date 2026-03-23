# Context Graph System - SAP O2C Explorer

This repository contains the solution for the Forward Deployed Engineer task: a **Graph-Based Data Modeling and Query System** that unifies fragmented SAP Order-to-Cash data and provides a natural language querying interface.

## Architecture Decisions

### 1. Database and Data Modeling (Graph vs Relational)
While specialized graph databases (like Neo4j) are powerful, they often introduce significant overhead for deployment and querying. To maximize accessibility, speed, and standard LLM compatibility, **SQLite (`better-sqlite3`) was chosen with an Explicit In-Memory Graph Schema**.
* **Nodes Table**: `id`, `label`, `properties` (JSON)
* **Edges Table**: `id`, `source`, `target`, `type`, `properties` (JSON)

This deliberate schema design provides the best of both worlds:
1. **True Graph Traversal**: Nodes and Edges are first-class citizens.
2. **LLM SQL Proficiency**: Standard language models excel at writing SQL. By utilizing a simple `nodes` and `edges` table, the LLM easily generates `JOIN`s to answer complex relationship questions without hallucinating complex Cypher syntax.

### 2. LLM Prompting Strategy (Text-to-SQL-to-Text)
A naive RAG implementation often struggles with graph aggregations ("Which products have the *highest number* of bills?"). Instead of vector search, we built a deterministic 2-stage prompt chain:
* **Stage 1 (SQL & Guardrails)**: The model is instructed to act only as a SQL generator. It reads the user prompt and generates a strict JSON payload containing a SQLite query and an `isRelated` boolean.
* **Execution (Server-Side)**: The Next.js API securely runs the SQL query against local SQLite. 
* **Stage 2 (Synthesis)**: A fresh prompt synthesizes the exact JSON row results back into human-readable text.
*(See `ai_prompts.md` for the exact prompt structures and logic).*

### 3. Guardrails Implementation
Guardrails are built into the initial SQL generation step. By asking the LLM to output an `isRelated` flag in its JSON response, we programmatically drop queries that don't belong to the O2C domain *before* any backend database logic is triggered.

### 4. Graph Visualization UI
The visualization is built with `react-force-graph-2d` and dynamically rendered in a split-pane layout using pure, flexible Vanilla CSS to adhere to modern design aesthetics seamlessly.

---

## Setup & Running Locally

1. **Clone the repository** and navigate to the project directory:
   \`\`\`bash
   cd graph-o2c-app
   \`\`\`
2. **Install Dependencies**:
   \`\`\`bash
   npm install
   \`\`\`
3. **Set your Google Gemini API Key**:
   Create a `.env.local` file in the root directory and add:
   \`\`\`env
   GEMINI_API_KEY=your_free_tier_key
   \`\`\`
4. **Ingest the Dataset**:
   Ensure the `sap-o2c-data` folder is present at the root, then run the ingestion script. This builds the `graph.db` SQLite file locally:
   \`\`\`bash
   npx tsx scripts/ingest.ts
   \`\`\`
5. **Start the Next.js Dev Server**:
   \`\`\`bash
   npm run dev
   \`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Submission Notes
- **Working Demo**: Ensure `.env.local` is set before starting the server.
- **AI Coding Logs**: Please see `ai_coding_session_logs.md` in this repository for a transcript of the AI iteration patterns, debugging methodologies, and code-generation flow during the build of this project.
