"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const LABEL_COLORS: Record<string, string> = {
  Customer: '#58a6ff',
  SalesOrder: '#8957e5',
  Product: '#3fb950',
  Delivery: '#d2a8ff',
  Billing: '#f0883e',
  JournalEntry: '#ff7b72',
};

export default function GraphView({ highlightedNodes, onClearHighlight }: { highlightedNodes: string[], onClearHighlight?: () => void }) {
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/graph?limit=500')
      .then(res => res.json())
      .then(data => {
        setGraphData(data);
      });
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div className="graph-panel" ref={containerRef}>
      <div className="graph-overlay-ui">
        <h1>O2C Context Graph</h1>
        <p>{graphData.nodes.length} nodes, {graphData.links?.length || graphData.edges?.length} edges</p>
        
        {highlightedNodes.length > 0 && onClearHighlight && (
          <button 
            onClick={onClearHighlight} 
            className="chat-submitBtn" 
            style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.8rem', pointerEvents: 'auto' }}
          >
            Show Original Graph
          </button>
        )}
      </div>

      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{
          nodes: graphData.nodes,
          links: (graphData as any).edges || graphData.links || []
        }}
        nodeAutoColorBy="label"
        nodeColor={(node: any) => {
          const isHighlighted = highlightedNodes.length > 0 ? highlightedNodes.includes(node.id) : true;
          const baseColor = LABEL_COLORS[node.label] || '#8b949e';
          return isHighlighted ? baseColor : 'rgba(139, 148, 158, 0.2)';
        }}
        nodeLabel={(node: any) => `${node.label}: ${node.name || node.type || node.id}`}
        linkColor={(link: any) => {
          if (highlightedNodes.length > 0) {
             const sId = link.source.id || link.source;
             const tId = link.target.id || link.target;
             const isHighlightedNode = highlightedNodes.includes(sId) || highlightedNodes.includes(tId);
             
             if (highlightedNodes.includes(sId) && highlightedNodes.includes(tId)) {
                return '#3b82f6'; // Bright blue for exact active edge path
             }
             return isHighlightedNode ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)';
          }
          return 'rgba(255,255,255,0.2)';
        }}
        linkWidth={(link: any) => {
          if (highlightedNodes.length > 0) {
             const sId = link.source.id || link.source;
             const tId = link.target.id || link.target;
             if (highlightedNodes.includes(sId) && highlightedNodes.includes(tId)) return 3;
          }
          return 1;
        }}
        backgroundColor="transparent"
      />
    </div>
  );
}
