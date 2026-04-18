import React, { useState, useRef, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Sparkles, MessageCircle, Phone, Calendar, BarChart3, ArrowRight, Check, Zap,
  ChevronDown, Clock, TrendingUp, Users, Shield, Star, Play, Headphones,
  Activity, Globe, Mail, Twitter, Linkedin, Github
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

/* ─── Animated counter hook ─── */
function useCountUp(target, duration = 2000, inView) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);
  return count;
}

/* ─── 3D tilt hook for cards ─── */
function use3DTilt(intensity = 15) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});
  const handleMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(1000px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) scale3d(1.02,1.02,1.02)`,
      transition: 'transform 0.1s ease-out',
    });
  };
  const handleLeave = () => {
    setStyle({ transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)', transition: 'transform 0.4s ease-out' });
  };
  return { ref, style, onMouseMove: handleMove, onMouseLeave: handleLeave };
}

/* ─── Metric component ─── */
function Metric({ icon: Icon, value, suffix, label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const count = useCountUp(value, 2000, inView);
  return (
    <div ref={ref} className="flex flex-col items-center gap-2 px-6 py-4">
      <Icon size={20} className="text-[#6C63FF]" />
      <span className="text-3xl md:text-4xl font-bold font-['Outfit'] text-[#F0F0F5]">
        {count}{suffix}
      </span>
      <span className="text-sm text-[#8888A0]">{label}</span>
    </div>
  );
}

/* ─── FAQ Item ─── */
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(255,255,255,0.07)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className="text-[#F0F0F5] font-medium text-base md:text-lg">{question}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown size={20} className="text-[#8888A0] flex-shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[#8888A0] text-sm leading-relaxed pr-8">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fade-up wrapper ─── */
const FadeUp = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ─── Gradient border wrapper ─── */
const GradientBorder = ({ children, className = '' }) => (
  <div className={`relative rounded-2xl p-px bg-gradient-to-r from-[#6C63FF] to-[#00D4AA] ${className}`}>
    <div className="rounded-2xl bg-[#111118] h-full">{children}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const { user, loading } = useAuth();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  /* ROI calculator state */
  const [missedCalls, setMissedCalls] = useState(15);
  const patientValue = 200;
  const lostRevenue = missedCalls * patientValue * 52;
  const roiTilt = use3DTilt(8);

  /* Navbar scroll state */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 animate-pulse" />
      </div>
    );
  }

  // Logged-in users go straight to their dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  const faqs = [
    { q: 'How does ARIA handle complex calls?', a: 'ARIA uses advanced natural language understanding trained specifically on dental practice scenarios. For truly complex situations it can\'t resolve, it seamlessly transfers the call to your team with full context, so nothing falls through the cracks.' },
    { q: 'Is my patient data secure?', a: 'Absolutely. We\'re HIPAA-compliant with end-to-end encryption, SOC 2 Type II certified infrastructure, and regular third-party security audits. Patient data is never used for model training.' },
    { q: 'Can I keep my existing phone number?', a: 'Yes. We port your existing number or set up call forwarding — your patients won\'t notice any change. Setup takes under 10 minutes with our guided onboarding.' },
    { q: 'How long does setup take?', a: 'Most practices are fully live within 15 minutes. Connect your calendar, customize ARIA\'s responses, and you\'re done. Our onboarding team is available if you need help.' },
    { q: 'What happens if ARIA can\'t help a caller?', a: 'ARIA gracefully escalates to your team. It provides a real-time summary of the conversation so your staff picks up with full context. You set the escalation rules.' },
    { q: 'Do patients know they\'re talking to AI?', a: 'ARIA identifies itself transparently at the start of each interaction. Most patients appreciate the instant response and seamless booking experience regardless.' },
    { q: 'What\'s included in the free trial?', a: 'Everything. Full access to AI calls, WhatsApp messaging, the dashboard, and analytics for 14 days. No credit card required, no feature gates.' },
    { q: 'Can I cancel anytime?', a: 'Yes, cancel with one click from your dashboard. No contracts, no cancellation fees, no questions asked. We believe in earning your business every month.' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0F5] overflow-x-hidden">

      {/* ── Ambient glow (fixed bg) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-[#6C63FF]/[0.08] rounded-full blur-[180px]" />
        <div className="absolute top-[60%] right-1/4 w-[600px] h-[600px] bg-[#00D4AA]/[0.06] rounded-full blur-[180px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#6C63FF]/[0.04] rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10">

        {/* ═══════════════════════ 1. NAV ═══════════════════════ */}
        <nav
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled ? 'bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-[rgba(255,255,255,0.07)]' : ''
          }`}
        >
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#6C63FF] flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.4)]">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="font-['Outfit'] text-lg font-semibold tracking-tight">DentistAI</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#features" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors hidden sm:inline">Features</a>
              <a href="#pricing" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors hidden sm:inline">Pricing</a>
              <Link to="/login" className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#F0F0F5] border border-[rgba(255,255,255,0.07)] transition-all">
                Sign in
              </Link>
            </div>
          </div>
        </nav>

        {/* ═══════════════════════ 2. HERO ═══════════════════════ */}
        <section ref={heroRef} className="relative pt-28 pb-16 md:pt-36 md:pb-24">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              {/* Left — copy */}
              <div className="max-w-xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-xs text-[#6C63FF] mb-8"
                >
                  <Zap size={12} /> Live now — powered by ARIA
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className="text-5xl md:text-6xl lg:text-7xl font-light font-['Outfit'] tracking-tight mb-6 leading-[1.05]"
                >
                  Your practice<br />
                  <span className="bg-gradient-to-r from-[#6C63FF] to-[#00D4AA] bg-clip-text text-transparent">
                    runs itself.
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="text-lg text-[#8888A0] mb-10 leading-relaxed"
                >
                  DentistAI answers the phone, messages patients on WhatsApp, books appointments, and chases no-shows — so your team can focus on what actually happens in the chair.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3 }}
                  className="flex flex-wrap gap-3"
                >
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-2 bg-[#6C63FF] text-white px-6 py-3.5 rounded-xl font-medium hover:bg-[#5B54E6] shadow-[0_0_30px_rgba(108,99,255,0.3)] hover:shadow-[0_0_50px_rgba(108,99,255,0.5)] transition-all duration-300"
                  >
                    Start free trial <ArrowRight size={16} />
                  </Link>
                  <button className="inline-flex items-center gap-2 bg-white/5 text-[#F0F0F5] px-6 py-3.5 rounded-xl font-medium hover:bg-white/10 border border-[rgba(255,255,255,0.07)] transition-all duration-300">
                    <Play size={16} className="text-[#6C63FF]" /> Watch demo
                  </button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                  className="mt-6 text-xs text-[#8888A0] inline-flex items-center gap-2"
                >
                  <Check size={12} className="text-[#00D4AA]" /> No credit card required
                </motion.div>
              </div>

              {/* Right — 3D floating dashboard mockup */}
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.9, delay: 0.3 }}
                className="relative hidden lg:block"
              >
                {/* Glow behind 3D card */}
                <div className="absolute inset-0 -z-10">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#6C63FF]/20 rounded-full blur-[100px]" />
                  <div className="absolute top-1/3 right-0 w-[200px] h-[200px] bg-[#00D4AA]/15 rounded-full blur-[80px]" />
                </div>

                {/* Main 3D dashboard card */}
                <motion.div
                  whileHover={{ rotateY: 0, rotateX: 0, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  style={{ transform: 'perspective(1200px) rotateY(-15deg) rotateX(5deg)', transformStyle: 'preserve-3d' }}
                  className="relative bg-[#111118]/90 backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 shadow-2xl"
                >
                  {/* Dashboard header */}
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    <span className="ml-3 text-xs text-[#8888A0]">DentistAI Dashboard</span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Calls Today', val: '24', color: '#6C63FF' },
                      { label: 'Booked', val: '18', color: '#00D4AA' },
                      { label: 'Revenue', val: '$3.6k', color: '#FFB347' },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#0A0A0F]/60 rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[10px] text-[#8888A0] mb-1">{s.label}</p>
                        <p className="text-lg font-bold font-['Outfit']" style={{ color: s.color }}>{s.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Activity feed */}
                  <div className="space-y-2.5">
                    {[
                      { text: 'New appointment booked — Dr. Chen, 2:30 PM', time: '2m ago', icon: Calendar },
                      { text: 'WhatsApp reminder sent — Sarah K.', time: '5m ago', icon: MessageCircle },
                      { text: 'Call answered — patient inquiry', time: '8m ago', icon: Phone },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-3 bg-[#0A0A0F]/40 rounded-lg p-2.5 border border-[rgba(255,255,255,0.04)]">
                        <div className="w-7 h-7 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
                          <item.icon size={13} className="text-[#6C63FF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#F0F0F5] truncate">{item.text}</p>
                        </div>
                        <span className="text-[10px] text-[#8888A0] flex-shrink-0">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Floating chat bubble — top right */}
                <motion.div
                  animate={{ y: [0, -20, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-6 -right-4 bg-[#111118]/80 backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl p-3 shadow-lg"
                  style={{ transform: 'translateZ(60px)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
                      <MessageCircle size={13} className="text-[#00D4AA]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#F0F0F5]">New message</p>
                      <p className="text-[9px] text-[#8888A0]">"I'd like to reschedule..."</p>
                    </div>
                  </div>
                </motion.div>

                {/* Floating phone icon — bottom left */}
                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute -bottom-4 -left-6 bg-[#111118]/80 backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl p-3 shadow-lg"
                  style={{ transform: 'translateZ(40px)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#6C63FF]/20 flex items-center justify-center">
                      <Phone size={13} className="text-[#6C63FF]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#F0F0F5]">Incoming call</p>
                      <p className="text-[9px] text-[#8888A0]">ARIA answering...</p>
                    </div>
                  </div>
                </motion.div>

                {/* Floating success badge — mid right */}
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute top-1/2 -right-10 bg-[#00D4AA]/10 backdrop-blur-xl border border-[#00D4AA]/20 rounded-full px-3 py-1.5 shadow-lg"
                >
                  <div className="flex items-center gap-1.5">
                    <Check size={12} className="text-[#00D4AA]" />
                    <span className="text-[10px] text-[#00D4AA] font-medium">Booked</span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ═══════════════════════ 3. METRICS BAR ═══════════════════════ */}
        <section className="border-y border-[rgba(255,255,255,0.07)] bg-[#111118]/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Metric icon={Phone} value={500} suffix="+" label="Calls handled" />
              <Metric icon={TrendingUp} value={98} suffix="%" label="Booking rate" />
              <Metric icon={Clock} value={24} suffix="/7" label="Availability" />
              <Metric icon={Zap} value={2} suffix=" min" label="Avg response" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════ 4. FEATURE DEEP-DIVES ═══════════════════════ */}
        <section id="features" className="py-24 md:py-32">

          {/* Section A — AI Phone Calls */}
          <div className="max-w-7xl mx-auto px-6 mb-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <FadeUp>
                <div className="max-w-lg">
                  <span className="text-xs uppercase tracking-widest text-[#6C63FF] font-medium mb-4 block">AI Phone Calls</span>
                  <h2 className="text-3xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-6 leading-tight">
                    ARIA answers<br /><span className="text-[#8888A0]">every call.</span>
                  </h2>
                  <div className="space-y-4">
                    {[
                      'Answers in under 2 seconds, 24 hours a day, 365 days a year',
                      'Books, reschedules, and cancels appointments conversationally',
                      'Escalates complex cases to your team with full context summary',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#6C63FF]/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Check size={12} className="text-[#6C63FF]" />
                        </div>
                        <p className="text-[#8888A0] text-sm leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeUp>

              <FadeUp delay={0.15}>
                <motion.div
                  whileHover={{ rotateY: 0, rotateX: 0 }}
                  style={{ transform: 'perspective(1200px) rotateY(-10deg) rotateX(4deg)' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 shadow-2xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-[#6C63FF]/20 flex items-center justify-center">
                      <Phone size={14} className="text-[#6C63FF]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#F0F0F5]">Active Call</p>
                      <p className="text-[10px] text-[#00D4AA]">ARIA is speaking</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                      <span className="text-[10px] text-[#8888A0]">2:34</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    {[
                      { who: 'Patient', text: 'Hi, I need to book a cleaning appointment for next week.' },
                      { who: 'ARIA', text: 'Of course! I have openings on Tuesday at 10 AM and Thursday at 2:30 PM. Which works better for you?' },
                      { who: 'Patient', text: 'Thursday at 2:30 sounds perfect.' },
                      { who: 'ARIA', text: "Great, you're all set for Thursday at 2:30 PM with Dr. Chen. You'll get a confirmation text shortly!" },
                    ].map((msg, i) => (
                      <div key={i} className={`flex ${msg.who === 'ARIA' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                          msg.who === 'ARIA'
                            ? 'bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-[#F0F0F5]'
                            : 'bg-white/5 border border-[rgba(255,255,255,0.07)] text-[#8888A0]'
                        }`}>
                          <p className="text-[10px] font-medium mb-0.5" style={{ color: msg.who === 'ARIA' ? '#6C63FF' : '#8888A0' }}>{msg.who}</p>
                          <p className="leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </FadeUp>
            </div>
          </div>

          {/* Section B — WhatsApp (reversed) */}
          <div className="max-w-7xl mx-auto px-6 mb-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <FadeUp delay={0.15} className="order-2 lg:order-1">
                <motion.div
                  whileHover={{ rotateY: 0, rotateX: 0 }}
                  style={{ transform: 'perspective(1200px) rotateY(10deg) rotateX(4deg)' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 shadow-2xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                      <MessageCircle size={14} className="text-[#25D366]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#F0F0F5]">WhatsApp Business</p>
                      <p className="text-[10px] text-[#8888A0]">DentistAI Practice</p>
                    </div>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    {[
                      { from: 'bot', text: "Hi Sarah! Just a reminder: you have a cleaning appointment tomorrow at 10 AM with Dr. Chen. Reply 'C' to confirm or 'R' to reschedule." },
                      { from: 'user', text: 'C' },
                      { from: 'bot', text: "Confirmed! See you tomorrow at 10 AM. Remember to bring your insurance card. Have a great day!" },
                      { from: 'user', text: 'Thanks! Can I also book a checkup for my son?' },
                      { from: 'bot', text: "Of course! I have openings next Monday at 3 PM or Wednesday at 11 AM. Which works for you?" },
                    ].map((msg, i) => (
                      <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                          msg.from === 'bot'
                            ? 'bg-[#25D366]/10 border border-[#25D366]/15 text-[#F0F0F5]'
                            : 'bg-white/5 border border-[rgba(255,255,255,0.07)] text-[#F0F0F5]'
                        }`}>
                          <p className="leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </FadeUp>

              <FadeUp className="order-1 lg:order-2">
                <div className="max-w-lg lg:ml-auto">
                  <span className="text-xs uppercase tracking-widest text-[#00D4AA] font-medium mb-4 block">WhatsApp Messaging</span>
                  <h2 className="text-3xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-6 leading-tight">
                    Two-way WhatsApp,<br /><span className="text-[#8888A0]">zero effort.</span>
                  </h2>
                  <div className="space-y-4">
                    {[
                      'Automated reminders cut no-shows by up to 40%',
                      'Patients reply naturally — ARIA understands and responds',
                      'Bulk campaigns for recalls, promotions, and follow-ups',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#00D4AA]/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Check size={12} className="text-[#00D4AA]" />
                        </div>
                        <p className="text-[#8888A0] text-sm leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>

          {/* Section C — Smart Dashboard */}
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <FadeUp>
                <div className="max-w-lg">
                  <span className="text-xs uppercase tracking-widest text-[#FFB347] font-medium mb-4 block">Smart Dashboard</span>
                  <h2 className="text-3xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-6 leading-tight">
                    Your command<br /><span className="text-[#8888A0]">center.</span>
                  </h2>
                  <div className="space-y-4">
                    {[
                      'Real-time metrics: calls, bookings, revenue, no-show rates',
                      'Full conversation history with searchable transcripts',
                      'One-click export for compliance audits and reporting',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#FFB347]/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Check size={12} className="text-[#FFB347]" />
                        </div>
                        <p className="text-[#8888A0] text-sm leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeUp>

              <FadeUp delay={0.15}>
                <motion.div
                  whileHover={{ rotateY: 0, rotateX: 0 }}
                  style={{ transform: 'perspective(1200px) rotateY(-10deg) rotateX(4deg)' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 shadow-2xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    <span className="ml-2 text-[10px] text-[#8888A0]">Analytics</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'Total Revenue', val: '$48.2k', change: '+12%', color: '#00D4AA' },
                      { label: 'No-Show Rate', val: '4.2%', change: '-38%', color: '#00D4AA' },
                      { label: 'New Patients', val: '67', change: '+24%', color: '#6C63FF' },
                      { label: 'Satisfaction', val: '4.9/5', change: '+0.3', color: '#FFB347' },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#0A0A0F]/60 rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[10px] text-[#8888A0] mb-1">{s.label}</p>
                        <p className="text-base font-bold font-['Outfit'] text-[#F0F0F5]">{s.val}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: s.color }}>{s.change}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mini chart placeholder */}
                  <div className="bg-[#0A0A0F]/40 rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                    <p className="text-[10px] text-[#8888A0] mb-2">Weekly Bookings</p>
                    <div className="flex items-end gap-1.5 h-12">
                      {[40, 65, 55, 80, 70, 90, 85].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-gradient-to-t from-[#6C63FF] to-[#6C63FF]/40"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <span key={i} className="text-[8px] text-[#8888A0] flex-1 text-center">{d}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </FadeUp>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ 5. ROI CALCULATOR ═══════════════════════ */}
        <section id="pricing" className="py-24 md:py-32">
          <div className="max-w-3xl mx-auto px-6">
            <FadeUp>
              <div className="text-center mb-12">
                <span className="text-xs uppercase tracking-widest text-[#00D4AA] font-medium mb-4 block">ROI Calculator</span>
                <h2 className="text-3xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-4">
                  See what you're <span className="text-[#8888A0]">leaving on the table.</span>
                </h2>
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <div
                ref={roiTilt.ref}
                onMouseMove={roiTilt.onMouseMove}
                onMouseLeave={roiTilt.onMouseLeave}
                style={roiTilt.style}
              >
                <GradientBorder>
                  <div className="p-8 md:p-10">
                    <label className="block text-sm text-[#8888A0] mb-3">
                      How many calls does your practice miss per week?
                    </label>
                    <div className="flex items-center gap-4 mb-2">
                      <input
                        type="range"
                        min={5}
                        max={50}
                        value={missedCalls}
                        onChange={(e) => setMissedCalls(Number(e.target.value))}
                        className="flex-1 accent-[#6C63FF] h-2 bg-white/5 rounded-full appearance-none cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#6C63FF]
                          [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(108,99,255,0.5)] [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <span className="text-2xl font-bold font-['Outfit'] text-[#6C63FF] w-12 text-right">{missedCalls}</span>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-[#0A0A0F]/60 rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-xs text-[#8888A0] mb-1">Missed calls/year</p>
                        <motion.p
                          key={missedCalls * 52}
                          initial={{ scale: 1.1, opacity: 0.7 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-2xl font-bold font-['Outfit'] text-[#F0F0F5]"
                        >
                          {(missedCalls * 52).toLocaleString()}
                        </motion.p>
                      </div>
                      <div className="bg-[#0A0A0F]/60 rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-xs text-[#8888A0] mb-1">Lost revenue/year</p>
                        <motion.p
                          key={lostRevenue}
                          initial={{ scale: 1.1, opacity: 0.7 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-2xl font-bold font-['Outfit'] text-[#FF6B6B]"
                        >
                          ${lostRevenue.toLocaleString()}
                        </motion.p>
                      </div>
                      <div className="bg-[#0A0A0F]/60 rounded-xl p-4 border border-[#00D4AA]/20">
                        <p className="text-xs text-[#8888A0] mb-1">DentistAI cost/year</p>
                        <motion.p className="text-2xl font-bold font-['Outfit'] text-[#00D4AA]">$1,188</motion.p>
                      </div>
                    </div>

                    <div className="mt-6 text-center">
                      <p className="text-sm text-[#8888A0]">
                        DentistAI saves you{' '}
                        <span className="text-[#00D4AA] font-semibold">
                          ${(lostRevenue - 1188).toLocaleString()}
                        </span>
                        /year for just <span className="text-[#F0F0F5] font-medium">$99/mo</span>
                      </p>
                    </div>
                  </div>
                </GradientBorder>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* ═══════════════════════ 6. TESTIMONIALS ═══════════════════════ */}
        {/* PLACEHOLDER — replace with real testimonials */}
        <section className="py-24 md:py-32 border-y border-[rgba(255,255,255,0.07)]">
          <div className="max-w-7xl mx-auto px-6">
            <FadeUp>
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-4">
                  Loved by <span className="text-[#8888A0]">practices everywhere.</span>
                </h2>
              </div>
            </FadeUp>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* PLACEHOLDER — replace with real testimonials */}
              {[
                {
                  quote: "DentistAI cut our no-show rate by 35% in the first month. ARIA handles calls so naturally that patients don't even realize it's AI. Game changer for our practice.",
                  name: 'Dr. Sarah M.',
                  location: 'Portland, OR',
                  stars: 5,
                },
                {
                  quote: "We were missing 20+ calls a week. Now every single one gets answered. The ROI paid for itself in the first week. I wish we'd found this sooner.",
                  name: 'Dr. James K.',
                  location: 'Austin, TX',
                  stars: 5,
                },
                {
                  quote: "The WhatsApp integration is incredible. Patients love getting reminders and being able to reschedule with a quick message. Our front desk finally has breathing room.",
                  name: 'Dr. Priya R.',
                  location: 'Chicago, IL',
                  stars: 5,
                },
              ].map((t, i) => (
                <FadeUp key={i} delay={i * 0.1}>
                  <TestimonialCard {...t} />
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ 7. FAQ ═══════════════════════ */}
        <section className="py-24 md:py-32">
          <div className="max-w-3xl mx-auto px-6">
            <FadeUp>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-5xl font-light font-['Outfit'] tracking-tight mb-4">
                  Frequently asked <span className="text-[#8888A0]">questions.</span>
                </h2>
              </div>
            </FadeUp>
            <FadeUp delay={0.1}>
              <div>
                {faqs.map((faq) => (
                  <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
                ))}
              </div>
            </FadeUp>
          </div>
        </section>

        {/* ═══════════════════════ 8. FINAL CTA ═══════════════════════ */}
        <section className="py-24 md:py-32 relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 -z-10">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'linear-gradient(135deg, #6C63FF 0%, #00D4AA 50%, #6C63FF 100%)',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 8s ease-in-out infinite',
              }}
            />
            <div className="absolute inset-0 bg-[#0A0A0F]/80" />
          </div>
          <style>{`@keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>

          <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
            <FadeUp>
              <h2 className="text-4xl md:text-6xl font-light font-['Outfit'] tracking-tight mb-6">
                Ready to reclaim<br />
                <span className="bg-gradient-to-r from-[#6C63FF] to-[#00D4AA] bg-clip-text text-transparent">your time?</span>
              </h2>
              <p className="text-lg text-[#8888A0] mb-10 max-w-lg mx-auto">
                Set up in under 10 minutes. Start free for 14 days. No credit card required.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 bg-[#6C63FF] text-white px-8 py-4 rounded-xl font-medium text-lg hover:bg-[#5B54E6] shadow-[0_0_40px_rgba(108,99,255,0.4)] hover:shadow-[0_0_60px_rgba(108,99,255,0.6)] transition-all duration-300"
              >
                Start free trial <ArrowRight size={18} />
              </Link>
            </FadeUp>
          </div>
        </section>

        {/* ═══════════════════════ 9. FOOTER ═══════════════════════ */}
        <footer className="border-t border-[rgba(255,255,255,0.07)] bg-[#0A0A0F]">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              {/* Brand col */}
              <div className="col-span-2 md:col-span-1">
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-[#6C63FF] flex items-center justify-center shadow-[0_0_15px_rgba(108,99,255,0.3)]">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <span className="font-['Outfit'] text-lg font-semibold">DentistAI</span>
                </div>
                <p className="text-xs text-[#8888A0] leading-relaxed max-w-[200px]">
                  AI-powered practice management for modern dental offices.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#F0F0F5] mb-4">Product</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="#features" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Features</a></li>
                  <li><Link to="/pricing" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Pricing</Link></li>
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Demo</a></li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#F0F0F5] mb-4">Company</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">About</a></li>
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Blog</a></li>
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Careers</a></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#F0F0F5] mb-4">Legal</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Privacy</a></li>
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Terms</a></li>
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">HIPAA</a></li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#F0F0F5] mb-4">Support</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Docs</a></li>
                  <li><a href="mailto:hello@dentistai.com" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Contact</a></li>
                  <li><a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors">Status</a></li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-8 border-t border-[rgba(255,255,255,0.07)] flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-[#8888A0]">&copy; 2026 DentistAI. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors"><Twitter size={16} /></a>
                <a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors"><Linkedin size={16} /></a>
                <a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors"><Github size={16} /></a>
                <a href="#" className="text-[#8888A0] hover:text-[#F0F0F5] transition-colors"><Mail size={16} /></a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─── Testimonial Card (extracted for 3D tilt) ─── */
function TestimonialCard({ quote, name, location, stars }) {
  const tilt = use3DTilt(10);
  return (
    <div
      ref={tilt.ref}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={tilt.style}
      className="h-full bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-2xl p-7 hover:border-[#6C63FF]/20 transition-colors"
    >
      {/* PLACEHOLDER — replace with real testimonials */}
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} size={14} className="text-[#FFB347] fill-[#FFB347]" />
        ))}
      </div>
      <p className="text-sm text-[#F0F0F5] leading-relaxed mb-6">&ldquo;{quote}&rdquo;</p>
      <div>
        <p className="text-sm font-medium text-[#F0F0F5]">{name}</p>
        <p className="text-xs text-[#8888A0]">{location}</p>
      </div>
    </div>
  );
}
