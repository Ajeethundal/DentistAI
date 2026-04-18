import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Phone, PhoneOutgoing, PhoneIncoming, PhoneOff, Clock,
  Play, Mic, Volume2, User, Bot, Sparkles, Calendar,
  AlertCircle, TrendingUp, Zap, BarChart3, Globe, ChevronRight,
  X, Loader2,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────── */

function formatDuration(secs) {
  if (secs == null) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

function outcomeBadge(outcome) {
  if (!outcome) return { label: outcome || 'Unknown', cls: 'bg-gray-500/15 text-gray-400' };
  const key = outcome.toLowerCase();
  if (key.includes('book')) return { label: 'Booked', cls: 'bg-[#00D4AA]/15 text-[#00D4AA]' };
  if (key.includes('confirm')) return { label: 'Confirmed', cls: 'bg-[#6C63FF]/15 text-[#6C63FF]' };
  if (key.includes('voicemail') || key.includes('no-answer') || key.includes('no_answer'))
    return { label: 'Voicemail', cls: 'bg-amber-500/15 text-amber-400' };
  if (key.includes('cancel')) return { label: 'Cancelled', cls: 'bg-red-500/15 text-red-400' };
  return { label: outcome, cls: 'bg-gray-500/15 text-gray-400' };
}

/* ── shared styles ───────────────────────────────────────── */

const border = 'border-[rgba(255,255,255,0.07)]';
const cardBg = 'bg-[#111118]';

/* ── skeleton components ─────────────────────────────────── */

function SkeletonStatCard() {
  return (
    <div className={`${cardBg} rounded-xl border ${border} p-5 animate-pulse`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-white/5" />
        <div className="w-8 h-3 rounded bg-white/5" />
      </div>
      <div className="w-16 h-7 rounded bg-white/5 mb-1" />
      <div className="w-24 h-3 rounded bg-white/5 mt-1" />
    </div>
  );
}

function SkeletonCallRow() {
  return (
    <div className="px-6 py-4 flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-white/5" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="w-36 h-4 rounded bg-white/5" />
        <div className="w-48 h-3 rounded bg-white/5" />
      </div>
      <div className="space-y-2 text-right">
        <div className="w-10 h-4 rounded bg-white/5 ml-auto" />
        <div className="w-14 h-3 rounded bg-white/5 ml-auto" />
      </div>
      <div className="w-4 h-4 rounded bg-white/5" />
    </div>
  );
}

/* ── main component ──────────────────────────────────────── */

export default function CallsPage() {
  const api = useApi();
  const toast = useToast();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCallId, setSelectedCallId] = useState(null);

  // Dialer modal state
  const [showDialer, setShowDialer] = useState(false);
  const [dialerNumber, setDialerNumber] = useState('');
  const [dialerName, setDialerName] = useState('');
  const [dialerObjective, setDialerObjective] = useState('');
  const [dialerLoading, setDialerLoading] = useState(false);

  /* ── fetch calls ──────────────────────────────────────── */

  const fetchCalls = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/calls');
      setCalls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
      const msg = err.response?.data?.detail || 'Failed to load calls';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [api, toast]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  /* ── computed stats ───────────────────────────────────── */

  const stats = React.useMemo(() => {
    const total = calls.length;
    const inbound = calls.filter(c => c.direction === 'inbound').length;
    const outbound = calls.filter(c => c.direction === 'outbound').length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration_secs || 0), 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

    return [
      { label: 'Total Calls', value: String(total), Icon: Phone, color: '#6C63FF' },
      { label: 'Inbound', value: String(inbound), Icon: PhoneIncoming, color: '#22D3EE' },
      { label: 'Outbound', value: String(outbound), Icon: PhoneOutgoing, color: '#00D4AA' },
      { label: 'Avg Duration', value: formatDuration(avgDuration), Icon: Clock, color: '#A78BFA' },
    ];
  }, [calls]);

  /* ── place a new call ─────────────────────────────────── */

  const placeCall = async () => {
    if (!dialerNumber.trim()) return;
    setDialerLoading(true);
    try {
      await api.post('/retell/call', {
        to_number: dialerNumber.trim(),
        patient_name: dialerName.trim() || undefined,
        objective: dialerObjective.trim() || undefined,
      });
      toast.success('Call initiated successfully');
      setShowDialer(false);
      setDialerNumber('');
      setDialerName('');
      setDialerObjective('');
      // Refresh list to pick up the new call
      fetchCalls();
    } catch (err) {
      console.error('Failed to place call:', err);
      toast.error(err.response?.data?.detail || 'Failed to place call');
    } finally {
      setDialerLoading(false);
    }
  };

  /* ── toggle transcript ────────────────────────────────── */

  const toggleCall = (id) => {
    setSelectedCallId(prev => (prev === id ? null : id));
  };

  /* ── render ────────────────────────────────────────────── */

  return (
    <div className="p-4 md:p-6 space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Phone className="w-6 h-6 text-[#6C63FF]" /> Voice AI Calls
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            ARIA handles inbound and outbound calls with natural voice AI
          </p>
        </div>
        <button
          onClick={() => setShowDialer(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#6C63FF] to-[#8B83FF] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#6C63FF]/20 transition-all"
        >
          <PhoneOutgoing className="w-4 h-4" /> New Call
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : stats.map((stat, i) => (
              <div key={i} className={`${cardBg} rounded-xl border ${border} p-5 hover:border-white/15 transition-all`}>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stat.color + '15' }}
                  >
                    <stat.Icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
      </div>

      {/* ARIA capabilities */}
      <div className={`${cardBg} rounded-xl border ${border} p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-[#6C63FF]" />
          <h3 className="font-bold text-white">What ARIA Handles on Calls</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { I: Calendar, t: 'Books appointments in real-time' },
            { I: AlertCircle, t: 'Triages dental emergencies' },
            { I: Globe, t: 'Speaks 40+ languages naturally' },
            { I: Zap, t: 'Answers FAQs about procedures' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#0A0A0F] rounded-lg p-3 border border-white/5">
              <item.I className="w-4 h-4 text-[#6C63FF] shrink-0" />
              <span className="text-sm text-gray-300">{item.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Call History */}
      <div className={`${cardBg} rounded-xl border ${border} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${border} flex items-center justify-between`}>
          <h3 className="font-bold text-white">Call History</h3>
          {!loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="w-4 h-4" />
              <span>{calls.length} call{calls.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCallRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-gray-300 font-medium mb-1">Failed to load calls</p>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => { setLoading(true); fetchCalls(); }}
              className="px-4 py-2 bg-[#6C63FF] text-white rounded-lg text-sm font-semibold hover:bg-[#5B52EE] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : calls.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#6C63FF]/10 flex items-center justify-center mb-4">
              <Phone className="w-8 h-8 text-[#6C63FF]" />
            </div>
            <p className="text-gray-300 font-medium mb-1">No calls yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Place your first AI-powered call to get started
            </p>
            <button
              onClick={() => setShowDialer(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#6C63FF] to-[#8B83FF] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#6C63FF]/20 transition-all"
            >
              <PhoneOutgoing className="w-4 h-4" /> Make First Call
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {calls.map((call) => {
              const badge = outcomeBadge(call.outcome);
              const isSelected = selectedCallId === call.id;
              return (
                <div
                  key={call.id}
                  onClick={() => toggleCall(call.id)}
                  className="px-6 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        call.direction === 'inbound'
                          ? 'bg-[#6C63FF]/10 text-[#6C63FF]'
                          : 'bg-[#00D4AA]/10 text-[#00D4AA]'
                      }`}
                    >
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="w-5 h-5" />
                      ) : (
                        <PhoneOutgoing className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {call.patient_name || 'Unknown Caller'}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{call.phone || 'No number'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-gray-400">
                        {formatDuration(call.duration_secs)}
                      </div>
                      <div className="text-xs text-gray-600">{timeAgo(call.created_at)}</div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-600 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                    />
                  </div>

                  {/* Expanded transcript */}
                  {isSelected && (
                    <div className="mt-4 ml-14 p-4 bg-[#0A0A0F] rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Bot className="w-4 h-4 text-[#6C63FF]" />
                        <span className="text-xs font-bold text-[#6C63FF] uppercase tracking-wider">
                          Transcript
                        </span>
                      </div>
                      {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {call.transcript.map((line, i) => (
                            <div key={i} className="text-sm">
                              <span
                                className={`font-semibold ${
                                  (line.speaker || '').toLowerCase().includes('aria') ||
                                  (line.speaker || '').toLowerCase().includes('bot') ||
                                  (line.speaker || '').toLowerCase().includes('agent')
                                    ? 'text-[#6C63FF]'
                                    : 'text-[#00D4AA]'
                                }`}
                              >
                                {line.speaker}:{' '}
                              </span>
                              <span className="text-gray-300">{line.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No transcript available</p>
                      )}

                      {call.outcome && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <span className="text-xs text-gray-500">Outcome: </span>
                          <span className={`text-xs font-semibold ${outcomeBadge(call.outcome).cls} px-2 py-0.5 rounded-full`}>
                            {outcomeBadge(call.outcome).label}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialerNumber(call.phone || '');
                            setDialerName(call.patient_name || '');
                            setShowDialer(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6C63FF] text-white rounded-lg text-xs font-semibold hover:bg-[#5B52EE] transition-colors"
                        >
                          <Phone className="w-3 h-3" /> Call Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialer Modal */}
      {showDialer && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDialer(false)}
        >
          <div
            className={`${cardBg} rounded-2xl shadow-2xl border border-white/10 w-full max-w-sm p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-white">Start AI Call</h3>
              <button
                onClick={() => setShowDialer(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-5">ARIA will make the call on your behalf</p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Phone Number *</label>
                <input
                  type="tel"
                  value={dialerNumber}
                  onChange={(e) => setDialerNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className={`w-full px-4 py-3 bg-[#0A0A0F] border ${border} rounded-xl text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent`}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Patient Name</label>
                <input
                  type="text"
                  value={dialerName}
                  onChange={(e) => setDialerName(e.target.value)}
                  placeholder="e.g. Sarah Johnson"
                  className={`w-full px-4 py-3 bg-[#0A0A0F] border ${border} rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent`}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Call Objective</label>
                <input
                  type="text"
                  value={dialerObjective}
                  onChange={(e) => setDialerObjective(e.target.value)}
                  placeholder="e.g. Appointment reminder for tomorrow"
                  className={`w-full px-4 py-3 bg-[#0A0A0F] border ${border} rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent`}
                />
              </div>
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDialerNumber((n) => n + d)}
                  className="py-3 text-xl font-medium text-white bg-[#1A1A24] hover:bg-[#222230] rounded-xl transition-colors border border-white/5"
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              onClick={placeCall}
              disabled={!dialerNumber.trim() || dialerLoading}
              className="w-full py-3 bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dialerLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Placing Call...
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5" /> Start AI Call
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
