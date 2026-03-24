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
      
      const placeholders = focusNodes.map(() => '?').join(',');
      
      // Get all edges involving these nodes
      const edgesQuery = db.prepare(`
        SELECT * FROM edges 
        WHERE source IN (${placeholders}) OR target IN (${placeholders})
        LIMIT 500
      `);
      // Since prepare doesn't allow rest arguments nicely in typescript sometimes, we use `all`
      const edges = edgesQuery.all(...focusNodes, ...focusNodes) as any[];

      // Collect all node IDs from these edges + focus nodes
      const neighborIds = new Set<string>(focusNodes);
      edges.forEach(e => {
        neighborIds.add(e.source);
        neighborIds.add(e.target);
      });

      const neighborPlaceholders = Array.from(neighborIds).map(() => '?').join(',');
      const nodesQuery = db.prepare(`
        SELECT * FROM nodes WHERE id IN (${neighborPlaceholders})
      `);
      const nodes = nodesQuery.all(...Array.from(neighborIds)) as any[];

      return NextResponse.json({
        nodes: nodes.map(n => ({ id: n.id, label: n.label, ...JSON.parse(n.properties) })),
        edges: edges.map(e => ({ source: e.source, target: e.target, label: e.type, ...JSON.parse(e.properties) }))
      });
    } else {
      // Default: fetch a random/limited subgraph for initial view
      const edges = db.prepare('SELECT * FROM edges LIMIT ?').all(limit) as any[];
      const nodeIds = new Set<string>();
      edges.forEach(e => {
        nodeIds.add(e.source);
        nodeIds.add(e.target);
      });
      // We also want some unconnected nodes maybe? No, edges are more interesting
      const placeholders = Array.from(nodeIds).map(() => '?').join(',');
      const nodes = nodeIds.size > 0 
        ? db.prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`).all(...Array.from(nodeIds)) as any[]
        : [];

      // If db is empty, return empty
      if (nodes.length === 0) {
        const fallbackNodes = db.prepare('SELECT * FROM nodes LIMIT ?').all(Math.max(limit, 50)) as any[];
        return NextResponse.json({
          nodes: fallbackNodes.map(n => ({ id: n.id, label: n.label, ...JSON.parse(n.properties) })),
          edges: []
        });
      }

      return NextResponse.json({
        nodes: nodes.map(n => ({ id: n.id, label: n.label, ...JSON.parse(n.properties) })),
        edges: edges.map(e => ({ source: e.source, target: e.target, label: e.type, ...JSON.parse(e.properties) }))
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
