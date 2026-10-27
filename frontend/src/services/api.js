import axios from 'axios';

const normalizeApiBaseUrl = (value) => {
  if (!value) {
    return `http://${window.location.hostname}:8080/api`;
  }

  return value.endsWith('/api') ? value : `${value.replace(/\/$/, '')}/api`;
};

const apiBaseUrl = normalizeApiBaseUrl(process.env.REACT_APP_API_URL);

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true'
  }
});

// Ajouter le token JWT à chaque requête automatiquement
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepter les erreurs 401 (token expiré)
// On ne supprime QUE les clés d'authentification — on préserve les préférences
// utilisateur (notifications lues, etc.)
const AUTH_KEYS = ['token', 'role', 'nom', 'id'];
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      AUTH_KEYS.forEach(k => localStorage.removeItem(k));
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
