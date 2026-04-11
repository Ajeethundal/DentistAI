import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Sparkles } from 'lucide-react';
import { useAuth, useApi } from '@/context/AuthContext';

export default function AriaChat({ compact = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [actionRipple, setActionRipple] = useState(false);
  const messagesEndRef = useRef(null);
  const api = useApi();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/aria/chat', {
        message: input,
        conversation_id: conversationId
      });
      
      setConversationId(data.conversation_id);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        tools_used: data.tools_used || [],
        timestamp: data.timestamp
      }]);

      if (data.tools_used?.length > 0) {
        setActionRipple(true);
        setTimeout(() => setActionRipple(false), 800);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm experiencing a brief hiccup. Could you try again?",
        tools_used: [],
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toolIcons = {
    calendar: '\uD83D\uDCC5',
    whatsapp: '\uD83D\uDCF1',
    phone: '\uD83D\uDCDE',
    stats: '\uD83D\uDCCA',
  };

  return (
    <div data-testid="aria-chat" className={`flex flex-col ${compact ? 'h-[500px]' : 'h-full'} glass rounded-xl overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[rgba(255,255,255,0.07)]">
        <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 flex items-center justify-center ${actionRipple ? 'aria-action-ripple' : 'aria-orb'}`}>
          <Sparkles size={18} className="text-white" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00D4AA] border-2 border-[#111118]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">ARIA</h3>
          <p className="text-[10px] text-[#00D4AA]">Online — Ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/40 aria-orb flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-white" />
            </div>
            <h4 className="text-sm font-medium text-[#F0F0F5] mb-2 font-['Outfit']">Talk to ARIA</h4>
            <p className="text-xs text-[#8888A0] max-w-[250px]">
              Ask me about your schedule, book appointments, follow up with patients, or get practice insights.
            </p>
            <div className="mt-4 space-y-2 w-full max-w-[280px]">
              {["What does tomorrow look like?", "How many no-shows this week?", "Book a cleaning for Maria at 3pm Thursday"].map((suggestion, i) => (
                <button
                  key={i}
                  data-testid={`aria-suggestion-${i}`}
                  onClick={() => setInput(suggestion)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[#111118] border border-[rgba(255,255,255,0.07)] text-xs text-[#8888A0] hover:text-[#F0F0F5] hover:border-[#6C63FF]/30 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-2xl rounded-tr-sm'
                : 'bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-2xl rounded-tl-sm backdrop-blur-sm'
            } p-3`}>
              <p className="text-sm text-[#F0F0F5] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.tools_used?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[rgba(255,255,255,0.07)]">
                  {msg.tools_used.map((tool, j) => (
                    <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0A0A0F] text-[10px] text-[#8888A0]">
                      {toolIcons[tool.icon] || '\u2713'} {tool.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-2xl rounded-tl-sm p-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#6C63FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#6C63FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#6C63FF] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.07)]">
        <div className="flex items-center gap-2 bg-[#0A0A0F] rounded-xl border border-[rgba(255,255,255,0.07)] focus-within:border-[#6C63FF]/50 transition-all px-3">
          <input
            data-testid="aria-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ARIA anything..."
            className="flex-1 bg-transparent py-3 text-sm text-[#F0F0F5] placeholder:text-[#8888A0]/60 outline-none"
          />
          <button
            data-testid="aria-mic-button"
            className="p-1.5 rounded-lg text-[#8888A0] hover:text-[#6C63FF] transition-all"
          >
            <Mic size={18} />
          </button>
          <button
            data-testid="aria-send-button"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-[#6C63FF] text-white hover:bg-[#6C63FF]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
