import React, { useState, useEffect } from 'react';
import { useApi } from '@/context/AuthContext';
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const outcomeColors = {
  booked: 'bg-[#00D4AA]/15 text-[#00D4AA]',
  rescheduled: 'bg-[#6C63FF]/15 text-[#6C63FF]',
  inquiry: 'bg-[#FFB347]/15 text-[#FFB347]',
  no_action: 'bg-[#8888A0]/15 text-[#8888A0]',
  no_answer: 'bg-[#FF5B6A]/15 text-[#FF5B6A]',
};

export default function CallsPage() {
  const api = useApi();
  const [calls, setCalls] = useState([]);
  const [tab, setTab] = useState('all');
  const [expandedCall, setExpandedCall] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const params = tab === 'all' ? {} : { direction: tab };
        const { data } = await api.get('/calls', { params });
        setCalls(data);
      } catch (err) { console.error(err); }
    };
    load();
  }, [tab]);

  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div data-testid="calls-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">Calls</h1>
          <p className="text-sm text-[#8888A0]">{calls.length} calls</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] rounded-lg border border-[rgba(255,255,255,0.07)] p-0.5 w-fit">
        {[{ key: 'all', label: 'All' }, { key: 'inbound', label: 'Inbound' }, { key: 'outbound', label: 'Outbound' }].map(t => (
          <button
            key={t.key}
            data-testid={`calls-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-[#6C63FF] text-white' : 'text-[#8888A0] hover:text-[#F0F0F5]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Calls List */}
      <div className="space-y-3">
        {calls.map((call) => (
          <div key={call.id} className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden hover:border-[#6C63FF]/20 transition-all">
            {/* Call Row */}
            <div
              data-testid={`call-row-${call.id}`}
              onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
              className="flex items-center gap-4 p-4 cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${call.direction === 'inbound' ? 'bg-[#00D4AA]/10' : 'bg-[#6C63FF]/10'}`}>
                {call.direction === 'inbound' ? <PhoneIncoming size={18} className="text-[#00D4AA]" /> : <PhoneOutgoing size={18} className="text-[#6C63FF]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F0F0F5]">{call.patient_name || `Unknown — ${call.phone}`}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-[#8888A0]">{call.phone}</span>
                  <span className="text-xs text-[#8888A0]">·</span>
                  <span className="flex items-center gap-1 text-xs text-[#8888A0]"><Clock size={10} /> {formatDuration(call.duration_secs)}</span>
                </div>
              </div>
              <span className="text-xs text-[#8888A0]">{new Date(call.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${outcomeColors[call.outcome] || outcomeColors.no_action}`}>
                {call.outcome?.replace('_', ' ')}
              </span>
              {call.transcript?.length > 0 && (
                expandedCall === call.id ? <ChevronUp size={16} className="text-[#8888A0]" /> : <ChevronDown size={16} className="text-[#8888A0]" />
              )}
            </div>

            {/* Transcript */}
            {expandedCall === call.id && call.transcript?.length > 0 && (
              <div data-testid={`call-transcript-${call.id}`} className="border-t border-[rgba(255,255,255,0.07)] p-4 space-y-3 bg-[#0A0A0F]/50 animate-fade-in">
                <h4 className="text-xs text-[#8888A0] uppercase tracking-wider mb-3">Call Transcript</h4>
                {call.transcript.map((line, i) => (
                  <div key={i} className={`flex ${line.speaker === 'aria' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                      line.speaker === 'aria'
                        ? 'bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-tr-sm'
                        : 'bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-tl-sm'
                    }`}>
                      <p className="text-[10px] text-[#8888A0] mb-1">{line.speaker === 'aria' ? 'ARIA' : 'Patient'}</p>
                      <p className="text-[#F0F0F5]">{line.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
