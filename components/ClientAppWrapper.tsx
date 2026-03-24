"use client";

import { useState } from 'react';
import GraphView from './GraphView';
import ChatInterface from './ChatInterface';

export default function ClientAppWrapper() {
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);

  return (
    <div className="app-container">
      <GraphView 
        highlightedNodes={highlightedNodes} 
        onClearHighlight={() => setHighlightedNodes([])}
      />
      <ChatInterface onNodesHighlighted={setHighlightedNodes} />
    </div>
  );
}
