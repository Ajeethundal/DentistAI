import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, ArrowRight, Zap } from 'lucide-react';

const PLAN_LABEL = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
};

export default function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState({ currentPlan: 'free', minPlan: 'starter', message: '' });

  useEffect(() => {
    const handler = (e) => {
      setInfo(e.detail || {});
      setOpen(true);
    };
    window.addEventListener('upgrade-required', handler);
    return () => window.removeEventListener('upgrade-required', handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-md w-full bg-[#111118] border border-[#6C63FF]/30 rounded-2xl p-8 shadow-[0_0_60px_rgba(108,99,255,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#8888A0] hover:text-[#F0F0F5]"
        >
          <X size={18} />
        </button>

        <div className="w-12 h-12 rounded-xl bg-[#6C63FF]/15 flex items-center justify-center mb-5">
          <Sparkles size={22} className="text-[#6C63FF]" />
        </div>

        <h2 className="text-2xl font-light font-['Outfit'] text-[#F0F0F5] mb-2">
          Unlock {PLAN_LABEL[info.minPlan] || 'this feature'}
        </h2>
        <p className="text-sm text-[#8888A0] mb-6">
          {info.message ||
            `Your current plan is ${PLAN_LABEL[info.currentPlan] || info.currentPlan}. Upgrade to ${PLAN_LABEL[info.minPlan] || info.minPlan} to access this feature.`}
        </p>

        <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-lg bg-[#6C63FF]/5 border border-[#6C63FF]/20">
          <Zap size={14} className="text-[#6C63FF]" />
          <span className="text-xs text-[#C0C0CF]">
            14-day free trial. No credit card needed to start.
          </span>
        </div>

        <div className="flex gap-3">
          <Link
            to="/pricing"
            onClick={() => setOpen(false)}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#6C63FF] text-white py-3 rounded-lg font-medium text-sm hover:bg-[#6C63FF]/90 shadow-[0_0_20px_rgba(108,99,255,0.3)]"
          >
            View plans <ArrowRight size={14} />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-3 rounded-lg text-sm text-[#8888A0] hover:text-[#F0F0F5] hover:bg-white/5"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
