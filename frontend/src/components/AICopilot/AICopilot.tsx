import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MessageSquare, X, Send, Bot, Sparkles, AlertCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Props {
  activeChuteId: string | null;
}

const SUGGESTIONS = [
  'How is the chute health?',
  'Show component wear and RUL.',
  'Is the compressor pressure normal?',
  'Show recent blast effectiveness.',
];

export default function AICopilot({ activeChuteId }: Props) {
  const { token } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('nigha_copilot_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch { /* ignore */ }
    } else {
      // Add initial greeting
      setMessages([
        {
          role: 'assistant',
          content: '### Welcome to Nigha AI Copilot\nI am connected to your industrial telemetry and PLC register streams. Ask me about **chute health**, **compressor pressure**, **valve wear**, or **recent blast effectiveness**.',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, []);

  // Save conversation history to sessionStorage
  const saveHistory = (msgs: Message[]) => {
    setMessages(msgs);
    sessionStorage.setItem('nigha_copilot_history', JSON.stringify(msgs));
  };

  // Keyboard shortcut Ctrl+K / Cmd+K to toggle open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || !activeChuteId) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    saveHistory(updatedMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const chatHistory = updatedMessages.slice(-8).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('http://localhost:5000/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chuteId: activeChuteId,
          message: text,
          history: chatHistory,
        }),
      });

      if (!res.ok) throw new Error('AI Copilot request failed');

      // Add an empty assistant message that we will populate as the stream flows
      const assistantMsg: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      
      let currentMessages = [...updatedMessages, assistantMsg];
      saveHistory(currentMessages);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('No response body reader');

      let accumulatedContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.error) {
                setError(parsed.error);
                break;
              }
              if (parsed.token) {
                accumulatedContent += parsed.token;
                currentMessages = currentMessages.map((msg, idx) => {
                  if (idx === currentMessages.length - 1) {
                    return { ...msg, content: accumulatedContent };
                  }
                  return msg;
                });
                saveHistory(currentMessages);
              }
            } catch (e) {
              // Ignore incomplete lines
            }
          }
        }
      }
    } catch (err: any) {
      setError('Communication loss with AI Gateway.');
    } finally {
      setLoading(false);
    }
  }, [messages, loading, activeChuteId, token]);

  // Render markdown-like text simply (handles bold, code, bullet points, headers)
  const formatMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Headers (e.g. ### Header)
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ margin: '12px 0 6px', fontSize: '13.5px', fontWeight: 800, color: '#00D4FF' }}>{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={idx} style={{ margin: '14px 0 8px', fontSize: '14px', fontWeight: 800, color: '#00D4FF', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>{line.slice(3)}</h4>;
      }

      // Bullet points (e.g. - list item)
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const cleaned = line.slice(2);
        return (
          <li key={idx} style={{ margin: '4px 0 4px 12px', fontSize: '12px', lineHeight: 1.5 }}>
            {parseInlineStyles(cleaned)}
          </li>
        );
      }

      // Standard paragraphs
      return (
        <p key={idx} style={{ margin: '6px 0', fontSize: '12px', lineHeight: 1.5 }}>
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  // Helper to parse bold (**text**) and code (`text`) in lines
  const parseInlineStyles = (line: string) => {
    // Regex for bold **text** and code `text`
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#00D4FF', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#A78BFA' }}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9990,
          width: '54px', height: '54px', borderRadius: '50%',
          background: isOpen ? 'var(--card-bg)' : 'linear-gradient(135deg, #7C3AED, #00D4FF)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(124, 58, 237, 0.35), inset 0 1px 1px rgba(255,255,255,0.2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isOpen ? 'rotate(90deg) scale(0.95)' : 'scale(1)'
        }}
        title="AI Operational Copilot (Ctrl+K)"
      >
        {isOpen ? <X size={22} style={{ color: 'var(--text-primary)' }} /> : <MessageSquare size={22} />}
      </button>

      {/* Copilot Chat Panel */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed', bottom: '90px', right: '24px', zIndex: 9990,
            width: '380px', height: '520px', borderRadius: '16px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: 'var(--font-sans)', color: 'var(--text-primary)'
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(124, 58, 237, 0.05)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: '#00D4FF', animation: 'pulseGlow 1.5s infinite' }} />
              <span style={{ fontSize: '13.5px', fontWeight: 800, letterSpacing: '0.5px' }}>Nigha AI Copilot</span>
            </div>
            <span style={{ fontSize: '9px', background: 'rgba(52, 211, 153, 0.15)', color: '#34D399', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
              Live Stream Active
            </span>
          </div>

          {/* Chat Message Window */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex', gap: '8px',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%'
                  }}
                >
                  {!isUser && (
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bot size={14} style={{ color: '#00D4FF' }} />
                    </div>
                  )}
                  <div
                    style={{
                      padding: '10px 14px', borderRadius: '12px',
                      background: isUser ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'var(--bg-panel, rgba(255,255,255,0.03))',
                      border: isUser ? 'none' : '1px solid var(--border)',
                      color: '#fff', fontSize: '12.5px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    {isUser ? m.content : formatMarkdown(m.content)}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={14} style={{ color: '#00D4FF', animation: 'spin 2s linear infinite' }} />
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-panel, rgba(255,255,255,0.03))', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="dot-pulse" style={{ width: '5px', height: '5px', background: '#00D4FF', borderRadius: '50%', animation: 'pulse 1s infinite alternate' }} />
                  <span className="dot-pulse" style={{ width: '5px', height: '5px', background: '#00D4FF', borderRadius: '50%', animation: 'pulse 1s infinite alternate 0.2s' }} />
                  <span className="dot-pulse" style={{ width: '5px', height: '5px', background: '#00D4FF', borderRadius: '50%', animation: 'pulse 1s infinite alternate 0.4s' }} />
                </div>
              </div>
            )}

            {error && (
              <div style={{ display: 'flex', gap: '6px', alignSelf: 'center', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px', padding: '8px 12px', color: '#F43F5E', fontSize: '11.5px', alignItems: 'center' }}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestions prompt chips */}
          {messages.length < 3 && (
            <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>SUGGESTED QUERIES</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s)}
                    style={{
                      background: 'var(--bg-panel, rgba(255,255,255,0.03))', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '5px 10px', color: '#00D4FF', fontSize: '10.5px',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    className="suggestion-chip-hover"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            style={{
              padding: '12px 16px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: '10px', alignItems: 'center',
              background: 'rgba(0,0,0,0.15)'
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeChuteId ? 'Ask copilot... (Ctrl+K)' : 'Select a chute to query...'}
              disabled={loading || !activeChuteId}
              style={{
                flex: 1, background: 'var(--bg-panel, rgba(255,255,255,0.05))',
                border: '1px solid var(--border)', borderRadius: '8px',
                padding: '10px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', transition: 'border-color 0.2s'
              }}
              className="chat-input-focus"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || !activeChuteId}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: (loading || !input.trim() || !activeChuteId) ? 'var(--border)' : '#00D4FF',
                border: 'none', color: '#0a0f1a', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: (loading || !input.trim() || !activeChuteId) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
