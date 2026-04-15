import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, Sparkles, Loader2, ArrowLeft, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { openCheckout } from '@/lib/paddle';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({ demo_mode: false });

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [plansRes, cfgRes] = await Promise.all([
          axios.get(`${API}/api/paddle/plans`),
          axios.get(`${API}/api/paddle/config`).catch(() => ({ data: {} })),
        ]);
        if (!cancel) {
          setPlans(plansRes.data.plans || []);
          setConfig(cfgRes.data || {});
        }
      } catch (e) {
        if (!cancel) setError('Could not load pricing. Please try again.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    // Listen for paddle checkout events
    const handler = (e) => {
      const ev = e.detail;
      if (ev?.name === 'checkout.completed') {
        navigate('/billing?welcome=1');
      }
    };
    window.addEventListener('paddle:event', handler);
    return () => window.removeEventListener('paddle:event', handler);
  }, [navigate]);

  const onSubscribe = async (plan) => {
    setError('');
    if (!user) {
      navigate(`/login?next=/pricing&plan=${plan.slug}`);
      return;
    }
    setBusy(plan.slug);
    try {
      // In DEMO_MODE, or when no Paddle client token is configured, activate
      // instantly via the demo endpoint. This lets prospects experience the
      // paid feature set without real payment.
      if (config.demo_mode || !plan.configured || !plan.price_id) {
        const token = localStorage.getItem('token');
        await axios.post(
          `${API}/api/paddle/demo-activate`,
          { plan: plan.slug },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        navigate('/billing?welcome=1');
        return;
      }
      await openCheckout({
        priceId: plan.price_id,
        customer: { email: user.email },
        customData: {
          practice_id: user.practice_id,
          user_id: user.id || user._id || '',
          plan: plan.slug,
        },
      });
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Subscription failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0F5]">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6C63FF]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00D4AA]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-16">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-[#8888A0] hover:text-[#F0F0F5] transition-colors text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6C63FF] flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-['Outfit'] text-lg">DentistAI</span>
          </div>
          {user ? (
            <Link to="/dashboard" className="text-sm text-[#8888A0] hover:text-[#F0F0F5]">Dashboard →</Link>
          ) : (
            <Link to="/login" className="text-sm text-[#8888A0] hover:text-[#F0F0F5]">Sign in</Link>
          )}
        </div>

        {/* Heading */}
        <div className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-4">
            Simple pricing that scales with your practice
          </h1>
          <p className="text-lg text-[#8888A0] max-w-2xl mx-auto">
            Start free for 14 days. Cancel anytime. No credit card required to try.
          </p>
          {config.demo_mode && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-xs text-[#6C63FF]">
              <Zap size={12} /> Demo mode active — all plans activate instantly without payment
            </div>
          )}
        </div>

        {error && (
          <div className="mb-8 max-w-2xl mx-auto px-4 py-3 rounded-lg bg-[#FF5B6A]/10 border border-[#FF5B6A]/20 text-sm text-[#FF5B6A]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#6C63FF]" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                data-testid={`plan-${plan.slug}`}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.popular
                    ? 'bg-gradient-to-b from-[#6C63FF]/10 to-transparent border-2 border-[#6C63FF]/50 shadow-[0_0_60px_rgba(108,99,255,0.15)]'
                    : 'bg-[#111118] border border-[rgba(255,255,255,0.07)]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#6C63FF] text-white text-xs font-medium uppercase tracking-wider">
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-medium font-['Outfit'] mb-2">{plan.name}</h3>
                  <p className="text-sm text-[#8888A0]">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-5xl font-light font-['Outfit']">{plan.price_display}</span>
                  <span className="text-[#8888A0] text-sm ml-2">/ {plan.interval}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
                        <Check size={10} className="text-[#00D4AA]" strokeWidth={3} />
                      </div>
                      <span className="text-[#C0C0CF]">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  data-testid={`subscribe-${plan.slug}`}
                  onClick={() => onSubscribe(plan)}
                  disabled={busy === plan.slug || !plan.configured}
                  className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
                    plan.popular
                      ? 'bg-[#6C63FF] text-white hover:bg-[#6C63FF]/90 shadow-[0_0_20px_rgba(108,99,255,0.3)] hover:shadow-[0_0_30px_rgba(108,99,255,0.5)]'
                      : 'bg-white/5 text-[#F0F0F5] hover:bg-white/10 border border-[rgba(255,255,255,0.07)]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {busy === plan.slug ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Opening checkout…
                    </span>
                  ) : !plan.configured ? (
                    'Coming soon'
                  ) : (
                    plan.cta || 'Subscribe'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-14 text-sm text-[#8888A0]">
          Need a custom quote?{' '}
          <a href="mailto:sales@dentistai.com" className="text-[#6C63FF] hover:underline">
            Talk to sales
          </a>
          .
        </div>
      </div>
    </div>
  );
}
