import React, { useState, useEffect, useRef } from 'react';
import { useApi, useAuth } from '@/context/AuthContext';
import AriaChat from '@/components/AriaChat';
import { Phone, Calendar, MessageSquare, TrendingDown, TrendingUp, Clock, Activity, Wifi } from 'lucide-react';

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

export default function DashboardPage() {
  const api = useApi();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);

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
      } catch (err) { console.error('Dashboard load error:', err); }
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
    { label: 'Calls Today', value: stats.calls_today, change: stats.calls_today - stats.calls_yesterday, icon: Phone, color: '#00D4AA' },
    { label: 'Appointments This Week', value: stats.appointments_week, change: null, icon: Calendar, color: '#6C63FF' },
    { label: 'WhatsApp Messages', value: stats.messages_sent, change: null, icon: MessageSquare, color: '#FFB347' },
    { label: 'No-Show Rate', value: stats.no_show_rate, suffix: '%', isRate: true, icon: TrendingDown, color: stats.no_show_rate > 10 ? '#FF5B6A' : '#00D4AA' },
  ] : [];

  const apptStatusColors = {
    confirmed: 'border-l-[#00D4AA] bg-[#00D4AA]/5',
    pending: 'border-l-[#FFB347] bg-[#FFB347]/5',
    completed: 'border-l-[#8888A0] bg-[#8888A0]/5',
    cancelled: 'border-l-[#FF5B6A] bg-[#FF5B6A]/5',
    noshow: 'border-l-[#FFB347] bg-[#FFB347]/5',
  };

  return (
    <div data-testid="dashboard-page" className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
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
          </div>
        ))}
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
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto chat-scroll" data-testid="activity-feed">
              {feed.map((item, i) => {
                const Icon = typeIcons[item.type] || Activity;
                const color = typeColors[item.type] || '#8888A0';
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#0A0A0F]/50 hover:bg-[#0A0A0F] transition-all animate-slide-up"
                    style={{ animationDelay: `${i * 50}ms` }}
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
                  </div>
                );
              })}
            </div>
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
            <div className="p-4 space-y-2" data-testid="today-schedule">
              {todaySchedule.length === 0 && (
                <p className="text-sm text-[#8888A0] text-center py-4">No appointments today</p>
              )}
              {todaySchedule.map((appt, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-3 rounded-lg border-l-2 ${apptStatusColors[appt.status] || 'border-l-[#8888A0]'} transition-all hover:translate-x-1`}
                >
                  <span className="text-sm font-medium text-[#F0F0F5] font-['JetBrains_Mono'] w-14">{appt.time}</span>
                  <div className="flex-1">
                    <p className="text-sm text-[#F0F0F5]">{appt.patient_name}</p>
                    <p className="text-xs text-[#8888A0]">{appt.treatment_type}</p>
                  </div>
                  <span className={`status-${appt.status} px-2 py-0.5 rounded-full text-[10px] font-medium`}>
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ARIA Chat Panel */}
        <div className="lg:col-span-2">
          <AriaChat compact />
        </div>
      </div>
    </div>
  );
}
