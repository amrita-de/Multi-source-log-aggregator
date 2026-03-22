import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

export const logService = {
  getLogs:     (params) => api.get('/logs', { params }),
  getLogStats: (params) => api.get('/logs/stats', { params }),
  getLogById:  (id)     => api.get(`/logs/${id}`),
};

export default api;
