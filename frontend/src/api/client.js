import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 60000 });

// 요청마다 JWT 자동 첨부 (userId는 게이트웨이가 JWT에서 추출해 X-User-Id 헤더로 전달)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // codefId는 보험 데이터 식별용으로 백엔드에서 사용 (userId는 자동 첨부하지 않음 — 변조 방지)
  if (config.method === 'get') {
    const codefId = localStorage.getItem('codefId');
    config.params = { ...(codefId ? { codefId } : {}), ...config.params };
  }
  return config;
});

// 401 → 자동 토큰 갱신
api.interceptors.response.use(
  res => res.data,
  async err => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
