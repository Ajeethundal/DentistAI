import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '@/context/AuthContext';
import { Search, Send, Sparkles, User, MessageSquare } from 'lucide-react';

export default function WhatsAppPage() {
  const api = useApi();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/messages/conversations');
        setConversations(data);
        if (data.length > 0 && !activeConv) setActiveConv(data[0]);
      } catch (err) { console.error(err); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    const loadMessages = async () => {
      try {
        const { data } = await api.get(`/messages/${activeConv.patient_id}`);
        setMessages(data);
      } catch (err) { console.error(err); }
    };
    loadMessages();
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConv) return;
    try {
      await api.post('/messages/send', { patient_id: activeConv.patient_id, body: newMessage });
      setMessages(prev => [...prev, { direction: 'outbound', body: newMessage, sender: 'doctor', created_at: new Date().toISOString() }]);
      setNewMessage('');
    } catch (err) { console.error(err); }
  };

  const templates = [
    "Appointment confirmed for your upcoming visit.",
    "Reminder: your appointment is tomorrow.",
    "We missed you today. Would you like to reschedule?",
    "Your appointment has been rescheduled."
  ];

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const filteredConversations = conversations.filter(c =>
    c.patient_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div data-testid="whatsapp-page" className="flex h-[calc(100vh-40px)]">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r border-[rgba(255,255,255,0.07)] flex flex-col bg-[#111118]">
        <div className="p-4 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-lg font-medium text-[#F0F0F5] font-['Outfit'] mb-3">WhatsApp</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888A0]" />
            <input
              data-testid="whatsapp-search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-[#6C63FF]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto chat-scroll">
          {filteredConversations.map((conv) => (
            <div
              key={conv.patient_id}
              data-testid={`conversation-${conv.patient_id}`}
              onClick={() => setActiveConv(conv)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[rgba(255,255,255,0.04)] transition-all ${activeConv?.patient_id === conv.patient_id ? 'bg-[#6C63FF]/10' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#6C63FF]/15 flex items-center justify-center">
                  <span className="text-xs font-medium text-[#6C63FF]">{getInitials(conv.patient_name)}</span>
                </div>
                {conv.aria_handling && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6C63FF] flex items-center justify-center border-2 border-[#111118]">
                    <Sparkles size={8} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#F0F0F5] truncate">{conv.patient_name}</span>
                  <span className="text-[10px] text-[#8888A0] flex-shrink-0">
                    {new Date(conv.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-[#8888A0] truncate">{conv.last_message}</p>
                  {conv.unread > 0 && (
                    <span className="ml-2 w-5 h-5 rounded-full bg-[#00D4AA] flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat View */}
      {activeConv ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(255,255,255,0.07)] bg-[#111118]/50 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-[#6C63FF]/15 flex items-center justify-center">
              <span className="text-xs font-medium text-[#6C63FF]">{getInitials(activeConv.patient_name)}</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#F0F0F5]">{activeConv.patient_name}</h3>
              <p className="text-xs text-[#8888A0]">{activeConv.phone}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-[#6C63FF] bg-[#6C63FF]/10 px-2 py-1 rounded-full">ARIA auto-reply: ON</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 chat-scroll" data-testid="whatsapp-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} animate-slide-up`} style={{ animationDelay: `${i * 30}ms` }}>
                <div className={`max-w-[65%] p-3 rounded-2xl text-sm ${
                  msg.direction === 'outbound'
                    ? msg.sender === 'aria'
                      ? 'bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-tr-sm'
                      : 'bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-tr-sm'
                    : 'bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] rounded-tl-sm'
                }`}>
                  {msg.sender === 'aria' && msg.direction === 'outbound' && (
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles size={10} className="text-[#6C63FF]" />
                      <span className="text-[10px] text-[#6C63FF] font-medium">ARIA</span>
                    </div>
                  )}
                  {msg.sender === 'doctor' && msg.direction === 'outbound' && (
                    <div className="flex items-center gap-1 mb-1">
                      <User size={10} className="text-[#00D4AA]" />
                      <span className="text-[10px] text-[#00D4AA] font-medium">Dr.</span>
                    </div>
                  )}
                  <p className="text-[#F0F0F5] leading-relaxed">{msg.body}</p>
                  <p className="text-[10px] text-[#8888A0] mt-1.5 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Templates */}
          <div className="px-6 py-2 border-t border-[rgba(255,255,255,0.07)] flex gap-2 overflow-x-auto">
            {templates.map((t, i) => (
              <button
                key={i}
                data-testid={`template-${i}`}
                onClick={() => setNewMessage(t)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] bg-[#111118] border border-[rgba(255,255,255,0.07)] text-[#8888A0] hover:text-[#F0F0F5] hover:border-[#6C63FF]/30 transition-all"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.07)]">
            <div className="flex items-center gap-3">
              <input
                data-testid="whatsapp-message-input"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-[#111118] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#6C63FF] transition-all"
              />
              <button
                data-testid="whatsapp-send-btn"
                onClick={sendMessage}
                className="p-3 rounded-xl bg-[#6C63FF] text-white hover:bg-[#6C63FF]/90 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare size={48} className="text-[#8888A0]/30 mx-auto mb-3" />
            <p className="text-sm text-[#8888A0]">Select a conversation to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}
