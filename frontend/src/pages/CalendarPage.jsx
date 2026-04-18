import React, { useState, useEffect } from 'react';
import { useApi } from '@/context/AuthContext';
import { ChevronLeft, ChevronRight, Plus, X, Clock } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TREATMENTS = ['Cleaning', 'X-ray', 'Crown', 'Root Canal', 'Extraction', 'Consultation', 'Filling', 'Whitening', 'Other'];
const HOURS = Array.from({ length: 18 }, (_, i) => { const h = Math.floor(i / 2) + 8; const m = i % 2 === 0 ? '00' : '30'; return `${String(h).padStart(2, '0')}:${m}`; });

const statusColors = {
  confirmed: { bg: 'bg-[#00D4AA]/10', border: 'border-l-[#00D4AA]', text: 'text-[#00D4AA]' },
  pending: { bg: 'bg-[#FFB347]/10', border: 'border-l-[#FFB347]', text: 'text-[#FFB347]' },
  completed: { bg: 'bg-[#8888A0]/10', border: 'border-l-[#8888A0]', text: 'text-[#8888A0]' },
  cancelled: { bg: 'bg-[#FF5B6A]/10', border: 'border-l-[#FF5B6A]', text: 'text-[#FF5B6A]' },
  noshow: { bg: 'bg-[#FFB347]/10', border: 'border-l-[#FFB347]', text: 'text-[#FFB347]' },
};

