import React, { useState, useEffect, useRef } from 'react';
import { useApi, useAuth } from '@/context/AuthContext';
import AriaChat from '@/components/AriaChat';
import { Phone, Calendar, MessageSquare, TrendingDown, TrendingUp, Clock, Activity, Wifi, CheckCircle, XCircle } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let start = 0;
    const step = (timestamp) => {
      if (!ref.current) ref.current = timestamp;
      const progress = Math.min((timestamp - ref.current) / duration, 1);
      setDisplay(Math.floor(progress * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    ref.current = null;
    requestAnimationFrame(step);
  }, [value, duration]);
  return <span>{display}</span>;
}

const typeIcons = { call: Phone, whatsapp: MessageSquare, booking: Calendar, followup: Activity, cancellation: Activity };
const typeColors = { call: '#00D4AA', whatsapp: '#6C63FF', booking: '#FFB347', followup: '#8888A0', cancellation: '#FF5B6A' };

function StatusBadge({ status }) {
  const colors = {
    done: 'bg-[#00D4AA]/15 text-[#00D4AA]',
    pending: 'bg-[#FFB347]/15 text-[#FFB347]',
    failed: 'bg-[#FF5B6A]/15 text-[#FF5B6A]',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[status] || colors.done}`}>
      {status}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCardSkeleton() {
  return (
    <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 bg-[#1A1A24] rounded" />
        <div className="h-5 w-5 bg-[#1A1A24] rounded" />
      </div>
      <div className="h-8 w-16 bg-[#1A1A24] rounded mb-2" />
      <div className="h-10 w-full bg-[#1A1A24] rounded" />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#0A0A0F]/50 animate-pulse">
          <div className="w-8 h-8 bg-[#1A1A24] rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-[#1A1A24] rounded" />
            <div className="h-2.5 w-1/3 bg-[#1A1A24] rounded" />
          </div>
          <div className="h-4 w-12 bg-[#1A1A24] rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#0A0A0F]/30 animate-pulse">
          <div className="h-4 w-14 bg-[#1A1A24] rounded" />
          <div className="w-8 h-8 bg-[#1A1A24] rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/2 bg-[#1A1A24] rounded" />
            <div className="h-2.5 w-1/3 bg-[#1A1A24] rounded" />
          </div>
          <div className="h-4 w-16 bg-[#1A1A24] rounded-full" />
        </div>
      ))}
    </div>
  );
}

function PatientAvatar({ name }) {
  const parts = (name || '').split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] || '?').toUpperCase();

  // Deterministic color from name
  const colors = ['#6C63FF', '#00D4AA', '#FFB347', '#FF5B6A', '#8888A0'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {initials}
    </div>
  );
}

const generateSparkData = (current, variance = 3) => {
  return Array.from({ length: 7 }, (_, i) => ({
    value: Math.max(0, current + Math.floor((Math.random() - 0.5) * variance * 2) - (6 - i))
  }));
};

const feedFilterOptions = [
  { key: 'all', label: 'All' },
  { key: 'call', label: 'Calls' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'booking', label: 'Bookings' },
];

export default function DashboardPage() {
  const api = useApi();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [feedFilter, setFeedFilter] = useState('all');
  const [feedLoading, setFeedLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [sparkData, setSparkData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, feedRes, scheduleRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/activity-feed'),
          api.get('/dashboard/today-schedule')
        ]);
        setStats(statsRes.data);
        setFeed(feedRes.data);
        setTodaySchedule(scheduleRes.data);

        // Generate sparkline data based on actual stats
        const s = statsRes.data;
        setSparkData({
          calls: generateSparkData(s.calls_today, 4),
          appointments: generateSparkData(s.appointments_week, 5),
          messages: generateSparkData(s.messages_sent, 6),
          noshow: generateSparkData(s.no_show_rate, 3),
        });
      } catch (err) { console.error('Dashboard load error:', err); }
      setFeedLoading(false);
      setScheduleLoading(false);
    };
    load();
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const practiceId = user?.practice_id;
    if (!practiceId) return;

    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://') + `/ws/${practiceId}`;

    let ws;
    let reconnectTimer;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => { setWsConnected(true); };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'activity' && msg.data) {
              setFeed(prev => [msg.data, ...prev].slice(0, 20));
            }
          } catch {}
        };
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 5000);
        };
        ws.onerror = () => { ws.close(); };
      } catch {}
    };

    connect();
    return () => { if (ws) ws.close(); clearTimeout(reconnectTimer); };
  }, [user?.practice_id]);

  const statCards = stats ? [
    { label: 'Calls Today', value: stats.calls_today, change: stats.calls_today - stats.calls_yesterday, icon: Phone, color: '#00D4AA', sparkKey: 'calls' },
    { label: 'Appointments This Week', value: stats.appointments_week, change: null, icon: Calendar, color: '#6C63FF', sparkKey: 'appointments' },
    { label: 'WhatsApp Messages', value: stats.messages_sent, change: null, icon: MessageSquare, color: '#FFB347', sparkKey: 'messages' },
    { label: 'No-Show Rate', value: stats.no_show_rate, suffix: '%', isRate: true, icon: TrendingDown, color: stats.no_show_rate > 10 ? '#FF5B6A' : '#00D4AA', sparkKey: 'noshow' },
  ] : [];

  const apptStatusColors = {
    confirmed: 'border-l-[#00D4AA] bg-[#00D4AA]/5',
    pending: 'border-l-[#FFB347] bg-[#FFB347]/5',
    completed: 'border-l-[#8888A0] bg-[#8888A0]/5',
    cancelled: 'border-l-[#FF5B6A] bg-[#FF5B6A]/5',
    noshow: 'border-l-[#FFB347] bg-[#FFB347]/5',
  };

  const hour = new Date().getHours();

  const filteredFeed = feedFilter === 'all'
    ? feed
    : feed.filter(item => item.type === feedFilter);

  return (
    <div data-testid="dashboard-page" className="p-6 space-y-6">
      {/* Greeting Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">
          Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0] || 'Doctor'}
        </h1>
        <p className="text-sm text-[#8888A0]">Here's what's happening at your practice today</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats === null ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          statCards.map((card, i) => (
            <div
              key={i}
              data-testid={`stat-card-${i}`}
              className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 hover:-translate-y-1 hover:border-[#6C63FF]/30 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#8888A0] uppercase tracking-wider font-medium">{card.label}</span>
                <card.icon size={18} style={{ color: card.color }} />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-light text-[#F0F0F5] font-['Outfit'] animate-count-up">
                  <AnimatedNumber value={card.value} />
                  {card.suffix || ''}
                </span>
                {card.change != null && (
                  <span className={`flex items-center gap-0.5 text-xs mb-1 ${card.change >= 0 ? 'text-[#00D4AA]' : 'text-[#FF5B6A]'}`}>
                    {card.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(card.change)} vs yesterday
                  </span>
                )}
              </div>
              {/* Sparkline */}
              {sparkData && sparkData[card.sparkKey] && (
                <div className="mt-2 h-[50px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData[card.sparkKey]}>
                      <defs>
                        <linearGradient id={`spark-${card.sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={card.color}
                        strokeWidth={1.5}
                        fill={`url(#spark-${card.sparkKey})`}
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">ARIA Activity Feed</h2>
              <div className="flex items-center gap-2">
                {wsConnected && <span className="flex items-center gap-1 text-[10px] text-[#00D4AA]"><Wifi size={10} /> Live</span>}
                <span className="text-[10px] text-[#8888A0]">Real-time</span>
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              {feedFilterOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFeedFilter(opt.key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                    feedFilter === opt.key
                      ? 'bg-[#6C63FF]/20 text-[#6C63FF] border border-[#6C63FF]/30'
                      : 'bg-[#0A0A0F] text-[#8888A0] border border-[rgba(255,255,255,0.07)] hover:text-[#F0F0F5] hover:border-[rgba(255,255,255,0.15)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {feedLoading ? (
              <FeedSkeleton />
            ) : (
              <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto chat-scroll" data-testid="activity-feed">
                <AnimatePresence initial={false}>
                  {filteredFeed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#6C63FF]/10 flex items-center justify-center mb-3 animate-pulse">
                        <Activity size={20} className="text-[#6C63FF]" />
                      </div>
                      <p className="text-sm text-[#8888A0]">No activity yet — ARIA is standing by</p>
                    </div>
                  ) : (
                    filteredFeed.map((item, i) => {
                      const Icon = typeIcons[item.type] || Activity;
                      const color = typeColors[item.type] || '#8888A0';
                      return (
                        <motion.div
                          key={item.id || `feed-${i}`}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-[#0A0A0F]/50 hover:bg-[#0A0A0F] transition-all"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                            <Icon size={16} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#F0F0F5] leading-snug">{item.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.patient_name && (
                                <span className="text-[10px] text-[#6C63FF]">{item.patient_name}</span>
                              )}
                              <span className="text-[10px] text-[#8888A0]">{timeAgo(item.created_at)}</span>
                            </div>
                          </div>
                          <StatusBadge status={item.status} />
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Today's Schedule */}
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Today's Schedule</h2>
              <div className="flex items-center gap-1 text-[10px] text-[#8888A0]">
                <Clock size={12} />
                {todaySchedule.length} appointments
              </div>
            </div>
            {scheduleLoading ? (
              <ScheduleSkeleton />
            ) : (
              <div className="p-4 space-y-2" data-testid="today-schedule">
                {todaySchedule.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#6C63FF]/10 flex items-center justify-center mb-3">
                      <Calendar size={20} className="text-[#6C63FF]" />
                    </div>
                    <p className="text-sm text-[#8888A0]">No appointments today — enjoy the break!</p>
                  </div>
                )}
                {todaySchedule.map((appt, i) => (
                  <div
                    key={i}
                    className={`group flex items-center gap-4 p-3 rounded-lg border-l-2 ${apptStatusColors[appt.status] || 'border-l-[#8888A0]'} transition-all hover:translate-x-1`}
                  >
                    <span className="text-sm font-medium text-[#F0F0F5] font-['JetBrains_Mono'] w-14">{appt.time}</span>
                    <PatientAvatar name={appt.patient_name} />
                    <div className="flex-1">
                      <p className="text-sm text-[#F0F0F5]">{appt.patient_name}</p>
                      <p className="text-xs text-[#8888A0]">{appt.treatment_type}</p>
                    </div>
                    {/* Quick action buttons on hover */}
                    <div className="hidden group-hover:flex items-center gap-1 mr-2">
                      <button
                        title="Complete"
                        className="w-6 h-6 rounded flex items-center justify-center bg-[#00D4AA]/10 hover:bg-[#00D4AA]/25 transition-colors"
                      >
                        <CheckCircle size={13} className="text-[#00D4AA]" />
                      </button>
                      <button
                        title="No-show"
                        className="w-6 h-6 rounded flex items-center justify-center bg-[#FF5B6A]/10 hover:bg-[#FF5B6A]/25 transition-colors"
                      >
                        <XCircle size={13} className="text-[#FF5B6A]" />
                      </button>
                    </div>
                    <span className={`status-${appt.status} px-2 py-0.5 rounded-full text-[10px] font-medium`}>
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ARIA Chat Panel — hidden on mobile, visible on lg+ */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
            <AriaChat compact />
          </div>
        </div>
      </div>
    </div>
  );
}
