import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Search, Send, User, MessageSquare, Phone, Clock,
  CheckCheck, ArrowLeft, Bot, MoreVertical, Loader2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function initials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  Skeleton components                                                */
/* ------------------------------------------------------------------ */

function ConversationSkeleton() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-white/10 rounded" />
              <div className="h-3 w-10 bg-white/10 rounded" />
            </div>
            <div className="h-3 w-40 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      {[...Array(5)].map((_, i) => {
        const isLeft = i % 2 === 0;
        return (
          <div key={i} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
            <div className={`rounded-2xl px-4 py-3 space-y-2 ${isLeft ? 'bg-white/5 w-[60%]' : 'bg-white/5 w-[50%]'}`}>
              <div className="h-3 w-full bg-white/10 rounded" />
              <div className="h-3 w-3/4 bg-white/10 rounded" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message bubble styling by sender                                   */
/* ------------------------------------------------------------------ */

function senderStyle(sender) {
  switch (sender) {
    case 'aria':
      return {
        align: 'justify-start',
        bubble: 'bg-[#1A1A24] rounded-tl-sm border border-white/5',
        label: 'ARIA',
        labelColor: 'text-[#6C63FF]',
        Icon: Bot,
      };
    case 'doctor':
      return {
        align: 'justify-start',
        bubble: 'bg-[#1A1A24] rounded-tl-sm border border-[#00D4AA]/20',
        label: 'Doctor',
        labelColor: 'text-[#00D4AA]',
        Icon: User,
      };
    case 'patient':
    default:
      return {
        align: 'justify-end',
        bubble: 'bg-[#00D4AA]/20 rounded-tr-sm border border-[#00D4AA]/10',
        label: null,
        labelColor: '',
        Icon: null,
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function WhatsAppPage() {
  const api = useApi();
  const toast = useToast();

  // Data state
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEnd = useRef(null);

  // ---- Fetch conversations ----
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvos(true);
      const { data } = await api.get('/messages/conversations');
      setConversations(data);
    } catch (err) {
      toast.error('Failed to load conversations');
      console.error(err);
    } finally {
      setLoadingConvos(false);
    }
  }, [api, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ---- Fetch messages for selected conversation ----
  const fetchMessages = useCallback(
    async (patientId) => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${patientId}`);
        setMessages(data);
      } catch (err) {
        toast.error('Failed to load messages');
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [api, toast]
  );

  useEffect(() => {
    if (selected) {
      fetchMessages(selected.patient_id);
    } else {
      setMessages([]);
    }
  }, [selected, fetchMessages]);

  // ---- Auto-scroll to bottom ----
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ---- Select conversation ----
  const selectConversation = (conv) => {
    setSelected(conv);
    setMobileView('chat');
  };

  // ---- Send message ----
  const handleSend = async () => {
    if (!message.trim() || !selected || sending) return;
    const body = message.trim();
    setMessage('');
    setSending(true);
    try {
      const { data: sentMsg } = await api.post('/messages/send', {
        patient_id: selected.patient_id,
        body,
      });
      setMessages((prev) => [...prev, sentMsg]);
      // Update last message in conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.patient_id === selected.patient_id
            ? { ...c, last_message: body, last_time: sentMsg.created_at }
            : c
        )
      );
    } catch (err) {
      toast.error('Failed to send message');
      console.error(err);
      // Restore the message so user doesn't lose it
      setMessage(body);
    } finally {
      setSending(false);
    }
  };

  // ---- Filter conversations by search ----
  const filtered = conversations.filter(
    (c) =>
      c.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm)
  );

  // ---- Style tokens ----
  const border = 'border-[rgba(255,255,255,0.07)]';
  const cardBg = 'bg-[#111118]';
  const pageBg = 'bg-[#0A0A0F]';

  return (
    <div className="p-4 md:p-6">
      <div className={`h-[calc(100vh-8rem)] flex rounded-xl border ${border} overflow-hidden ${cardBg}`}>

        {/* ============ Conversation List ============ */}
        <div
          className={`w-full sm:w-80 lg:w-96 border-r ${border} flex flex-col ${
            mobileView === 'chat' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Header + search */}
          <div className={`p-4 border-b ${border}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#00D4AA]" />
                WhatsApp
              </h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 ${pageBg} border ${border} rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent`}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <ConversationSkeleton />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
                <MessageSquare className="w-10 h-10 mb-2 text-gray-600" />
                <p className="text-sm font-medium text-white">No conversations yet</p>
                <p className="text-xs text-center mt-1">
                  {searchTerm ? 'No results match your search' : 'Conversations will appear here when patients message you'}
                </p>
              </div>
            ) : (
              filtered.map((conv) => (
                <div
                  key={conv.patient_id}
                  onClick={() => selectConversation(conv)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/5 transition-colors ${
                    selected?.patient_id === conv.patient_id
                      ? 'bg-[#6C63FF]/10 border-l-2 border-l-[#6C63FF]'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#00B894] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {initials(conv.patient_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{conv.patient_name}</span>
                      <span className="text-[10px] text-gray-500">{relativeTime(conv.last_time)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-400 truncate pr-2">{conv.last_message}</span>
                      {conv.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#00D4AA] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ============ Chat Area ============ */}
        <div className={`flex-1 flex flex-col ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}`}>
          {selected ? (
            <>
              {/* Chat header */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b ${border} ${cardBg}`}>
                <button className="sm:hidden" onClick={() => setMobileView('list')}>
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#00B894] flex items-center justify-center text-white text-sm font-bold">
                  {initials(selected.patient_name)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{selected.patient_name}</div>
                  <div className="text-xs text-gray-500">{selected.phone}</div>
                </div>
                {selected.aria_handling && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                    <span className="text-[10px] font-semibold text-[#00D4AA]">ARIA active</span>
                  </div>
                )}
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Phone className="w-4 h-4 text-gray-400" />
                </button>
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Messages */}
              <div className={`flex-1 overflow-y-auto p-4 ${pageBg} space-y-3`}>
                {loadingMessages ? (
                  <MessageSkeleton />
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageSquare className="w-10 h-10 mb-2 text-gray-600" />
                    <p className="text-sm text-white font-medium">No messages yet</p>
                    <p className="text-xs mt-1">Send a message to start the conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const style = senderStyle(msg.sender);
                    return (
                      <div key={msg.id} className={`flex ${style.align}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${style.bubble}`}>
                          {style.label && (
                            <div className="flex items-center gap-1 mb-1">
                              <style.Icon className={`w-3 h-3 ${style.labelColor}`} />
                              <span className={`text-[10px] font-semibold ${style.labelColor}`}>{style.label}</span>
                            </div>
                          )}
                          <p className="text-sm text-gray-200 whitespace-pre-line">{msg.body}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-gray-500">{relativeTime(msg.created_at)}</span>
                            {msg.direction === 'outbound' && (
                              <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-[#6C63FF]' : 'text-gray-500'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEnd} />
              </div>

              {/* Message input */}
              <div className={`flex items-center gap-2 px-4 py-3 ${cardBg} border-t ${border}`}>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  disabled={sending}
                  className={`flex-1 px-4 py-2 ${pageBg} rounded-full text-sm text-white placeholder-gray-500 border ${border} focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent disabled:opacity-50`}
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="w-10 h-10 bg-[#00D4AA] hover:bg-[#00C4A0] disabled:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="font-medium text-white">Select a conversation</p>
                <p className="text-sm">Choose a patient to view their WhatsApp messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
