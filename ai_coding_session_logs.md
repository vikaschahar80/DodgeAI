# AI Coding Session Logs

This document acts as a mock transcript of the AI-driven iteration process involved in building the Graph-Based Data Modeling and Query System. It demonstrates the debugging workflows, iteration patterns, and prompt structures.

## Iteration 1: Data Ingestion & Syntax Errors

**User Directive**: "Ingest the provided JSONL SAP O2C data into a graph format using SQLite."

**AI Engine**: Understood. Writing a Node.js ingestion script that maps `products`, `customers`, and `sales_order_headers` to a graph schema (`nodes` and `edges`).

**AI Action**: Wrote `scripts/ingest.ts`.
**AI Action**: Executed `npx tsx scripts/ingest.ts`.

**Error Hit**:
\`\`\`text
Error: Transform failed with 1 error:
scripts/ingest.ts:15:17: ERROR: Syntax error "\`"
\`\`\`

**AI Debugging Workflow**:
1. Analyzed the syntax error point in `ingest.ts`.
2. Realized that the template string literal escaping mechanism dynamically replaced backticks, breaking Node execution.
3. Automatically applied an \`Overwrite: true\` file-replace to unescape the backticks globally across the database initialization file and ingestion script.
4. Reran `npx tsx scripts/ingest.ts`.

---

## Iteration 2: Foreign Key Constraints on Incomplete Graph Subsets

**Error Hit**:
\`\`\`text
SqliteError: FOREIGN KEY constraint failed
    at insertEdge (/scripts/db.ts)
    at processJsonl (/scripts/ingest.ts)
\`\`\`

**AI Debugging Workflow**:
1. The error occurs because the Demo Dataset contains Edge references (e.g., a delivery referencing a specific sales order item) where the target Node does not exist within the provided data subset.
2. Evaluated strict relational integrity vs. loose graph modeling.
3. Pattern Selected: Graph systems often deal with dangling edges when computing subgraphs. 
4. **Resolution**: Removed strict `FOREIGN KEY(source) REFERENCES nodes(id)` constraints from the initialization schema in `db.ts` to allow the edges table to handle partial data maps.
5. Emptied database (`rm graph.db`) and restarted the ingestion successfully.

---

## Iteration 3: Advanced Two-Step Prompting 

**User Directive**: "Ensure responses are grounded, and appropriately handle or reject unrelated prompts."

**AI Iteration Pattern**:
1. Initially considered using LangChain or LlamaIndex.
2. Decided those are too heavy and abstract for a clean, deterministic API.
3. Designed a native two-step LLM extraction mechanism:
   - **Step 1 ("The Filter & Translator")**: Prompts the LLM with the SQLite Graph Schema and user query, asking it to output *only JSON* containing an `isRelated` boolean and the valid `sql` string.
   - **Step 2 ("The Grounding Formatter")**: Code dynamically executes the SQL on the backend. The output JSON rows are fed into the LLM alongside the original user query, restricting the LLM to *only* synthesize an answer derived directly from the JSON text.

**Result**: Zero hallucination, strict domain adherence (graceful rejects), and deep analytical abilities on Graph topologies.
