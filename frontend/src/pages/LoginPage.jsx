import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') setError(detail);
      else if (Array.isArray(detail)) setError(detail.map(e => e.msg || JSON.stringify(e)).join(' '));
      else setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@dentistai.com');
    setPassword('DentistAI2026!');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6C63FF]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00D4AA]/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#6C63FF] mb-4 shadow-[0_0_40px_rgba(108,99,255,0.3)]">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 data-testid="login-title" className="text-3xl font-light text-[#F0F0F5] font-['Outfit'] tracking-tight">
            DentistAI
          </h1>
          <p className="text-sm text-[#8888A0] mt-2">Your practice runs itself.</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-medium text-[#F0F0F5] font-['Outfit'] mb-6">Welcome back</h2>

          {error && (
            <div data-testid="login-error" className="mb-4 px-4 py-3 rounded-lg bg-[#FF5B6A]/10 border border-[#FF5B6A]/20 text-sm text-[#FF5B6A]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8888A0] mb-1.5 uppercase tracking-wider">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@practice.com"
                required
                className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF] transition-all px-4 py-3 text-sm placeholder:text-[#8888A0]/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8888A0] mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-[#0A0A0F] border border-[rgba(255,255,255,0.07)] text-[#F0F0F5] rounded-lg focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF] transition-all px-4 py-3 text-sm placeholder:text-[#8888A0]/50 outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888A0] hover:text-[#F0F0F5]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#6C63FF] text-white py-3 rounded-lg font-medium text-sm hover:bg-[#6C63FF]/90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(108,99,255,0.3)] hover:shadow-[0_0_30px_rgba(108,99,255,0.5)]"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.07)]">
            <button
              data-testid="demo-login-button"
              onClick={fillDemo}
              className="w-full py-3 rounded-lg text-sm font-medium text-[#6C63FF] bg-[#6C63FF]/10 hover:bg-[#6C63FF]/20 border border-[#6C63FF]/20 transition-all"
            >
              Try Demo Account
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#8888A0]/60 mt-6">
          Powered by DentistAI © 2026
        </p>
      </div>
    </div>
  );
}
