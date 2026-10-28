import axios from 'axios';

const TOKEN_KEY = 'lab_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((cfg) => {
  const token = tokenStore.get();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Si el token venció (401), se cierra la sesión desde AuthContext.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const esLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !esLogin) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

export function mensajeError(err) {
  const d = err.response?.data;
  if (d?.error || d?.message) return d.error || d.message;
  if (err.request && !err.response) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

export default api;
