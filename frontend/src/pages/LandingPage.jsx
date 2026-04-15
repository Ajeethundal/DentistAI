import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Sparkles, MessageCircle, Phone, Calendar, BarChart3, ArrowRight, Check, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const FEATURES = [
  {
    icon: Phone,
    title: 'AI answers your phone',
    desc: 'ARIA handles inbound calls 24/7, books appointments, and follows up on no-shows. Your voice, trained on your practice.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp patient messaging',
    desc: 'Two-way WhatsApp for reminders, confirmations, and quick questions. Patients reply naturally; ARIA understands and responds.',
  },
  {
    icon: Calendar,
    title: 'Smart scheduling',
    desc: 'Conflict detection, automatic reminders, Google Calendar sync. One unified view across doctors and chairs.',
  },
  {
    icon: BarChart3,
    title: 'Analytics that matter',
    desc: 'No-show rates, revenue per chair, recall performance. Real metrics, not vanity dashboards.',
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 animate-pulse" />
      </div>
    );
  }

  // Logged-in users go straight to their dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0F5]">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#6C63FF]/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] bg-[#00D4AA]/8 rounded-full blur-[160px]" />
      </div>

      <div className="relative">
        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6C63FF] flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-['Outfit'] text-lg font-medium">DentistAI</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-[#8888A0] hover:text-[#F0F0F5] hidden sm:inline">Features</a>
            <Link to="/pricing" className="text-[#8888A0] hover:text-[#F0F0F5]">Pricing</Link>
            <Link to="/login" className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#F0F0F5] border border-[rgba(255,255,255,0.07)]">
              Sign in
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-xs text-[#6C63FF] mb-8">
            <Zap size={12} /> Live now — powered by ARIA
          </div>
          <h1 className="text-5xl md:text-7xl font-light font-['Outfit'] tracking-tight mb-6 leading-[1.05]">
            Your practice<br />
            <span className="text-[#6C63FF]">runs itself.</span>
          </h1>
          <p className="text-lg md:text-xl text-[#8888A0] max-w-2xl mx-auto mb-10">
            DentistAI answers the phone, messages patients on WhatsApp, books appointments, and chases no-shows — so your team can focus on what actually happens in the chair.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 bg-[#6C63FF] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#6C63FF]/90 shadow-[0_0_30px_rgba(108,99,255,0.3)] hover:shadow-[0_0_40px_rgba(108,99,255,0.5)] transition-all"
            >
              Start 14-day free trial <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white/5 text-[#F0F0F5] px-6 py-3 rounded-lg font-medium hover:bg-white/10 border border-[rgba(255,255,255,0.07)]"
            >
              Try the demo
            </Link>
          </div>
          <div className="mt-8 text-xs text-[#8888A0] inline-flex items-center gap-2 justify-center">
            <Check size={12} className="text-[#00D4AA]" /> No credit card required
            <span className="text-[#333344]">•</span>
            <Check size={12} className="text-[#00D4AA]" /> Cancel anytime
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-light font-['Outfit'] mb-4">
              Everything your front desk does.<br />
              <span className="text-[#8888A0]">Without the front desk.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 hover:border-[#6C63FF]/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center mb-5">
                  <Icon size={18} className="text-[#6C63FF]" />
                </div>
                <h3 className="text-xl font-medium font-['Outfit'] mb-2">{title}</h3>
                <p className="text-[#8888A0] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-light font-['Outfit'] mb-4">
            Ready to reclaim your time?
          </h2>
          <p className="text-[#8888A0] mb-8">
            Set up in under 10 minutes. Start free for 14 days.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 bg-[#6C63FF] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#6C63FF]/90 shadow-[0_0_30px_rgba(108,99,255,0.3)]"
          >
            Start free trial <ArrowRight size={16} />
          </Link>
        </section>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-[rgba(255,255,255,0.07)] flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#8888A0]">
          <div className="inline-flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#6C63FF] flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span>DentistAI © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="hover:text-[#F0F0F5]">Pricing</Link>
            <Link to="/login" className="hover:text-[#F0F0F5]">Sign in</Link>
            <a href="mailto:hello@dentistai.com" className="hover:text-[#F0F0F5]">Contact</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
