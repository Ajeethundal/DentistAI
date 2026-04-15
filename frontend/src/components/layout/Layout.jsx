import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { Menu } from 'lucide-react';

export default function Layout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 aria-orb" />
          <p className="text-xs text-[#8888A0] animate-pulse">Loading your practice...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Demo Mode Banner */}
      <div data-testid="demo-banner" className="fixed top-0 left-0 right-0 z-50 bg-[#6C63FF]/10 border-b border-[#6C63FF]/20 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 py-1.5 px-4">
          <div className="w-2 h-2 rounded-full bg-[#6C63FF] animate-pulse" />
          <span className="text-xs font-medium text-[#6C63FF]">
            Demo Mode — Powered by real AI. ARIA is answering your questions.
          </span>
        </div>
      </div>

      {/* Mobile menu button */}
      <button
        data-testid="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-12 left-3 z-50 p-2 rounded-lg bg-[#111118] border border-[rgba(255,255,255,0.07)] text-[#8888A0]"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main Content */}
      <main className="md:ml-64 ml-0 pt-10 min-h-screen transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}
