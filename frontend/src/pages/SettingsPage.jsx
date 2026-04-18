import React, { useState, useEffect } from 'react';
import { useApi } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Save, Building2, User, Sparkles, Clock, Globe, Phone, MessageSquare, Calendar, CreditCard, Check, X, ExternalLink, Loader2, Zap } from 'lucide-react';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export default function SettingsPage() {
  const api = useApi();
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [integrations, setIntegrations] = useState(null);
  const [plans, setPlans] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null);
  const [googleMsg, setGoogleMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, intRes, plansRes] = await Promise.all([
          api.get('/settings'),
          api.get('/integrations/status'),
          api.get('/paddle/plans')
        ]);
        setSettings(settingsRes.data);
        setIntegrations(intRes.data);
        setPlans(plansRes.data.plans);
      } catch (err) { console.error(err); }
    };
    load();

    // Check for Google callback
    if (searchParams.get('google_connected') === 'true') {
      setGoogleMsg('Google Calendar connected successfully!');
    } else if (searchParams.get('google_error')) {
      setGoogleMsg(`Google Calendar error: ${searchParams.get('google_error')}`);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        practice_name: settings.name, doctor_name: settings.doctor_name,
        phone: settings.phone, address: settings.address,
        office_hours: settings.office_hours, aria_voice: settings.aria_voice,
        aria_language: settings.aria_language, aria_tone: settings.aria_tone,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const connectGoogle = async () => {
    try {
      const { data } = await api.get('/google/auth-url');
      if (data.url) window.location.href = data.url;
      else setGoogleMsg(data.message);
    } catch (err) { console.error(err); }
  };

  const syncGoogle = async () => {
    try {
      const { data } = await api.post('/google/sync');
      setGoogleMsg(data.status === 'success' ? `Synced ${data.synced} events!` : data.message);
    } catch (err) { setGoogleMsg('Sync failed'); }
  };

  const handleCheckout = (planSlug) => {
    window.location.href = '/pricing';
  };

  const checkRetell = async () => {
    try {
      const { data } = await api.get('/retell/status');
      setGoogleMsg(data.connected ? `Retell AI: ${data.message}` : `Retell AI: ${data.message}`);
    } catch (err) { setGoogleMsg('Failed to check Retell AI status'); }
  };

  const checkTwilio = async () => {
    try {
      const { data } = await api.get('/twilio/status');
      setGoogleMsg(data.connected ? `Twilio: ${data.message}` : `Twilio: ${data.message}`);
    } catch (err) { setGoogleMsg('Failed to check Twilio status'); }
  };

  if (!settings) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 aria-orb" />
    </div>
  );

  const updateField = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const updateHours = (day, value) => setSettings(prev => ({ ...prev, office_hours: { ...prev.office_hours, [day]: value } }));

  const currentPlan = integrations?.subscription?.plan || 'free';

  return (
    <div data-testid="settings-page" className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#F0F0F5] font-['Outfit']">Settings</h1>
          <p className="text-sm text-[#8888A0]">Manage your practice, integrations, and billing</p>
        </div>
        <button data-testid="save-settings-btn" onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-[#00D4AA] text-white' : 'bg-[#6C63FF] text-white hover:bg-[#6C63FF]/90'} shadow-[0_0_15px_rgba(108,99,255,0.3)]`}>
          <Save size={16} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Status Message */}
      {googleMsg && (
        <div className="p-3 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-sm text-[#6C63FF] flex items-center justify-between">
          <span>{googleMsg}</span>
          <button onClick={() => setGoogleMsg('')} className="text-[#6C63FF] hover:text-white"><X size={14} /></button>
        </div>
      )}

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
            <select value={settings.aria_voice || 'professional'} onChange={e => updateField('aria_voice', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
              <option value="professional">Professional</option>
              <option value="warm">Warm & Friendly</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Language</label>
            <select value={settings.aria_language || 'English'} onChange={e => updateField('aria_language', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
              <option value="English">English</option><option value="Spanish">Spanish</option><option value="Hindi">Hindi</option><option value="French">French</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8888A0] mb-1 uppercase tracking-wider">Tone</label>
            <select value={settings.aria_tone || 'warm'} onChange={e => updateField('aria_tone', e.target.value)} className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6C63FF]">
              <option value="professional">Professional</option><option value="warm">Warm</option><option value="casual">Casual</option>
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
              <input value={settings.office_hours?.[day] || 'closed'} onChange={e => updateHours(day, e.target.value)} className="flex-1 bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6C63FF]" placeholder="e.g., 9:00-17:00 or closed" />
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe size={18} className="text-[#8888A0]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Integrations</h2>
        </div>
        <div className="space-y-4">
          {/* Retell AI */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00D4AA]/10 flex items-center justify-center">
                <Phone size={18} className="text-[#00D4AA]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">Retell AI — Voice Calls</p>
                <p className="text-xs text-[#8888A0]">AI-powered inbound & outbound phone calls</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {integrations?.retell?.configured ? (
                <span className="flex items-center gap-1 text-xs text-[#00D4AA]"><Check size={12} /> Configured</span>
              ) : (
                <span className="text-xs text-[#8888A0]">Not configured</span>
              )}
              <button data-testid="check-retell-btn" onClick={checkRetell} className="px-3 py-1.5 rounded-lg bg-[#111118] border border-[rgba(255,255,255,0.07)] text-xs text-[#8888A0] hover:text-[#F0F0F5] transition-all">
                Test
              </button>
            </div>
          </div>

          {/* Twilio WhatsApp */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
                <MessageSquare size={18} className="text-[#6C63FF]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">Twilio — WhatsApp Business</p>
                <p className="text-xs text-[#8888A0]">Send and receive WhatsApp messages</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {integrations?.twilio?.configured ? (
                <span className="flex items-center gap-1 text-xs text-[#00D4AA]"><Check size={12} /> Configured</span>
              ) : (
                <span className="text-xs text-[#FFB347]">Needs Account SID</span>
              )}
              <button data-testid="check-twilio-btn" onClick={checkTwilio} className="px-3 py-1.5 rounded-lg bg-[#111118] border border-[rgba(255,255,255,0.07)] text-xs text-[#8888A0] hover:text-[#F0F0F5] transition-all">
                Test
              </button>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFB347]/10 flex items-center justify-center">
                <Calendar size={18} className="text-[#FFB347]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">Google Calendar</p>
                <p className="text-xs text-[#8888A0]">Bidirectional appointment sync</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {integrations?.google_calendar?.connected ? (
                <>
                  <span className="flex items-center gap-1 text-xs text-[#00D4AA]"><Check size={12} /> Connected</span>
                  <button data-testid="sync-google-btn" onClick={syncGoogle} className="px-3 py-1.5 rounded-lg bg-[#FFB347]/10 text-[#FFB347] text-xs hover:bg-[#FFB347]/20 transition-all">
                    Sync Now
                  </button>
                </>
              ) : (
                <button data-testid="connect-google-btn" onClick={connectGoogle} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6C63FF] text-white text-xs hover:bg-[#6C63FF]/90 transition-all">
                  <ExternalLink size={12} /> Connect
                </button>
              )}
            </div>
          </div>

          {/* Paddle Billing */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
                <CreditCard size={18} className="text-[#6C63FF]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">Paddle — Billing</p>
                <p className="text-xs text-[#8888A0]">Subscription management & payments ({integrations?.paddle?.environment || 'sandbox'})</p>
              </div>
            </div>
            {integrations?.paddle?.configured ? (
              <span className="flex items-center gap-1 text-xs text-[#00D4AA]"><Check size={12} /> Configured</span>
            ) : (
              <span className="text-xs text-[#8888A0]">Not configured</span>
            )}
          </div>

          {/* Anthropic (ARIA AI) */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center">
                <Sparkles size={18} className="text-[#6C63FF]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">Anthropic Claude — ARIA Brain</p>
                <p className="text-xs text-[#8888A0]">Powers ARIA's intelligent responses</p>
              </div>
            </div>
            {integrations?.anthropic?.configured ? (
              <span className="flex items-center gap-1 text-xs text-[#00D4AA]"><Check size={12} /> Connected</span>
            ) : (
              <span className="text-xs text-[#FFB347]">API key needed</span>
            )}
          </div>

          {/* SendGrid */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#0A0A0F]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFB347]/10 flex items-center justify-center">
                <Globe size={18} className="text-[#FFB347]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F0F5]">SendGrid — Email</p>
                <p className="text-xs text-[#8888A0]">Patient emails & notifications</p>
              </div>
            </div>
            {integrations?.sendgrid?.configured ? (
              <span className="flex items-center gap-1 text-xs text-[#00D4AA]"><Check size={12} /> Configured</span>
            ) : (
              <span className="text-xs text-[#8888A0]">Not configured</span>
            )}
          </div>
        </div>
      </div>

      {/* Billing / Subscription */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-[#6C63FF]" />
          <h2 className="text-sm font-semibold text-[#F0F0F5] font-['Outfit']">Subscription</h2>
          {currentPlan !== 'free' && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00D4AA]/15 text-[#00D4AA]">{currentPlan} plan active</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans && plans.map((plan) => (
            <div key={plan.slug} className={`p-5 rounded-xl border transition-all ${currentPlan === plan.slug ? 'border-[#6C63FF] bg-[#6C63FF]/5' : 'border-[rgba(255,255,255,0.07)] hover:border-[#6C63FF]/30'}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-[#F0F0F5] font-['Outfit']">{plan.name}</h3>
                {plan.popular && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#6C63FF]/15 text-[#6C63FF]">Popular</span>}
              </div>
              <div className="flex items-end gap-1 my-3">
                <span className="text-3xl font-light text-[#F0F0F5] font-['Outfit']">{plan.price_display}</span>
                <span className="text-sm text-[#8888A0] mb-1">/{plan.interval}</span>
              </div>
              <ul className="space-y-2 mb-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-[#8888A0]">
                    <Check size={12} className="text-[#00D4AA] flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {currentPlan === plan.slug ? (
                <button disabled className="w-full py-2 rounded-lg bg-[#00D4AA]/10 text-[#00D4AA] text-xs font-medium">Current Plan</button>
              ) : (
                <button
                  data-testid={`subscribe-${plan.slug}`}
                  onClick={() => handleCheckout(plan.slug)}
                  className="w-full py-2 rounded-lg bg-[#6C63FF] text-white text-xs font-medium hover:bg-[#6C63FF]/90 transition-all"
                >
                  {plan.cta || 'Subscribe'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
