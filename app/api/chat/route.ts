import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const DB_SCHEMA = `
You are an expert Graph Database and SQL assistant for an SAP Order-to-Cash process graph. 
The database is PostgreSQL and contains two tables:
1. nodes (id TEXT PRIMARY KEY, label TEXT, properties JSONB)
  - Labels: Customer, SalesOrder, Delivery, Billing, JournalEntry, Product
2. edges (id TEXT PRIMARY KEY, source TEXT, target TEXT, type TEXT, properties JSONB)
  - Types: PLACES, CONTAINS, FULFILLS, BILLED_TO, BILLS_FOR, RECORDS, OWES, CLEARS

Valid Graph Edge Patterns (Source -> Target):
- Customer [PLACES]-> SalesOrder
- SalesOrder [CONTAINS]-> Product
- Delivery [FULFILLS]-> SalesOrder
- Billing [BILLS_FOR]-> Delivery OR SalesOrder
- Billing [BILLED_TO]-> Customer
- JournalEntry [RECORDS]-> Billing
- Customer [OWES]-> JournalEntry
- JournalEntry [CLEARS]-> JournalEntry

IMPORTANT GUARDRAIL: We only answer questions about this dataset. If a query is completely unrelated to orders, bills, payments, deliveries, plants, customers, or products, or involves general knowledge or creative writing, set "isRelated" to false and return the message "This system is designed to answer questions related to the provided dataset only." in your response.

EXAMPLE QUERIES:
Q: Which products are associated with the highest number of billing documents?
A: {
  "isRelated": true,
  "sql": "SELECT p.properties->>'name' as productName, COUNT(DISTINCT b.id) as billCount FROM nodes p JOIN edges e1 ON e1.target = p.id AND e1.type='CONTAINS' JOIN edges e2 ON e2.target = e1.source AND e2.type='FULFILLS' JOIN edges e3 ON e3.target = e2.source AND e3.type='BILLS_FOR' JOIN nodes b ON b.id = e3.source WHERE p.label='Product' AND b.label='Billing' GROUP BY p.id ORDER BY billCount DESC LIMIT 5"
} // (This is just an example SQL, adapt appropriately).

Q: Find the journal entry number linked to billing document 91150187
A: {
  "isRelated": true,
  "sql": "SELECT j.id as journalEntryId FROM nodes j JOIN edges e ON e.source = j.id WHERE e.target = '91150187' AND e.type = 'RECORDS' AND j.label = 'JournalEntry'"
}
`;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const { messages } = await req.json();
    const userQuery = messages[messages.length - 1].content;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Step 1: Guardrail and SQL Generation
    const sqlPrompt = `
${DB_SCHEMA}

User Query: "${userQuery}"

Based on the schema, generate a PostgreSQL query that retrieves the necessary data to answer this question. Return your response purely as a JSON object with two keys:
- "isRelated": boolean
- "sql": string or null

Respond ONLY with valid JSON.
`;

    const sqlResponse = await model.generateContent(sqlPrompt);
    let responseText = sqlResponse.response.text().trim();
    if (responseText.startsWith('\`\`\`json')) responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    
    const parsed = JSON.parse(responseText);

    if (!parsed.isRelated) {
      return NextResponse.json({ 
        role: 'assistant', 
        content: 'This system is designed to answer questions related to the provided dataset only.'
      });
    }

    // Step 2: Execute SQL
    let dataResult: any[] = [];
    try {
      if (parsed.sql) {
        const result = await db.query(parsed.sql);
        dataResult = result.rows;
      }
    } catch (e: any) {
      console.error('SQL Execution Error:', e);
      // Attempting to recover by just telling the LLM the query failed
      dataResult = [{ error: e.message }];
    }

    // Step 3: Answer Synthesis
    const synthesisPrompt = `
You are an expert data analyst for an Order-to-Cash system.
The user asked: "${userQuery}"

To answer this, we ran a database query which returned the following JSON data:
${JSON.stringify(dataResult).slice(0, 3000)} // Truncated to avoid overflow

Using ONLY this data, synthesize a clear, helpful natural language response. If the data is empty, say no records were found. 
Do not mention "I ran a SQL query" or internal json structure. Just answer the user's question directly giving the facts. Focus on being concise but detailed.

IMPORTANT: You must output your final response STRICTLY as a JSON object with two keys:
{
  "answer": "Your natural language response here formatted with markdown...",
  "highlight_nodes": ["id1", "id2", "id3"] // extracting the actual node IDs mentioned in the result or query to highlight them.
}
`;

    const finalResponse = await model.generateContent(synthesisPrompt);
    const finalAnswerText = finalResponse.response.text().trim();
    let finalAnswerObj;
    try {
      finalAnswerObj = JSON.parse(finalAnswerText.replace(/```json|```/g, ''));
    } catch {
      finalAnswerObj = { answer: finalAnswerText, highlight_nodes: [] };
    }

    return NextResponse.json({
      role: 'assistant',
      content: finalAnswerObj.answer,
      highlight_nodes: finalAnswerObj.highlight_nodes || [],
      meta: {
        sql: parsed.sql,
        dataSize: dataResult.length
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
