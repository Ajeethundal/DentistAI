import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Calendar, Users, Phone, MessageSquare,
  RefreshCw, Settings, ChevronLeft, ChevronRight, LogOut
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/calls', label: 'Calls', icon: Phone },
  { path: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { path: '/follow-ups', label: 'Follow-ups', icon: RefreshCw },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside
      data-testid="sidebar"
      className={`fixed left-0 top-0 h-screen z-40 flex flex-col border-r border-[rgba(255,255,255,0.07)] bg-[#0A0A0F] transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[rgba(255,255,255,0.07)]">
        <div className="w-8 h-8 rounded-lg bg-[#6C63FF] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm font-['Outfit']">D</span>
        </div>
        {!collapsed && (
          <span className="font-['Outfit'] font-semibold text-[#F0F0F5] text-lg tracking-tight">
            DentistAI
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-[#6C63FF]/10 text-[#6C63FF]'
                  : 'text-[#8888A0] hover:text-[#F0F0F5] hover:bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              <Icon size={20} className={`flex-shrink-0 ${isActive ? 'text-[#6C63FF]' : 'group-hover:text-[#F0F0F5]'}`} />
              {!collapsed && (
                <span className="text-sm font-medium">{label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[rgba(255,255,255,0.07)] p-3 space-y-3">
        {/* ARIA Status */}
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#6C63FF]/60 aria-orb" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00D4AA] border-2 border-[#0A0A0F]" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-xs font-medium text-[#F0F0F5]">ARIA Online</p>
              <p className="text-[10px] text-[#8888A0]">Last action: 3 min ago</p>
            </div>
          )}
        </div>

        {/* User + Logout */}
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-[#111118] border border-[rgba(255,255,255,0.07)] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-[#8888A0]">
              {user?.name?.charAt(0) || 'D'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#F0F0F5] truncate">{user?.name || 'Doctor'}</p>
              <p className="text-[10px] text-[#8888A0] truncate">{user?.email || ''}</p>
            </div>
          )}
          {!collapsed && (
            <button
              data-testid="logout-button"
              onClick={logout}
              className="p-1.5 rounded-lg text-[#8888A0] hover:text-[#FF5B6A] hover:bg-[#FF5B6A]/10 transition-all"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          data-testid="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-[#8888A0] hover:text-[#F0F0F5] hover:bg-[rgba(255,255,255,0.05)] transition-all"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
