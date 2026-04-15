import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const authHeaders = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const STATUS_COLOR = {
  active: 'text-[#00D4AA] bg-[#00D4AA]/10',
  trialing: 'text-[#6C63FF] bg-[#6C63FF]/10',
  past_due: 'text-[#FFB84D] bg-[#FFB84D]/10',
  cancelled: 'text-[#FF5B6A] bg-[#FF5B6A]/10',
  inactive: 'text-[#8888A0] bg-white/5',
};

export default function BillingPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const showWelcome = params.get('welcome') === '1';

  const fetchSub = async () => {
    try {
      const { data } = await axios.get(`${API}/api/paddle/subscription`, {
        headers: authHeaders(),
      });
      setSub(data);
    } catch (e) {
      setError('Could not load your subscription.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSub(); }, []);

  const onCancel = async () => {
    if (!window.confirm('Cancel your subscription at the end of the current period?')) return;
    setCancelling(true);
    setError('');
    try {
      await axios.post(`${API}/api/paddle/subscription/cancel`, {}, { headers: authHeaders() });
      setMessage('Subscription will end at the end of the current billing period.');
      await fetchSub();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to cancel.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#6C63FF]" size={32} />
      </div>
    );
  }

  const statusClass = STATUS_COLOR[sub?.status] || STATUS_COLOR.inactive;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-light font-['Outfit'] text-[#F0F0F5] mb-2">Billing</h1>
        <p className="text-[#8888A0] text-sm">Manage your DentistAI subscription.</p>
      </div>

      {showWelcome && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-[#00D4AA]/10 border border-[#00D4AA]/20 text-sm text-[#00D4AA] inline-flex items-center gap-2">
          <Check size={16} /> Welcome! Your subscription is being activated.
        </div>
      )}

      {message && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-sm text-[#6C63FF]">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-[#FF5B6A]/10 border border-[#FF5B6A]/20 text-sm text-[#FF5B6A] inline-flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/20 flex items-center justify-center">
              <CreditCard size={18} className="text-[#6C63FF]" />
            </div>
            <div>
              <div className="text-sm text-[#8888A0]">Current plan</div>
              <div className="text-xl font-medium font-['Outfit'] text-[#F0F0F5] capitalize">
                {sub?.plan || 'free'}
              </div>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${statusClass}`}>
            {sub?.status || 'inactive'}
          </span>
        </div>

        {sub?.current_period_end && (
          <div className="text-sm text-[#8888A0]">
            {sub.status === 'cancelled' ? 'Access ends' : 'Next invoice'}:{' '}
            <span className="text-[#F0F0F5]">
              {new Date(sub.current_period_end).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.07)] flex flex-wrap gap-3">
          {(!sub?.plan || sub.plan === 'free') && (
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 bg-[#6C63FF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6C63FF]/90"
            >
              View plans
            </Link>
          )}
          {sub?.plan && sub.plan !== 'free' && sub.status === 'active' && (
            <>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 bg-white/5 text-[#F0F0F5] px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 border border-[rgba(255,255,255,0.07)]"
              >
                Change plan
              </Link>
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-2 bg-transparent text-[#FF5B6A] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#FF5B6A]/10 disabled:opacity-50"
              >
                {cancelling && <Loader2 size={14} className="animate-spin" />}
                Cancel subscription
              </button>
            </>
          )}
          {sub?.paddle_customer_id && (
            <a
              href="https://customer.paddle.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#8888A0] hover:text-[#F0F0F5] px-4 py-2"
            >
              Manage in Paddle <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Contact / help */}
      <div className="text-sm text-[#8888A0]">
        Questions about billing? Email{' '}
        <a href="mailto:billing@dentistai.com" className="text-[#6C63FF] hover:underline">
          billing@dentistai.com
        </a>
        .
      </div>
    </div>
  );
}
