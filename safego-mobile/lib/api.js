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
    if (error.response?.status === 401) {
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

export default api;
