import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/context/AuthContext';

export default function Layout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 aria-orb" />
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

      <Sidebar />
      
      {/* Main Content - shifts based on sidebar */}
      <main className="ml-64 pt-10 min-h-screen transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}
