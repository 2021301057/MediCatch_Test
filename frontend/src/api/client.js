import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// 요청마다 JWT + userId 자동 첨부
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // GET 요청에 userId, codefId 자동 포함
  if (config.method === 'get') {
    const userId = localStorage.getItem('userId');
    const codefId = localStorage.getItem('codefId');
    config.params = { ...(userId ? { userId } : {}), ...(codefId ? { codefId } : {}), ...config.params };
  }
  return config;
});

// 401 → 자동 토큰 갱신
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      try {
        const refresh = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('accessToken', data.accessToken);
        err.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(err.config);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
