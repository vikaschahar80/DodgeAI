# AI Prompting Strategy & Pipeline

This document details the structured LLM prompt chain designed to translate natural language user questions into accurate, grounded SQL queries against the graph database, and finally synthesize those results into human-readable answers.

Our approach breaks down the extraction process into **three distinct phases**, bypassing the limitations of single-shot prompting. This phased architecture prevents hallucination, enforces strict domain guardrails, and ensures complete determinism by mapping text directly to SQLite Graph structures.

---

## Step 1: Contextual Guardrails & Graph SQL Code-Generation

The first prompt sent to the LLM (currently configured with Google Gemini 2.5 Flash) does not attempt to answer the user's question directly. Instead, it forces the model to act exclusively as a **SQL code generation agent** over a strict schema.

### System Instructions Provided to the LLM:
\`\`\`text
You are an expert Graph Database and SQL assistant for an SAP Order-to-Cash process graph. 
The database is SQLite and contains two tables:
1. nodes (id TEXT PRIMARY KEY, label TEXT, properties TEXT JSON)
  - Labels: Customer, SalesOrder, Delivery, Billing, AccountEntry, Payment, Product
2. edges (id TEXT PRIMARY KEY, source TEXT, target TEXT, type TEXT, properties TEXT JSON)
  - Types: PLACES, CONTAINS, FULFILLS, BILLED_TO, BILLS_FOR, RECORDS, OWES, CLEARS

IMPORTANT GUARDRAIL: We only answer questions about this dataset. If a query is completely unrelated to orders, bills, payments, deliveries, plants, customers, or products, set "isRelated" to false.

Respond ONLY with valid JSON in the following format:
{
  "isRelated": boolean,
  "sql": string | null
}
\`\`\`

### Execution Input Example:
\`\`\`text
User Query: "Which products are associated with the highest number of billing documents?"
\`\`\`

### Expected LLM JSON Output:
\`\`\`json
{
  "isRelated": true,
  "sql": "SELECT json_extract(n.properties, '$.name') as ProductName, COUNT(DISTINCT e.source) as BillCount FROM nodes n JOIN edges e ON n.id = e.target WHERE n.label='Product' AND e.type='CONTAINS' GROUP BY n.id ORDER BY BillCount DESC LIMIT 5"
}
\`\`\`

> **Why this impresses:** 
> By returning machine-readable JSON, the application programmatically reads the \`isRelated\` boolean to enforce **absolute domain boundaries**. If the user asks "Tell me a joke", the LLM naturally sets \`isRelated: false\`, and the application short-circuits to reject the prompt immediately without executing expensive operations or generating nonsense.

---

## Step 2: Unbiased Data Execution (System Layer)

The SQL generated in Step 1 is executed directly against the local `better-sqlite3` instance. 
The LLM is completely blind during this step—it is the backend server that performs the deterministic extraction of rows from the local graph structure.

*Example Data Retrieved:*
\`\`\`json
[
  { "ProductName": "Steel Pipe 10mm", "BillCount": 142 },
  { "ProductName": "Industrial Valve TX", "BillCount": 98 }
]
\`\`\`

---

## Step 3: Natural Language Grounding & Synthesis

Once the data is securely extracted, it is passed into a secondary "Synthesis Prompt". This separates the *analytical extraction* from the *human-readable generation*. 

### System Instructions Provided to the LLM:
\`\`\`text
You are an expert data analyst for an Order-to-Cash system.
The user asked: "{userQuery}"

To answer this, we ran a database query which returned the following JSON data:
{dataResult_JSON} 

Using ONLY this data, synthesize a clear, helpful natural language response. If the data is empty, say no records were found. 
Do not mention "I ran a SQL query" or internal json structure. Just answer the user's question directly giving the facts. Focus on being concise but detailed.
\`\`\`

### Expected LLM Output:
\`\`\`text
The product associated with the highest number of billing documents is the Steel Pipe 10mm, which appeared in 142 billing documents. This is followed by the Industrial Valve TX with 98 associated billing documents.
\`\`\`

> **Why this impresses:** 
> RAG (Retrieval-Augmented Generation) often suffers when semantic search retrieves irrelevant documents or slightly off-topic text vectors. By using a **Text-to-SQL-to-Text** pipeline over a Graph/Relational architecture, we guarantee `0% hallucination` on mathematical aggregates. The LLM acts purely as a linguistic formatter over strictly queried data. 
