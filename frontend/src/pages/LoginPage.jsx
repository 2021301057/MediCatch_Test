import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/services';
import useAuthStore from '../store/authStore';

/**
 * MediCatch – CareSanctuary 스타일 로그인/회원가입 페이지
 *
 * 기존 LoginPage.jsx를 통째로 이 파일로 교체하면 됩니다.
 * authAPI / authStore 사용 방식은 기존과 동일하므로 백엔드 쪽 수정은 필요 없습니다.
 *
 * 포함 기능
 *  - 좌(브랜드·카피·특징 카드) / 우(폼 카드) 2분할 반응형 레이아웃
 *  - 로그인 ↔ 회원가입 모드 전환 (하단 링크 / 상단 탭 양쪽 다 제공)
 *  - 회원가입 시 중복 이메일(409 / EMAIL_EXISTS / "이미" 메시지) 자동 감지 →
 *    배너로 "이미 가입된 회원입니다. 로그인해주세요." + [로그인하러 가기] CTA
 *    → 클릭 시 로그인 모드로 전환 + 이메일 자동 이어쓰기
 *  - 약관 동의 체크박스, 비밀번호 확인 실시간 일치 표시
 *  - 하단 256-bit AES Encryption 배지
 */
export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    birthDate: '',
    gender: 'M',
    agree: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateEmail, setDuplicateEmail] = useState(''); // 가입 시도했던 중복 이메일

  const { login } = useAuthStore();
  const navigate = useNavigate();

  // 모드 바뀔 때 에러/중복 배너 초기화
  useEffect(() => {
    setError('');
  }, [mode]);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  // ── 로그인 ─────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login({ email: form.email, password: form.password });
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── 회원가입 ───────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setDuplicateEmail('');

    if (!form.agree) {
      setError('서비스 이용약관 및 개인정보 처리방침에 동의해주세요.');
      return;
    }
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상 입력해주세요.');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      // AuthService.signup은 passwordConfirm도 검증하므로 함께 전달
      const { data } = await authAPI.signup({
        name: form.name,
        email: form.email,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        birthDate: form.birthDate,
        gender: form.gender,
      });
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err) {
      // 백엔드 AuthService가 던지는 문구와 1:1 매칭
      // (user-service/application.yml 에 server.error.include-message: always 필요)
      const msg = err.response?.data?.message || '';
      if (msg === 'Email already exists') {
        setDuplicateEmail(form.email);
      } else {
        setError(msg || '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 중복 배너에서 "로그인하러 가기" 눌렀을 때
  const goLoginWithEmail = () => {
    setMode('login');
    setForm((f) => ({ ...f, password: '', passwordConfirm: '' }));
    setDuplicateEmail('');
  };

  const isLogin = mode === 'login';
  const pwMatch = form.passwordConfirm && form.password === form.passwordConfirm;
  const pwMismatch = form.passwordConfirm && form.password !== form.passwordConfirm;

  return (
    <div style={s.page}>
      {/* 데코 배경 */}
      <div style={s.bgDecoLeft} />
      <div style={s.bgDecoRight} />

      <div style={s.split}>
        {/* ── LEFT : 브랜드 & 카피 ─────────────────────── */}
        <section style={s.left}>
          <div style={s.brand}>
            <span style={s.brandDot} />
            <span style={s.brandText}>MediCatch</span>
          </div>

          <h1 style={s.headline}>
            <span style={{ color: '#1d4ed8' }}>내 건강 데이터로 찾는,</span>
            <br />
            <span style={{ color: '#0ea371' }}>나에게 딱 맞는 보험.</span>
          </h1>
          <p style={s.subcopy}>
            건강보험공단·보험사 데이터를 한 곳에서 안전하게 연동하고,
            <br />
            내 상태에 맞는 보장과 청구 기회를 자동으로 찾아드립니다.
          </p>

          <div style={s.featureList}>
            <FeatureCard
              icon="🛡"
              iconBg="#dbeafe"
              iconColor="#1d4ed8"
              title="개인정보는 암호화 우선"
              desc="건강·보험 데이터는 256-bit AES 암호화로 안전하게 보관됩니다."
            />
            <FeatureCard
              icon="⚡"
              iconBg="#d1fae5"
              iconColor="#059669"
              title="원클릭 데이터 연동"
              desc="CODEF 기반 본인인증 한 번으로 내 보험·진료 내역을 한 번에 불러옵니다."
            />
          </div>
        </section>

        {/* ── RIGHT : 폼 카드 ──────────────────────────── */}
        <section style={s.right}>
          <div style={s.formCard}>
            <header style={s.formHead}>
              <h2 style={s.formTitle}>{isLogin ? '다시 오신 것을 환영합니다' : '계정 만들기'}</h2>
              <p style={s.formSub}>
                {isLogin
                  ? '이메일로 로그인하고 내 건강·보험 현황을 확인하세요.'
                  : '몇 가지 정보만 입력하면 시작할 수 있어요.'}
              </p>
            </header>

            {/* 모드 탭 */}
            <div style={s.tabs}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{ ...s.tab, ...(isLogin ? s.tabActive : {}) }}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{ ...s.tab, ...(!isLogin ? s.tabActive : {}) }}
              >
                회원가입
              </button>
            </div>

            {/* 중복 이메일 배너 (회원가입 모드에서만) */}
            {!isLogin && duplicateEmail && (
              <div style={s.dupBanner}>
                <span style={{ fontSize: 18 }}>ℹ️</span>
                <div style={{ flex: 1 }}>
                  <div style={s.dupTitle}>이미 가입된 회원입니다</div>
                  <div style={s.dupDesc}>
                    <b>{duplicateEmail}</b> 계정이 이미 존재해요. 로그인해주세요.
                  </div>
                </div>
                <button type="button" onClick={goLoginWithEmail} style={s.dupBtn}>
                  로그인하러 가기 →
                </button>
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleSignup} style={s.form}>
              {!isLogin && (
                <Field label="이름" icon="👤">
                  <input
                    name="name"
                    value={form.name}
                    onChange={handle}
                    placeholder="홍길동"
                    style={s.input}
                    required
                  />
                </Field>
              )}

              <Field label="이메일" icon="✉">
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handle}
                  placeholder="you@example.com"
                  style={s.input}
                  required
                  autoComplete="email"
                />
              </Field>

              <Field label="비밀번호" icon="🔒">
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handle}
                  placeholder={isLogin ? '비밀번호' : '8자 이상'}
                  style={s.input}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </Field>

              {!isLogin && (
                <>
                  <Field label="비밀번호 확인" icon="🔒">
                    <input
                      name="passwordConfirm"
                      type="password"
                      value={form.passwordConfirm}
                      onChange={handle}
                      placeholder="비밀번호를 한 번 더 입력"
                      style={{
                        ...s.input,
                        borderColor: pwMatch ? '#22c55e' : pwMismatch ? '#ef4444' : '#e2e8f0',
                      }}
                      required
                      autoComplete="new-password"
                    />
                  </Field>
                  {pwMismatch && <div style={s.hintError}>비밀번호가 일치하지 않습니다.</div>}

                  <div style={s.row2}>
                    <Field label="생년월일" icon="🎂">
                      <input
                        name="birthDate"
                        type="date"
                        value={form.birthDate}
                        onChange={handle}
                        style={s.input}
                        required
                      />
                    </Field>
                    <Field label="성별" icon="⚧">
                      <select name="gender" value={form.gender} onChange={handle} style={s.input}>
                        <option value="M">남성</option>
                        <option value="F">여성</option>
                      </select>
                    </Field>
                  </div>

                  <label style={s.agree}>
                    <input type="checkbox" name="agree" checked={form.agree} onChange={handle} />
                    <span>
                      <a href="#terms" style={s.link} onClick={(e) => e.preventDefault()}>
                        서비스 이용약관
                      </a>{' '}
                      및{' '}
                      <a href="#privacy" style={s.link} onClick={(e) => e.preventDefault()}>
                        개인정보 처리방침
                      </a>
                      에 동의합니다.
                    </span>
                  </label>
                </>
              )}

              {error && <div style={s.error}>{error}</div>}

              <button type="submit" disabled={loading} style={{ ...s.cta, opacity: loading ? 0.7 : 1 }}>
                {loading ? '처리 중...' : isLogin ? '로그인 →' : '계정 만들기 →'}
              </button>
            </form>

            <div style={s.switchRow}>
              {isLogin ? (
                <>
                  아직 계정이 없으신가요?{' '}
                  <button type="button" onClick={() => switchMode('signup')} style={s.linkBtn}>
                    회원가입
                  </button>
                </>
              ) : (
                <>
                  이미 계정이 있으신가요?{' '}
                  <button type="button" onClick={() => switchMode('login')} style={s.linkBtn}>
                    로그인
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={s.securityBadge}>
            <span>🛡</span>
            <span>CODEF API · 256-bit AES 암호화 전송</span>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── 하위 컴포넌트 ────────────────────────────────────────
function Field({ label, icon, children }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>{label}</span>
      <div style={s.inputWrap}>
        <span style={s.inputIcon}>{icon}</span>
        {children}
      </div>
    </label>
  );
}

function FeatureCard({ icon, iconBg, iconColor, title, desc }) {
  return (
    <div style={s.feature}>
      <div style={{ ...s.featureIcon, background: iconBg, color: iconColor }}>{icon}</div>
      <div>
        <div style={s.featureTitle}>{title}</div>
        <div style={s.featureDesc}>{desc}</div>
      </div>
    </div>
  );
}

// ── 스타일 ───────────────────────────────────────────────
const s = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: '#f8fafc',
    overflow: 'hidden',
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  bgDecoLeft: {
    position: 'absolute',
    top: -160,
    left: -160,
    width: 420,
    height: 420,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,.10), transparent 70%)',
    pointerEvents: 'none',
  },
  bgDecoRight: {
    position: 'absolute',
    bottom: -180,
    right: -140,
    width: 460,
    height: 460,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,.10), transparent 70%)',
    pointerEvents: 'none',
  },
  split: {
    position: 'relative',
    maxWidth: 1200,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 40,
    padding: '60px 32px',
  },
  // LEFT
  left: { flex: '1 1 440px', maxWidth: 560, minWidth: 300 },
  brand: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48 },
  brandDot: {
    display: 'inline-block',
    width: 22,
    height: 22,
    borderRadius: 6,
    background: 'linear-gradient(135deg, #2563eb, #059669)',
  },
  brandText: { fontSize: 20, fontWeight: 800, color: '#0f766e', letterSpacing: -0.3 },
  headline: { fontSize: 40, fontWeight: 800, lineHeight: 1.2, margin: 0, letterSpacing: -0.8 },
  subcopy: { fontSize: 15, color: '#475569', lineHeight: 1.7, marginTop: 16, marginBottom: 32 },
  featureList: { display: 'flex', flexDirection: 'column', gap: 12 },
  feature: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    background: 'rgba(255,255,255,.7)',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: '14px 16px',
    backdropFilter: 'blur(6px)',
  },
  featureIcon: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
  },
  featureTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  featureDesc: { fontSize: 12.5, color: '#64748b', lineHeight: 1.55 },

  // RIGHT
  right: {
    flex: '0 1 440px',
    minWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  formCard: {
    width: '100%',
    background: '#fff',
    borderRadius: 20,
    padding: '32px 30px',
    boxShadow: '0 10px 40px rgba(15,23,42,.08)',
    border: '1px solid #eef2f7',
  },
  formHead: { marginBottom: 20 },
  formTitle: { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: -0.3 },
  formSub: { fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 0 },
  tabs: { display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 18 },
  tab: {
    flex: 1,
    padding: '8px 0',
    border: 'none',
    background: 'transparent',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#64748b',
    transition: 'all .15s',
  },
  tabActive: { background: '#fff', color: '#1d4ed8', boxShadow: '0 1px 4px rgba(0,0,0,.08)' },

  // 중복 배너
  dupBanner: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 14,
  },
  dupTitle: { fontSize: 13.5, fontWeight: 700, color: '#92400e', marginBottom: 2 },
  dupDesc: { fontSize: 12.5, color: '#854d0e', lineHeight: 1.5 },
  dupBtn: {
    flexShrink: 0,
    alignSelf: 'center',
    background: '#f59e0b',
    color: '#fff',
    border: 'none',
    padding: '7px 11px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase' },
  inputWrap: { position: 'relative' },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 14,
    color: '#94a3b8',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '11px 14px 11px 36px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 14,
    outline: 'none',
    background: '#f8fafc',
    boxSizing: 'border-box',
    transition: 'border-color .15s, background .15s',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  hintError: { fontSize: 12, color: '#dc2626', marginTop: -4 },

  agree: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 4 },
  link: { color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' },

  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#b91c1c',
    fontSize: 13,
  },

  cta: {
    marginTop: 4,
    padding: '13px',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(29,78,216,.30)',
    transition: 'transform .1s, box-shadow .15s',
  },

  switchRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #eef2f7',
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#1d4ed8',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  },

  securityBadge: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
};
