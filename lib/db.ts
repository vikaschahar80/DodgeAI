import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      properties JSONB
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      properties JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
  `);
}

/**
 * Returns parameters for PostgreSQL batching/transaction upsert node
 */
export function prepareInsertNode(id: string, label: string, properties: any = {}) {
  return {
    sql: `
      INSERT INTO nodes (id, label, properties)
      VALUES ($1, $2, $3)
      ON CONFLICT(id) DO UPDATE SET 
        label = EXCLUDED.label,
        properties = EXCLUDED.properties
    `,
    args: [id, label, JSON.stringify(properties)]
  };
}

/**
 * Returns parameters for PostgreSQL batching/transaction insert edge
 */
export function prepareInsertEdge(source: string, target: string, type: string, properties: any = {}) {
  const id = `${source}-${type}-${target}`;
  return {
    sql: `
      INSERT INTO edges (id, source, target, type, properties)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(id) DO NOTHING
    `,
    args: [id, source, target, type, JSON.stringify(properties)]
  };
}

export default db;
