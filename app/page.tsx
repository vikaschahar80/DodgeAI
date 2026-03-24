import GraphView from '@/components/GraphView';
import ChatInterface from '@/components/ChatInterface';

export const metadata = {
  title: 'Context Graph System',
  description: 'AI-Powered SAP O2C Context Graph Explorer',
};

export default function Home() {
  return (
    <main className="app-container">
      {/* We could lift state up here if we want the Chat to highlight nodes, 
          but as a simplified demo, we can just render them side-by-side.
          To keep it clean with Server Components, we wrap them in a client state holder
          if they need to talk to each other. For now, we'll build a simple client wrapper inline.
      */}
      <AppWrapper />
    </main>
  );
}

// Since we need to pass highlighted nodes from Chat to Graph, we need a Client Component
import ClientAppWrapper from '@/components/ClientAppWrapper';

function AppWrapper() {
  return <ClientAppWrapper />;
}
