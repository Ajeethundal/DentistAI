import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef(false);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  }, []);

  // Shared Axios instance with 401 interceptor
  const apiInstance = useMemo(() => {
    const instance = axios.create({
      baseURL: `${API}/api`,
      withCredentials: true,
    });

    // Request interceptor: attach token to every request
    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: handle 401 (logout) and 402 (upgrade required)
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        if (status === 401) {
          if (!refreshing.current) {
            refreshing.current = true;
            localStorage.removeItem('token');
            setUser(null);
            window.location.href = '/login';
          }
        } else if (status === 402) {
          // Subscription upgrade required — dispatch event for <UpgradeModal>
          const detail = error.response?.data?.detail || {};
          window.dispatchEvent(
            new CustomEvent('upgrade-required', {
              detail: {
                currentPlan: detail.current_plan || 'free',
                minPlan: detail.min_plan || 'starter',
                message: detail.message || 'This feature requires a paid plan.',
              },
            })
          );
        } else if (status === 429) {
          window.dispatchEvent(
            new CustomEvent('rate-limited', {
              detail: { message: 'Too many requests. Please wait a moment.' },
            })
          );
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await axios.get(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setUser({ ...data, token });
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await axios.post(
      `${API}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    localStorage.setItem('token', data.token);
    setUser(data);
    refreshing.current = false;
    return data;
  };

  const register = async (email, password, name, practice_name) => {
    const { data } = await axios.post(
      `${API}/api/auth/register`,
      { email, password, name, practice_name },
      { withCredentials: true }
    );
    localStorage.setItem('token', data.token);
    setUser(data);
    refreshing.current = false;
    return data;
  };

  const logout = async () => {
    try {
      await apiInstance.post('/auth/logout', {});
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, apiInstance }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useApi() {
  const { apiInstance } = useAuth();
  return apiInstance;
}
