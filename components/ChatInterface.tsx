"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface({ onNodesHighlighted }: { onNodesHighlighted: (nodes: string[]) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I can help you analyze the **Order to Cash** process.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }]
        })
      });

      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        if (data.highlight_nodes && Array.isArray(data.highlight_nodes)) {
          onNodesHighlighted(data.highlight_nodes);
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Chat with Graph</h2>
      </div>

      <div className="chat-messages">
        {messages.map((m, idx) => (
          <div key={idx} className={`message-wrapper ${m.role}`}>
            {m.role === 'assistant' ? (
              <div className="avatar ai-avatar">D</div>
            ) : (
              <div className="avatar"><User className="w-5 h-5" /></div>
            )}
            
            <div className="message-content">
              {m.role === 'assistant' ? (
                <div>
                  <span className="name">Dodge AI</span>
                  <span className="role">Graph Agent</span>
                </div>
              ) : (
                <div>
                  <span className="name">You</span>
                </div>
              )}
              <div className="message" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message-wrapper assistant">
            <div className="avatar ai-avatar">D</div>
            <div className="message-content">
               <span className="name">Dodge AI</span>
               <span className="role">Graph Agent</span>
               <div className="message">Thinking...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        {isLoading && (
          <div className="status-badge"><div className="status-dot"></div> Dodge AI is awaiting instructions</div>
        )}
        {!isLoading && (
          <div className="status-badge"><div className="status-dot"></div> Dodge AI is ready</div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-wrapper">
          <textarea
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Analyze anything"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <button type="submit" className="chat-submitBtn" disabled={isLoading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
