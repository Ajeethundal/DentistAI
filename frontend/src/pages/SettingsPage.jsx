import React, { useState, useEffect } from 'react';
import { useApi } from '@/context/AuthContext';
import { Save, Building2, User, Sparkles, Clock, Globe } from 'lucide-react';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export default function SettingsPage() {
  const api = useApi();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/settings');
        setSettings(data);
      } catch (err) { console.error(err); }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        practice_name: settings.name,
        doctor_name: settings.doctor_name,
        phone: settings.phone,
        address: settings.address,
        office_hours: settings.office_hours,
        aria_voice: settings.aria_voice,
        aria_language: settings.aria_language,
        aria_tone: settings.aria_tone,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (!settings) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 aria-orb" />
    </div>
  );

  const updateField = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const updateHours = (day, value) => setSettings(prev => ({ ...prev, office_hours: { ...prev.office_hours, [day]: value } }));

  return (
    <div data-testid="settings-page" className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">Settings</h1>
          <p className="text-sm text-[#8888A0]">Manage your practice and ARIA configuration</p>
        </div>
        <button
          data-testid="save-settings-btn"
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved ? 'bg-[#00D4AA] text-white' : 'bg-[#6C63FF] text-white hover:bg-[#6C63FF]/90'
          } shadow-[0_0_15px_rgba(108,99,255,0.3)]`}
        >
          <Save size={16} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Practice Info */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 size={18} className="text-[#6C63FF]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Practice Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Practice Name</label>
            <input data-testid="settings-practice-name" value={settings.name || ''} onChange={e => updateField('name', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
          </div>
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Phone</label>
            <input data-testid="settings-phone" value={settings.phone || ''} onChange={e => updateField('phone', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Address</label>
            <input data-testid="settings-address" value={settings.address || ''} onChange={e => updateField('address', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
          </div>
        </div>
      </div>

      {/* Doctor Info */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={18} className="text-[#00D4AA]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Doctor Information</h2>
        </div>
        <div>
          <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Doctor Name</label>
          <input data-testid="settings-doctor-name" value={settings.doctor_name || ''} onChange={e => updateField('doctor_name', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]" />
        </div>
      </div>

      {/* ARIA Settings */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={18} className="text-[#6C63FF]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">ARIA Personality</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Voice</label>
            <select data-testid="settings-aria-voice" value={settings.aria_voice || 'professional'} onChange={e => updateField('aria_voice', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
              <option value="professional">Professional</option>
              <option value="warm">Warm & Friendly</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Language</label>
            <select data-testid="settings-aria-language" value={settings.aria_language || 'English'} onChange={e => updateField('aria_language', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="Hindi">Hindi</option>
              <option value="French">French</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Tone</label>
            <select data-testid="settings-aria-tone" value={settings.aria_tone || 'warm'} onChange={e => updateField('aria_tone', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
              <option value="professional">Professional</option>
              <option value="warm">Warm</option>
              <option value="casual">Casual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Office Hours */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={18} className="text-[#FFB347]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Office Hours</h2>
        </div>
        <div className="space-y-3">
          {DAYS.map(day => (
            <div key={day} className="flex items-center gap-4">
              <span className="text-sm text-[#8888A0] w-24">{DAY_LABELS[day]}</span>
              <input
                data-testid={`hours-${day}`}
                value={settings.office_hours?.[day] || 'closed'}
                onChange={e => updateHours(day, e.target.value)}
                className="flex-1 bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6C63FF]"
                placeholder="e.g., 9:00-17:00 or closed"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Integrations (Demo) */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe size={18} className="text-[#8888A0]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Integrations</h2>
          <span className="text-[10px] bg-[#FFB347]/15 text-[#FFB347] px-2 py-0.5 rounded-full">Demo Mode</span>
        </div>
        <div className="space-y-4">
          {[
            { name: 'Google Calendar', desc: 'Sync appointments with Google Calendar', status: 'Not connected' },
            { name: 'Twilio WhatsApp', desc: 'Send and receive WhatsApp messages', status: 'Not connected' },
            { name: 'Retell AI', desc: 'AI-powered phone call handling', status: 'Not connected' },
          ].map((int, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">{int.name}</p>
                <p className="text-xs text-[#8888A0]">{int.desc}</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-[#111118] border border-[rgba(255,255,255,0.07)] text-xs text-[#8888A0] hover:text-[#F0F0F5] transition-all">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
