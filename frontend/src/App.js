import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import Layout from '@/components/layout/Layout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CalendarPage from '@/pages/CalendarPage';
import PatientsPage from '@/pages/PatientsPage';
import CallsPage from '@/pages/CallsPage';
import WhatsAppPage from '@/pages/WhatsAppPage';
import FollowUpsPage from '@/pages/FollowUpsPage';
import SettingsPage from '@/pages/SettingsPage';
import PricingPage from '@/pages/PricingPage';
import BillingPage from '@/pages/BillingPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/pricing" element={<PricingPage />} />

              {/* Authenticated */}
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/calls" element={<CallsPage />} />
                <Route path="/whatsapp" element={<WhatsAppPage />} />
                <Route path="/follow-ups" element={<FollowUpsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/billing" element={<BillingPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
