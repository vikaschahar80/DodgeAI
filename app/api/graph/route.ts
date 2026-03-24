import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const focusNodesStr = searchParams.get('nodes');

  try {
    if (focusNodesStr) {
      // Fetch specific nodes and their 1-hop neighborhood
      const focusNodes = focusNodesStr.split(',').map(s => s.trim());
      
      // PostgreSQL uses $1, $2 for parameters
      const placeholders = focusNodes.map((_, i) => `$${i + 1}`).join(',');
      const secondaryPlaceholders = focusNodes.map((_, i) => `$${focusNodes.length + i + 1}`).join(',');
      
      const edgesQuery = `
        SELECT * FROM edges 
        WHERE source IN (${placeholders}) OR target IN (${secondaryPlaceholders})
        LIMIT 500
      `;
      const edgesResult = await db.query(edgesQuery, [...focusNodes, ...focusNodes]);
      const edges = edgesResult.rows;

      const neighborIds = new Set<string>(focusNodes);
      edges.forEach(e => {
        neighborIds.add(e.source);
        neighborIds.add(e.target);
      });

      const neighborArray = Array.from(neighborIds);
      const neighborPlaceholders = neighborArray.map((_, i) => `$${i + 1}`).join(',');
      const nodesResult = await db.query(
        `SELECT * FROM nodes WHERE id IN (${neighborPlaceholders})`,
        neighborArray
      );
      const nodes = nodesResult.rows;

      return NextResponse.json({
        nodes: nodes.map(n => ({ id: n.id, label: n.label, ...n.properties })),
        edges: edges.map(e => ({ source: e.source, target: e.target, label: e.type, ...e.properties }))
      });
    } else {
      // Default: fetch a random/limited subgraph
      const edgesResult = await db.query('SELECT * FROM edges LIMIT $1', [limit]);
      const edges = edgesResult.rows;

      const nodeIds = new Set<string>();
      edges.forEach(e => {
        nodeIds.add(e.source);
        nodeIds.add(e.target);
      });

      const nodeIdsArray = Array.from(nodeIds);
      let nodes: any[] = [];
      if (nodeIdsArray.length > 0) {
        const placeholders = nodeIdsArray.map((_, i) => `$${i + 1}`).join(',');
        const nodesResult = await db.query(`SELECT * FROM nodes WHERE id IN (${placeholders})`, nodeIdsArray);
        nodes = nodesResult.rows;
      }

      if (nodes.length === 0) {
        const fallbackResult = await db.query('SELECT * FROM nodes LIMIT $1', [Math.max(limit, 50)]);
        const fallbackNodes = fallbackResult.rows;
        return NextResponse.json({
          nodes: fallbackNodes.map(n => ({ id: n.id, label: n.label, ...n.properties })),
          edges: []
        });
      }

      return NextResponse.json({
        nodes: nodes.map(n => ({ id: n.id, label: n.label, ...n.properties })),
        edges: edges.map(e => ({ source: e.source, target: e.target, label: e.type, ...e.properties }))
      });
    }
  } catch (error: any) {
    console.error('Graph API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
