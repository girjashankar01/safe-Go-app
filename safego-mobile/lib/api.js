import axios from 'axios';
import { getToken, removeToken } from '../services/storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
});

// Injected by App.js after the NavigationContainer mounts.
// Allows the 401 interceptor to redirect without importing navigation directly.
let _onUnauthenticated = null;

export const setUnauthenticatedHandler = (handler) => {
  _onUnauthenticated = handler;
};

// Attach stored JWT to every request.
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: clear token and signal the app to return to Login.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url;

    // Don't logout if the login request itself failed
    if (status === 401 && url !== "/auth/login") {
      await removeToken();
      _onUnauthenticated?.();
    }

    return Promise.reject(error);
  }
);

export const register = (data) =>
  api.post('/auth/register', data).then((res) => res.data);

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((res) => res.data);

export const getMe = () =>
  api.get('/auth/me').then((res) => res.data);

// ─── Emergency Contacts ───────────────────────────────────────────────────────

export const getContacts = () =>
  api.get('/auth/contacts').then((res) => res.data);

export const createContact = (data) =>
  api.post('/auth/contacts', data).then((res) => res.data);

export const updateContact = (id, data) =>
  api.put(`/auth/contacts/${id}`, data).then((res) => res.data);

export const deleteContact = (id) =>
  api.delete(`/auth/contacts/${id}`).then((res) => res.data);

export default api;