function getWeekDays(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonthDays(date) {
  const year = date.getFullYear(), month = date.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  for (let i = 0; i < first.getDay(); i++) {
    const d = new Date(year, month, -first.getDay() + i + 1);
    days.push({ date: d, isCurrentMonth: false });
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  return days;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const api = useApi();
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ patient_name: '', patient_phone: '', date: '', time: '09:00', treatment_type: 'Cleaning', notes: '' });
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAppointments = async () => {
    try {
      const { data } = await api.get('/appointments');
      setAppointments(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAppointments(); }, []);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else if (view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/appointments', form);
      setShowAdd(false);
      setForm({ patient_name: '', patient_phone: '', date: '', time: '09:00', treatment_type: 'Cleaning', notes: '' });
      loadAppointments();
    } catch (err) { console.error(err); }
  };

  const getApptsForDate = (dateStr) => appointments.filter(a => a.date === dateStr);
  const today = formatDate(new Date());
  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-[#1A1A24] rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-[#1A1A24] rounded-lg animate-pulse" />
          <div className="h-9 w-20 bg-[#1A1A24] rounded-lg animate-pulse" />
          <div className="h-9 w-20 bg-[#1A1A24] rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
        <div className="grid grid-cols-7 gap-2 mb-3">
          {Array.from({length: 7}).map((_, i) => <div key={i} className="h-4 bg-[#1A1A24] rounded animate-pulse" />)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({length: 35}).map((_, i) => <div key={i} className="h-20 bg-[#1A1A24] rounded-lg animate-pulse" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div data-testid="calendar-page" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">Calendar</h1>
          <p className="text-sm text-[#8888A0]">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-[#111118] rounded-lg border border-[rgba(255,255,255,0.07)] p-0.5">
            {['month', 'week', 'day'].map(v => (
              <button
                key={v}
                data-testid={`calendar-view-${v}`}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v ? 'bg-[#6C63FF] text-white' : 'text-[#8888A0] hover:text-[#F0F0F5]'}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-[#8888A0] hover:text-[#F0F0F5] hover:bg-[rgba(255,255,255,0.05)]">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs text-[#8888A0] hover:text-[#F0F0F5]">Today</button>
            <button onClick={() => navigate(1)} className="p-2 rounded-lg text-[#8888A0] hover:text-[#F0F0F5] hover:bg-[rgba(255,255,255,0.05)]">
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            data-testid="add-appointment-btn"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#6C63FF]/90 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]"
          >
            <Plus size={16} /> New Appointment
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1">
          {view === 'month' && (
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.07)]">
                {DAYS.map(d => (
                  <div key={d} className="p-3 text-center text-xs font-medium text-[#8888A0] uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map(({ date: d, isCurrentMonth }, i) => {
                  const dateStr = formatDate(d);
                  const dayAppts = getApptsForDate(dateStr);
                  const isToday = dateStr === today;
                  return (
                    <div key={i} className={`min-h-[100px] p-2 border-b border-r border-[rgba(255,255,255,0.04)] ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                      <span className={`text-xs font-medium ${isToday ? 'bg-[#00D4AA] text-white px-1.5 py-0.5 rounded-full' : 'text-[#8888A0]'}`}>
                        {d.getDate()}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayAppts.slice(0, 3).map((a, j) => {
                          const sc = statusColors[a.status] || statusColors.confirmed;
                          return (
                            <div
                              key={j}
                              onClick={() => setSelectedAppt(a)}
                              className={`px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer ${sc.bg} ${sc.text} border-l-2 ${sc.border}`}
                            >
                              {a.time} {a.patient_name}
                            </div>
                          );
                        })}
                        {dayAppts.length > 3 && <span className="text-[10px] text-[#8888A0]">+{dayAppts.length - 3} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
              <div className="grid grid-cols-8 border-b border-[rgba(255,255,255,0.07)]">
                <div className="p-3" />
                {weekDays.map((d, i) => {
                  const dateStr = formatDate(d);
                  const isToday = dateStr === today;
                  return (
                    <div key={i} className="p-3 text-center border-l border-[rgba(255,255,255,0.04)]">
                      <p className="text-[10px] text-[#8888A0] uppercase">{DAYS[d.getDay()]}</p>
                      <p className={`text-lg font-medium mt-0.5 ${isToday ? 'text-[#00D4AA]' : 'text-[#F0F0F5]'}`}>{d.getDate()}</p>
                    </div>
                  );
                })}
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {HOURS.map((hour, hi) => (
                  <div key={hi} className="grid grid-cols-8 border-b border-[rgba(255,255,255,0.03)]">
                    <div className="p-2 text-right pr-3">
                      <span className="text-[10px] text-[#8888A0] font-['JetBrains_Mono']">{hour}</span>
                    </div>
                    {weekDays.map((d, di) => {
                      const dateStr = formatDate(d);
                      const dayAppts = getApptsForDate(dateStr).filter(a => a.time === hour);
                      return (
                        <div key={di} className="p-1 min-h-[40px] border-l border-[rgba(255,255,255,0.04)]">
                          {dayAppts.map((a, ai) => {
                            const sc = statusColors[a.status] || statusColors.confirmed;
                            return (
                              <div
                                key={ai}
                                onClick={() => setSelectedAppt(a)}
                                className={`px-2 py-1 rounded text-[10px] cursor-pointer ${sc.bg} border-l-2 ${sc.border} hover:-translate-y-0.5 transition-all`}
                              >
                                <p className={`font-medium truncate ${sc.text}`}>{a.patient_name}</p>
                                <p className="text-[#8888A0] truncate">{a.treatment_type}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'day' && (
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[rgba(255,255,255,0.07)]">
                <h3 className="text-sm font-medium text-[#F0F0F5]">
                  {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {HOURS.map((hour, hi) => {
                  const dayAppts = getApptsForDate(formatDate(currentDate)).filter(a => a.time === hour);
                  return (
                    <div key={hi} className="flex border-b border-[rgba(255,255,255,0.03)]">
                      <div className="w-20 p-3 text-right flex-shrink-0">
                        <span className="text-xs text-[#8888A0] font-['JetBrains_Mono']">{hour}</span>
                      </div>
                      <div className="flex-1 p-2 min-h-[50px] border-l border-[rgba(255,255,255,0.04)]">
                        {dayAppts.map((a, ai) => {
                          const sc = statusColors[a.status] || statusColors.confirmed;
                          return (
                            <div
                              key={ai}
                              onClick={() => setSelectedAppt(a)}
                              className={`px-3 py-2 rounded-lg cursor-pointer ${sc.bg} border-l-2 ${sc.border} mb-1`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-medium ${sc.text}`}>{a.patient_name}</span>
                                <span className="text-xs text-[#8888A0]">{a.duration_mins}min</span>
                              </div>
                              <p className="text-xs text-[#8888A0]">{a.treatment_type}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Appointment Detail or Quick Add */}
        {selectedAppt && (
          <div className="w-80 glass rounded-xl p-5 h-fit sticky top-20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Appointment Details</h3>
              <button onClick={() => setSelectedAppt(null)} className="text-[#8888A0] hover:text-[#F0F0F5]"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><p className="text-[10px] text-[#8888A0] uppercase tracking-wider">Patient</p><p className="text-sm text-[#F0F0F5]">{selectedAppt.patient_name}</p></div>
              <div><p className="text-[10px] text-[#8888A0] uppercase tracking-wider">Date & Time</p><p className="text-sm text-[#F0F0F5]">{selectedAppt.date} at {selectedAppt.time}</p></div>
              <div><p className="text-[10px] text-[#8888A0] uppercase tracking-wider">Treatment</p><p className="text-sm text-[#F0F0F5]">{selectedAppt.treatment_type}</p></div>
              <div><p className="text-[10px] text-[#8888A0] uppercase tracking-wider">Status</p>
                <span className={`status-${selectedAppt.status} px-2 py-0.5 rounded-full text-xs font-medium`}>{selectedAppt.status}</span>
              </div>
              {selectedAppt.patient_phone && (
                <div><p className="text-[10px] text-[#8888A0] uppercase tracking-wider">Phone</p><p className="text-sm text-[#F0F0F5]">{selectedAppt.patient_phone}</p></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-medium text-[#F0F0F5] font-['Outfit']">New Appointment</h3>
              <button onClick={() => setShowAdd(false)} className="text-[#8888A0] hover:text-[#F0F0F5]"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Patient Name</label>
                <input data-testid="appt-patient-name" value={form.patient_name} onChange={e => setForm({...form, patient_name: e.target.value})} required className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
              </div>
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Phone</label>
                <input data-testid="appt-phone" value={form.patient_phone} onChange={e => setForm({...form, patient_phone: e.target.value})} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Date</label>
                  <input data-testid="appt-date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
                </div>
                <div>
                  <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Time</label>
                  <select data-testid="appt-time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Treatment Type</label>
                <select data-testid="appt-treatment" value={form.treatment_type} onChange={e => setForm({...form, treatment_type: e.target.value})} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
                  {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Notes</label>
                <textarea data-testid="appt-notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF] resize-none" />
              </div>
              <button data-testid="appt-submit" type="submit" className="w-full bg-[#6C63FF] text-white py-2.5 rounded-lg font-medium text-sm hover:bg-[#6C63FF]/90 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]">
                Book Appointment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
