# Context Graph System - SAP O2C Explorer

This repository contains the solution for the **Forward Deployed Engineer** task: a Graph-Based Data Modeling and Query System that unifies fragmented SAP Order-to-Cash data and provides a natural language querying interface.

## Architecture Decisions

### 1. Database Choice: PostgreSQL (Neon)
We migrated from a local SQLite setup to **PostgreSQL (Neon)** to ensure the application is "Edge Ready" and suitable for production deployments on platforms like Vercel. 
- **JSONB Implementation**: We utilize PostgreSQL’s native `JSONB` type for the `properties` column in both `nodes` and `edges` tables. This allows for schema-less property storage while maintaining high-speed indexing and querying.
- **Serverless Compatibility**: By using a connection pool (`pg`), the application handles serverless function cold-starts and connection limits efficiently.

### 2. Graph Modeling
The dataset is modeled as a property graph to capture the inherent relationships in the O2C flow:
- **Nodes**: `Customer`, `SalesOrder`, `Delivery`, `Billing`, `JournalEntry`, `Product`.
- **Edges**: 
    - `Customer -[PLACES]-> SalesOrder`
    - `SalesOrder -[CONTAINS]-> Product`
    - `Delivery -[FULFILLS]-> SalesOrder`
    - `Billing -[BILLS_FOR]-> Delivery/SalesOrder`
    - `JournalEntry -[RECORDS]-> Billing`
    - `JournalEntry -[CLEARS]-> JournalEntry` (for payments)

### 3. LLM Prompting Strategy (Natural Language to SQL)
Instead of a simple vector-based RAG, we use a **two-stage deterministic pipeline**:
1. **Translation**: The LLM (Gemini 1.5 Flash) receives the PostgreSQL schema and translates the natural language question into a structured SQL query. This allows for complex aggregations (e.g., "highest number of billing documents") that vector search typically fails at.
2. **Synthesis**: The results of the SQL query are fed back into the LLM to generate a grounded, human-readable answer.

### 4. Guardrails
Strict guardrails are implemented at the prompt level. The system is instructed to identify if a query is within the SAP O2C domain. If a user asks an off-topic question (e.g., creative writing or general knowledge), the system responds with:
> *"This system is designed to answer questions related to the provided dataset only."*

---

## Setup & Running Locally

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Create a `.env.local` file with:
   ```env
   GEMINI_API_KEY=your_key
   DATABASE_URL=your_neon_postgres_url
   ```
3. **Ingest Data**:
   ```bash
   npx tsx scripts/ingest.ts
   ```
4. **Run App**:
   ```bash
   npm run dev
   ```

---

## Submission Details
- **Public Repo**: [GitHub Link](https://github.com/vikaschahar80/DodgeAI.git)
- **AI Coding Session Logs**: See `ai_coding_session_logs.md` for the full transcript of the AI-driven development process, including debugging and iteration patterns.
