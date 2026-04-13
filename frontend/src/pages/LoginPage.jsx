import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/services';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', birthDate: '', gender: 'M' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const { data } = await authAPI.login({ email: form.email, password: form.password });
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    } finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const { data } = await authAPI.signup(form);
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <div style={s.bg}>
      <div style={s.card}>
        {/* 로고 */}
        <div style={s.logo}>
          <span style={{ fontSize: 48 }}>🏥</span>
          <h1 style={s.title}>MediCatch</h1>
          <p style={s.sub}>내 건강 데이터로 찾는, 나에게 딱 맞는 보험</p>
        </div>

        {/* 탭 */}
        <div style={s.tabs}>
          {['login','signup'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}>
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={tab === 'login' ? handleLogin : handleSignup} style={s.form}>
          {tab === 'signup' && (
            <>
              <input name="name" placeholder="이름" value={form.name} onChange={handle} style={s.input} required />
              <input name="birthDate" type="date" placeholder="생년월일" value={form.birthDate} onChange={handle} style={s.input} required />
              <select name="gender" value={form.gender} onChange={handle} style={s.input}>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
            </>
          )}
          <input name="email" type="email" placeholder="이메일" value={form.email} onChange={handle} style={s.input} required />
          <input name="password" type="password" placeholder="비밀번호" value={form.password} onChange={handle} style={s.input} required />
          {error && <div style={s.error}>{error}</div>}
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? '처리 중...' : (tab === 'login' ? '로그인' : '회원가입')}
          </button>
        </form>

        {/* CODEF 안내 */}
        <div style={s.info}>
          <span>🔐</span>
          <span>CODEF API를 통해 건강보험공단 및 보험사 데이터를 안전하게 연동합니다</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  bg: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: '#fff', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.3)' },
  logo: { textAlign: 'center', marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 700, color: '#0f172a', margin: '8px 0 4px' },
  sub: { fontSize: 13, color: '#64748b' },
  tabs: { display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24 },
  tab: { flex: 1, padding: '8px 0', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#64748b' },
  tabActive: { background: '#fff', color: '#1d4ed8', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' },
  error: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', color: '#dc2626', fontSize: 13 },
  btn: { padding: '13px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  info: { display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 20, padding: '12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#3b82f6' },
};
