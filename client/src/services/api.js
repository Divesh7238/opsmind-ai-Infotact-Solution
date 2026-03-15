import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (() => {
  if (!rawApiUrl) {
    return '/api';
  }

  const normalizedUrl = rawApiUrl.replace(/\/+$/, '');
  return normalizedUrl.endsWith('/api') ? normalizedUrl : `${normalizedUrl}/api`;
})();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  updatePassword: (data) => api.put('/auth/password', data)
};

// Chat API
export const chatAPI = {
  ask: (question, chatId = null) => {
    const url = '/chat/ask';
    return api.post(url, { question, chatId });
  },
  getHistory: () => api.get('/chat/history'),
  getChat: (id) => api.get(`/chat/${id}`),
  updateChat: (id, data) => api.put(`/chat/${id}`, data),
  deleteChat: (id) => api.delete(`/chat/${id}`)
};

// Documents API
export const documentsAPI = {
  upload: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: () => api.get('/documents'),
  getOne: (id) => api.get(`/documents/${id}`),
  delete: (id) => api.delete(`/documents/${id}`),
  reprocess: (id) => api.post(`/documents/${id}/reprocess`)
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getAnalytics: () => api.get('/dashboard/analytics'),
  getUsers: () => api.get('/dashboard/users'),
  updateUserRole: (id, role) => api.put(`/dashboard/users/${id}/role`, { role })
};

