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

// 인증(로그인/회원가입/비밀번호 찾기/토큰 갱신) 요청은 401이 나도
// 토큰 갱신 인터셉터를 타지 않고 에러를 그대로 컴포넌트에 전달한다.
// (로그인 실패 401이 갱신 시도 → 실패 → /login 리다이렉트로 빠지는 것을 방지)
const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/forgot-pwd', '/auth/refresh'];

// 401 → 자동 토큰 갱신
api.interceptors.response.use(
  res => res.data,
  async err => {
    const originalRequest = err.config;
    const isAuthRequest = AUTH_PATHS.some(p => (originalRequest?.url || '').startsWith(p));
    if (err.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
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
