import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Register - role is always 'employee' (backend enforces this)
  register: async (name, email, password, role = 'employee') => {
    set({ isLoading: true, error: null });
    try {
      // SECURITY: Backend ignores the role parameter and always sets 'employee'
      const response = await api.post('/auth/register', { name, email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Create admin - requires admin privileges
  createAdmin: async (name, email, password, inviteKey = null) => {
    set({ isLoading: true, error: null });
    try {
      // If inviteKey provided, use the invite-key route
      const endpoint = inviteKey ? '/auth/create-admin' : '/auth/invite-admin';
      const payload = inviteKey 
        ? { name, email, password, inviteKey }
        : { name, email, password };
      
      const response = await api.post(endpoint, payload);
      
      set({ isLoading: false });
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create admin';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data, isAuthenticated: true });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null })
}));
