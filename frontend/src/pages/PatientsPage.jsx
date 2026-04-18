import React, { useState, useEffect } from 'react';
import { useApi } from '@/context/AuthContext';
import { Search, Plus, X, Phone, Mail, Calendar, MessageSquare, FileText, User } from 'lucide-react';

const statusColors = {
  active: 'bg-[#00D4AA]/15 text-[#00D4AA]',
  inactive: 'bg-[#8888A0]/15 text-[#8888A0]',
  new: 'bg-[#6C63FF]/15 text-[#6C63FF]',
};

export default function PatientsPage() {
  const api = useApi();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [loading, setLoading] = useState(true);

  const loadPatients = async () => {
    try {
      const { data } = await api.get('/patients', { params: search ? { search } : {} });
      setPatients(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPatients(); }, [search]);

  const loadPatientDetail = async (id) => {
    try {
      const { data } = await api.get(`/patients/${id}`);
      setPatientDetail(data);
      setSelectedPatient(id);
      setActiveTab('overview');
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/patients', form);
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', notes: '' });
      loadPatients();
    } catch (err) { console.error(err); }
  };

  const getInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 bg-[#1A1A24] rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-[#1A1A24] rounded-lg animate-pulse" />
      </div>
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl">
        {Array.from({length: 8}).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-[rgba(255,255,255,0.05)]">
            <div className="w-10 h-10 rounded-full bg-[#1A1A24] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-[#1A1A24] rounded animate-pulse" />
              <div className="h-3 w-24 bg-[#1A1A24] rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-[#1A1A24] rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div data-testid="patients-page" className="p-6 flex gap-6 h-[calc(100vh-40px)]">
      {/* Patient List */}
      <div className={`${selectedPatient ? 'w-3/5' : 'w-full'} flex flex-col transition-all`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">Patients</h1>
            <p className="text-sm text-[#8888A0]">{patients.length} patients</p>
          </div>
          <button
            data-testid="add-patient-btn"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#6C63FF]/90 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]"
          >
            <Plus size={16} /> Add Patient
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888A0]" />
          <input
            data-testid="patient-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full bg-[#111118] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#6C63FF] transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.07)]">
                <th className="text-left px-4 py-3 text-[10px] text-[#8888A0] uppercase tracking-wider font-medium">Patient</th>
                <th className="text-left px-4 py-3 text-[10px] text-[#8888A0] uppercase tracking-wider font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-[10px] text-[#8888A0] uppercase tracking-wider font-medium">Last Visit</th>
                <th className="text-left px-4 py-3 text-[10px] text-[#8888A0] uppercase tracking-wider font-medium">Next Appt</th>
                <th className="text-left px-4 py-3 text-[10px] text-[#8888A0] uppercase tracking-wider font-medium">Visits</th>
                <th className="text-left px-4 py-3 text-[10px] text-[#8888A0] uppercase tracking-wider font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  data-testid={`patient-row-${p.id}`}
                  onClick={() => loadPatientDetail(p.id)}
                  className={`border-b border-[rgba(255,255,255,0.04)] cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.03)] ${selectedPatient === p.id ? 'bg-[#6C63FF]/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#6C63FF]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-[#6C63FF]">{getInitials(p.name)}</span>
                      </div>
                      <span className="text-sm text-[#F0F0F5]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8888A0]">{p.phone}</td>
                  <td className="px-4 py-3 text-sm text-[#8888A0]">{p.last_visit || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#8888A0]">{p.next_appointment || 'None'}</td>
                  <td className="px-4 py-3 text-sm text-[#8888A0]">{p.total_visits}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[p.status] || statusColors.active}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail Drawer */}
      {selectedPatient && patientDetail && (
        <div data-testid="patient-detail-drawer" className="w-2/5 glass rounded-xl overflow-hidden flex flex-col animate-fade-in">
          {/* Header */}
          <div className="p-5 border-b border-[rgba(255,255,255,0.07)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#6C63FF]/15 flex items-center justify-center">
                  <span className="text-lg font-medium text-[#6C63FF]">{getInitials(patientDetail.name)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-[#F0F0F5] font-['Outfit']">{patientDetail.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[patientDetail.status]}`}>{patientDetail.status}</span>
                </div>
              </div>
              <button data-testid="close-patient-drawer" onClick={() => { setSelectedPatient(null); setPatientDetail(null); }} className="text-[#8888A0] hover:text-[#F0F0F5]"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-xs text-[#8888A0]"><Phone size={12} />{patientDetail.phone}</div>
              <div className="flex items-center gap-2 text-xs text-[#8888A0]"><Mail size={12} />{patientDetail.email || '—'}</div>
              <div className="flex items-center gap-2 text-xs text-[#8888A0]"><Calendar size={12} />{patientDetail.total_visits} visits</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[rgba(255,255,255,0.07)]">
            {['overview', 'appointments', 'calls', 'whatsapp', 'notes'].map(tab => (
              <button
                key={tab}
                data-testid={`patient-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-medium transition-all ${activeTab === tab ? 'text-[#6C63FF] border-b-2 border-[#6C63FF]' : 'text-[#8888A0] hover:text-[#F0F0F5]'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 chat-scroll">
            {activeTab === 'overview' && (
              <>
                <h4 className="text-xs text-[#8888A0] uppercase tracking-wider mb-2">Recent Appointments</h4>
                {(patientDetail.appointments || []).slice(0, 3).map((a, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[#0A0A0F]/50 flex items-center justify-between">
                    <div><p className="text-sm text-[#F0F0F5]">{a.treatment_type}</p><p className="text-xs text-[#8888A0]">{a.date} at {a.time}</p></div>
                    <span className={`status-${a.status} px-2 py-0.5 rounded-full text-[10px] font-medium`}>{a.status}</span>
                  </div>
                ))}
                {patientDetail.notes && (
                  <>
                    <h4 className="text-xs text-[#8888A0] uppercase tracking-wider mt-4 mb-2">Notes</h4>
                    <p className="text-sm text-[#F0F0F5] p-3 rounded-lg bg-[#0A0A0F]/50">{patientDetail.notes}</p>
                  </>
                )}
              </>
            )}
            {activeTab === 'appointments' && (patientDetail.appointments || []).map((a, i) => (
              <div key={i} className="p-3 rounded-lg bg-[#0A0A0F]/50 flex items-center justify-between">
                <div><p className="text-sm text-[#F0F0F5]">{a.treatment_type}</p><p className="text-xs text-[#8888A0]">{a.date} at {a.time}</p></div>
                <span className={`status-${a.status} px-2 py-0.5 rounded-full text-[10px] font-medium`}>{a.status}</span>
              </div>
            ))}
            {activeTab === 'calls' && (patientDetail.calls || []).map((c, i) => (
              <div key={i} className="p-3 rounded-lg bg-[#0A0A0F]/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className={c.direction === 'inbound' ? 'text-[#00D4AA]' : 'text-[#6C63FF]'} />
                    <span className="text-xs text-[#8888A0]">{c.direction} · {Math.floor(c.duration_secs / 60)}min</span>
                  </div>
                  <span className="text-xs text-[#8888A0]">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.outcome === 'booked' ? 'bg-[#00D4AA]/15 text-[#00D4AA]' : 'bg-[#8888A0]/15 text-[#8888A0]'}`}>{c.outcome}</span>
              </div>
            ))}
            {activeTab === 'whatsapp' && (
              <div className="space-y-2">
                {(patientDetail.messages || []).map((m, i) => (
                  <div key={i} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.direction === 'outbound' ? (m.sender === 'aria' ? 'bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-tr-sm' : 'bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-tr-sm') : 'bg-[#0A0A0F] rounded-tl-sm'}`}>
                      <p className="text-[#F0F0F5]">{m.body}</p>
                      <p className="text-[10px] text-[#8888A0] mt-1">{m.sender} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'notes' && (
              <div className="p-3 rounded-lg bg-[#0A0A0F]/50">
                <p className="text-sm text-[#F0F0F5]">{patientDetail.notes || 'No notes yet.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-medium text-[#F0F0F5] font-['Outfit']">Add Patient</h3>
              <button onClick={() => setShowAdd(false)} className="text-[#8888A0] hover:text-[#F0F0F5]"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Name</label>
                <input data-testid="new-patient-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
              </div>
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Phone</label>
                <input data-testid="new-patient-phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
              </div>
              <div>
                <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Email</label>
                <input data-testid="new-patient-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
              </div>
              <button data-testid="new-patient-submit" type="submit" className="w-full bg-[#6C63FF] text-white py-2.5 rounded-lg font-medium text-sm hover:bg-[#6C63FF]/90 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]">
                Add Patient
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
