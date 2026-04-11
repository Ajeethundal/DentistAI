import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      const { data } = await axios.get(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setUser({ ...data, token });
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  };

  const register = async (email, password, name, practice_name) => {
    const { data } = await axios.post(`${API}/api/auth/register`, { email, password, name, practice_name }, { withCredentials: true });
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true }); } catch {}
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Axios helper with auth
export function useApi() {
  const { user } = useAuth();
  const api = axios.create({
    baseURL: `${API}/api`,
    withCredentials: true,
    headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {}
  });
  return api;
}
