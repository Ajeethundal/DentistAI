import React, { useState, useEffect } from 'react';
import { useApi } from '@/context/AuthContext';
import { Phone, MessageSquare, X, AlertTriangle, Clock, Users, Sparkles } from 'lucide-react';

export default function FollowUpsPage() {
  const api = useApi();
  const [data, setData] = useState({ no_shows: [], overdue_recalls: [], pending_confirmations: [] });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const { data: res } = await api.get('/follow-ups');
      setData(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleAction = async (action, patientId, appointmentId) => {
    try {
      await api.post('/follow-ups/action', { action, patient_id: patientId, appointment_id: appointmentId });
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleAriaAll = async () => {
    for (const ns of data.no_shows) {
      await handleAction('call', ns.patient_id || ns.id, ns.id);
    }
    for (const pc of data.pending_confirmations) {
      await handleAction('whatsapp', pc.patient_id || pc.id, pc.id);
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div data-testid="follow-ups-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">Follow-ups</h1>
          <p className="text-sm text-[#8888A0]">Manage no-shows, overdue recalls, and pending confirmations</p>
        </div>
        <button
          data-testid="aria-handle-all-btn"
          onClick={handleAriaAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#6C63FF]/90 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]"
        >
          <Sparkles size={16} /> Let ARIA Handle All
        </button>
      </div>

      {/* No-Shows */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl">
        <div className="flex items-center gap-2 p-4 border-b border-[rgba(255,255,255,0.07)]">
          <AlertTriangle size={16} className="text-[#FFB347]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">No-Shows This Week</h2>
          <span className="ml-auto text-xs text-[#8888A0]">{data.no_shows.length} patients</span>
        </div>
        <div className="p-4 space-y-3" data-testid="no-shows-list">
          {data.no_shows.length === 0 && <p className="text-sm text-[#8888A0] text-center py-4">No no-shows this week</p>}
          {data.no_shows.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#0A0A0F]/50 hover:bg-[#0A0A0F] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#FFB347]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-[#FFB347]">{getInitials(item.patient_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F0F0F5]">{item.patient_name}</p>
                <p className="text-xs text-[#8888A0]">{item.date} · {item.treatment_type}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAction('call', item.patient_id, item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA]/10 text-[#00D4AA] text-xs font-medium hover:bg-[#00D4AA]/20 transition-all"
                >
                  <Phone size={12} /> Call
                </button>
                <button
                  onClick={() => handleAction('whatsapp', item.patient_id, item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium hover:bg-[#6C63FF]/20 transition-all"
                >
                  <MessageSquare size={12} /> WhatsApp
                </button>
                <button
                  onClick={() => handleAction('dismiss', item.patient_id, item.id)}
                  className="p-1.5 rounded-lg text-[#8888A0] hover:text-[#FF5B6A] hover:bg-[#FF5B6A]/10 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue Recalls */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl">
        <div className="flex items-center gap-2 p-4 border-b border-[rgba(255,255,255,0.07)]">
          <Clock size={16} className="text-[#8888A0]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Overdue Recalls</h2>
          <span className="ml-auto text-xs text-[#8888A0]">{data.overdue_recalls.length} patients</span>
        </div>
        <div className="p-4 space-y-3" data-testid="overdue-recalls-list">
          {data.overdue_recalls.length === 0 && <p className="text-sm text-[#8888A0] text-center py-4">No overdue recalls</p>}
          {data.overdue_recalls.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#0A0A0F]/50 hover:bg-[#0A0A0F] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#8888A0]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-[#8888A0]">{getInitials(item.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F0F0F5]">{item.name}</p>
                <p className="text-xs text-[#8888A0]">Last visit: {item.last_appointment?.date || 'Unknown'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAction('call', item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA]/10 text-[#00D4AA] text-xs font-medium hover:bg-[#00D4AA]/20 transition-all"
                >
                  <Phone size={12} /> Call
                </button>
                <button
                  onClick={() => handleAction('whatsapp', item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium hover:bg-[#6C63FF]/20 transition-all"
                >
                  <MessageSquare size={12} /> WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Confirmations */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl">
        <div className="flex items-center gap-2 p-4 border-b border-[rgba(255,255,255,0.07)]">
          <Users size={16} className="text-[#6C63FF]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Pending Confirmations</h2>
          <span className="ml-auto text-xs text-[#8888A0]">{data.pending_confirmations.length} appointments</span>
        </div>
        <div className="p-4 space-y-3" data-testid="pending-confirmations-list">
          {data.pending_confirmations.length === 0 && <p className="text-sm text-[#8888A0] text-center py-4">No pending confirmations</p>}
          {data.pending_confirmations.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#0A0A0F]/50 hover:bg-[#0A0A0F] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-[#6C63FF]">{getInitials(item.patient_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F0F0F5]">{item.patient_name}</p>
                <p className="text-xs text-[#8888A0]">{item.date} at {item.time} · {item.treatment_type}</p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium hover:bg-[#6C63FF]/20 transition-all">
                <MessageSquare size={12} /> Send Reminder
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
