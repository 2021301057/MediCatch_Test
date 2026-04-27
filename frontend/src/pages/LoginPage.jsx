import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/services';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [signupStep, setSignupStep] = useState(1); // 1: 계정정보 / 2: 보험·건강기록 조회 / 3: SMS 인증
  const [sessionKey, setSessionKey] = useState('');

  const [form, setForm] = useState({
    name: '',
    loginId: '',          // 사이트 로그인 아이디 (= 내보험다보여 아이디 자동 연동)
    email: '',
    password: '',
    passwordConfirm: '',
    agree: false,
    identity: '',
    telecom: '0',
    phoneNo: '',
    authMethod: '0',
  });

  const [smsAuthNo, setSmsAuthNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicateEmail, setDuplicateEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    setError('');
    setFieldErrors({});
    setDuplicateEmail('');
    setSuccessMessage('');
    if (mode === 'signup') {
      setSignupStep(1);
      setSessionKey('');
      setSmsAuthNo('');
    }
  }, [mode]);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setFieldErrors({});
  };

  // ── 로그인 (아이디 + 비밀번호) ────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login({ loginId: form.loginId, password: form.password });
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step1: 계정정보 입력 → 검증만 하고 다음 단계로 ───────────
  const handleAccountNext = (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!form.name.trim()) {
      setFieldErrors({ name: '이름을 입력해주세요.' });
      return;
    }
    if (!form.loginId.trim()) {
      setFieldErrors({ loginId: '아이디를 입력해주세요.' });
      return;
    }
    if (form.loginId.length < 4) {
      setFieldErrors({ loginId: '아이디는 4자 이상으로 입력해주세요.' });
      return;
    }
    if (!form.email.trim()) {
      setFieldErrors({ email: '이메일을 입력해주세요.' });
      return;
    }
    if (form.password.length < 8) {
      setFieldErrors({ password: '비밀번호는 8자 이상 입력해주세요.' });
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setFieldErrors({ passwordConfirm: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    if (!form.agree) {
      setError('서비스 이용약관 및 개인정보 처리방침에 동의해주세요.');
      return;
    }

    setSignupStep(2);
  };

  // ── Step2: 보험·건강기록 조회 정보 → CODEF 1차 (실제 가입 시작) ──
  const handleConnectStart = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setDuplicateEmail('');

    const cleanIdentity = form.identity.replace(/-/g, '');
    if (cleanIdentity.length !== 13) {
      setFieldErrors({ identity: '주민등록번호 13자리를 입력해주세요.' });
      return;
    }
    if (!form.phoneNo.trim()) {
      setFieldErrors({ phoneNo: '전화번호를 입력해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.signupStep1({
        name: form.name,
        email: form.email,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        // 사이트 아이디(loginId)를 CODEF 아이디(id)로 그대로 사용 — 같은 값으로 통일
        id: form.loginId,
        identity: cleanIdentity,
        telecom: form.telecom,
        phoneNo: form.phoneNo,
        authMethod: form.authMethod,
      });

      setSessionKey(data.sessionKey);
      setSignupStep(3);
    } catch (err) {
      const msg = err.response?.data?.message || '';
      const fe = err.response?.data?.fieldErrors;

      if (msg === 'Email already exists') {
        setDuplicateEmail(form.email);
      } else if (fe && Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        if (!fe.general) setError(msg || '입력 정보를 확인해주세요.');
      } else {
        setError(msg || '연동 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step3: SMS / PASS 인증 확인 → 가입 완료 + 로그인 ──────────
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (form.authMethod === '0' && !smsAuthNo.trim()) {
      setFieldErrors({ smsAuthNo: 'SMS 인증번호를 입력해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.signupStep2({ sessionKey, smsAuthNo: smsAuthNo.trim() });
      setSuccessMessage('회원가입이 완료되었습니다!');
      setTimeout(() => {
        login(data.user, data.accessToken, data.refreshToken);
        navigate('/');
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || '';
      const fe = err.response?.data?.fieldErrors;
      if (fe && Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        if (!fe.smsAuthNo && !fe.general) setError(msg || '인증에 실패했습니다.');
      } else {
        setError(msg || '인증에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const goLoginWithLoginId = () => {
    setMode('login');
    setForm((f) => ({ ...f, password: '', passwordConfirm: '' }));
    setDuplicateEmail('');
  };

  const goPrev = () => {
    if (signupStep === 3) {
      setSignupStep(2);
      setSmsAuthNo('');
    } else if (signupStep === 2) {
      setSignupStep(1);
    }
    setError('');
    setFieldErrors({});
  };

  const isLogin = mode === 'login';
  const pwMatch = form.passwordConfirm && form.password === form.passwordConfirm;
  const pwMismatch = form.passwordConfirm && form.password !== form.passwordConfirm;

  // 단계별 헤더 텍스트
  const stepTitle = isLogin
    ? '다시 오신 것을 환영합니다'
    : signupStep === 1 ? '계정 만들기'
    : signupStep === 2 ? '보험·건강기록 조회 연동'
    : '본인 인증';

  const stepSub = isLogin
    ? '아이디로 로그인하고 내 건강·보험 현황을 확인하세요.'
    : signupStep === 1 ? '먼저 계정 정보를 입력해주세요. 아이디는 내보험다보여 인증에도 함께 사용됩니다.'
    : signupStep === 2 ? `아이디 "${form.loginId}" 계정에 보험·건강 데이터를 연동합니다.`
    : (form.authMethod === '0' ? 'SMS로 발송된 인증번호를 입력해주세요.' : 'PASS 앱에서 인증 요청을 수락해주세요.');

  return (
    <div style={s.page}>
      <div style={s.bgDecoLeft} />
      <div style={s.bgDecoRight} />

      <div style={s.split}>
        {/* ── LEFT ─────────────────────────── */}
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
            <FeatureCard icon="🛡" iconBg="#dbeafe" iconColor="#1d4ed8" title="개인정보는 암호화 우선" desc="건강·보험 데이터는 256-bit AES 암호화로 안전하게 보관됩니다." />
            <FeatureCard icon="⚡" iconBg="#d1fae5" iconColor="#059669" title="원클릭 데이터 연동" desc="CODEF 기반 본인인증 한 번으로 내 보험·진료 내역을 한 번에 불러옵니다." />
          </div>
        </section>

        {/* ── RIGHT ────────────────────────── */}
        <section style={s.right}>
          <div style={s.formCard}>
            <header style={s.formHead}>
              <h2 style={s.formTitle}>{stepTitle}</h2>
              <p style={s.formSub}>{stepSub}</p>
            </header>

            {/* 진행 표시 — 회원가입 단계에서만 */}
            {!isLogin && (
              <div style={s.stepper}>
                <StepDot n={1} active={signupStep >= 1} done={signupStep > 1} label="계정정보" />
                <StepLine done={signupStep > 1} />
                <StepDot n={2} active={signupStep >= 2} done={signupStep > 2} label="조회 연동" />
                <StepLine done={signupStep > 2} />
                <StepDot n={3} active={signupStep >= 3} done={false} label="본인 인증" />
              </div>
            )}

            {/* 탭 – 로그인/회원가입 (회원가입 step1에서만 노출) */}
            {(isLogin || signupStep === 1) && (
              <div style={s.tabs}>
                <button type="button" onClick={() => switchMode('login')} style={{ ...s.tab, ...(isLogin ? s.tabActive : {}) }}>로그인</button>
                <button type="button" onClick={() => switchMode('signup')} style={{ ...s.tab, ...(!isLogin ? s.tabActive : {}) }}>회원가입</button>
              </div>
            )}

            {/* 중복 이메일 배너 */}
            {!isLogin && duplicateEmail && (
              <div style={s.dupBanner}>
                <span style={{ fontSize: 18 }}>ℹ️</span>
                <div style={{ flex: 1 }}>
                  <div style={s.dupTitle}>이미 가입된 회원입니다</div>
                  <div style={s.dupDesc}><b>{duplicateEmail}</b> 계정이 이미 존재해요. 로그인해주세요.</div>
                </div>
                <button type="button" onClick={goLoginWithLoginId} style={s.dupBtn}>로그인하러 가기 →</button>
              </div>
            )}

            {/* 가입 성공 메시지 */}
            {successMessage && <div style={s.successMsg}>{successMessage}</div>}

            {/* ── 로그인 폼 (아이디로 로그인) ── */}
            {isLogin && (
              <form onSubmit={handleLogin} style={s.form}>
                <Field label="아이디" icon="🪪">
                  <input name="loginId" value={form.loginId} onChange={handle} placeholder="가입 시 등록한 아이디" style={s.input} required autoComplete="username" />
                </Field>
                <Field label="비밀번호" icon="🔒">
                  <input name="password" type="password" value={form.password} onChange={handle} placeholder="비밀번호" style={s.input} required autoComplete="current-password" />
                </Field>
                {error && <div style={s.error}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...s.cta, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '처리 중...' : '로그인 →'}
                </button>
              </form>
            )}

            {/* ── 회원가입 Step1: 계정정보 ── */}
            {!isLogin && signupStep === 1 && (
              <form onSubmit={handleAccountNext} style={s.form}>
                <Field label="이름" icon="👤" error={fieldErrors.name}>
                  <input name="name" value={form.name} onChange={handle} placeholder="홍길동" style={{ ...s.input, ...(fieldErrors.name ? s.inputError : {}) }} required />
                </Field>

                <Field label="아이디 (내보험다보여 아이디와 동일하게 사용)" icon="🪪" error={fieldErrors.loginId}>
                  <input name="loginId" value={form.loginId} onChange={handle} placeholder="영문/숫자 4자 이상" style={{ ...s.input, ...(fieldErrors.loginId ? s.inputError : {}) }} required autoComplete="username" />
                </Field>

                <Field label="이메일 (인증/알림용)" icon="✉" error={fieldErrors.email}>
                  <input name="email" type="email" value={form.email} onChange={handle} placeholder="you@example.com" style={{ ...s.input, ...(fieldErrors.email ? s.inputError : {}) }} required autoComplete="email" />
                </Field>

                <div style={s.row2}>
                  <Field label="비밀번호" icon="🔒" error={fieldErrors.password}>
                    <input name="password" type="password" value={form.password} onChange={handle} placeholder="8자 이상" style={{ ...s.input, ...(fieldErrors.password ? s.inputError : {}) }} required autoComplete="new-password" />
                  </Field>
                  <Field label="비밀번호 확인" icon="🔒" error={fieldErrors.passwordConfirm}>
                    <input
                      name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={handle}
                      placeholder="비밀번호 재입력"
                      style={{
                        ...s.input,
                        borderColor: pwMatch ? '#22c55e' : pwMismatch || fieldErrors.passwordConfirm ? '#ef4444' : '#e2e8f0',
                      }}
                      required autoComplete="new-password"
                    />
                  </Field>
                </div>

                <label style={s.agree}>
                  <input type="checkbox" name="agree" checked={form.agree} onChange={handle} />
                  <span>
                    <a href="#terms" style={s.link} onClick={(e) => e.preventDefault()}>서비스 이용약관</a>
                    {' '}및{' '}
                    <a href="#privacy" style={s.link} onClick={(e) => e.preventDefault()}>개인정보 처리방침</a>에 동의합니다.
                  </span>
                </label>

                {error && <div style={s.error}>{error}</div>}

                <button type="submit" style={s.cta}>
                  다음 →
                </button>
              </form>
            )}

            {/* ── 회원가입 Step2: 보험·건강기록 조회 연동 ── */}
            {!isLogin && signupStep === 2 && (
              <form onSubmit={handleConnectStart} style={s.form}>
                {/* 자동 연동 정보 표시 (수정 불가) */}
                <div style={s.linkedEmail}>
                  <span style={s.linkedEmailLabel}>이 정보는 다음 계정에 연동됩니다</span>
                  <div style={s.linkedEmailRow}>
                    <span style={{ fontSize: 14 }}>🪪</span>
                    <span style={s.linkedEmailValue}>{form.loginId}</span>
                    <span style={s.linkedTag}>아이디</span>
                  </div>
                  <div style={{ ...s.linkedEmailRow, marginTop: 4 }}>
                    <span style={{ fontSize: 14 }}>✉</span>
                    <span style={{ ...s.linkedEmailValue, fontSize: 12.5, fontWeight: 500, color: '#475569' }}>{form.email}</span>
                    <button type="button" onClick={() => setSignupStep(1)} style={s.linkedEmailEdit}>변경</button>
                  </div>
                </div>

                {/* 내보험다보여 아이디 — 자동 채움, read-only */}
                <Field label="내보험다보여 아이디 (자동 연동됨)" icon="🪪">
                  <input
                    value={form.loginId}
                    readOnly
                    style={{ ...s.input, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                  />
                </Field>

                <Field label="주민등록번호 (13자리)" icon="🔢" error={fieldErrors.identity}>
                  <input name="identity" type="password" value={form.identity} onChange={handle} placeholder="하이픈(-) 없이 13자리 입력" maxLength={13} style={{ ...s.input, ...(fieldErrors.identity ? s.inputError : {}) }} required autoComplete="off" />
                </Field>

                <div style={s.row2}>
                  <Field label="통신사" icon="📶" error={fieldErrors.telecom}>
                    <select name="telecom" value={form.telecom} onChange={handle} style={s.input}>
                      <option value="0">SKT</option>
                      <option value="1">KT</option>
                      <option value="2">LG U+</option>
                      <option value="3">알뜰폰(SKT)</option>
                      <option value="4">알뜰폰(KT)</option>
                      <option value="5">알뜰폰(LG U+)</option>
                    </select>
                  </Field>
                  <Field label="인증방법" icon="🔐" error={fieldErrors.authMethod}>
                    <select name="authMethod" value={form.authMethod} onChange={handle} style={s.input}>
                      <option value="0">SMS 인증</option>
                      <option value="1">PASS 앱 인증</option>
                    </select>
                  </Field>
                </div>

                <Field label="전화번호" icon="📱" error={fieldErrors.phoneNo}>
                  <input name="phoneNo" value={form.phoneNo} onChange={handle} placeholder="01012345678 (- 없이)" style={{ ...s.input, ...(fieldErrors.phoneNo ? s.inputError : {}) }} required />
                </Field>

                {fieldErrors.general && <div style={s.error}>{fieldErrors.general}</div>}
                {fieldErrors.loginId && <div style={s.error}>{fieldErrors.loginId}</div>}
                {error && <div style={s.error}>{error}</div>}

                <button type="submit" disabled={loading} style={{ ...s.cta, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '처리 중...' : '인증 요청 →'}
                </button>
                <button type="button" onClick={goPrev} style={s.backBtn}>
                  ← 이전 단계
                </button>
              </form>
            )}

            {/* ── 회원가입 Step3: SMS / PASS 인증 ── */}
            {!isLogin && signupStep === 3 && (
              <form onSubmit={handleVerify} style={s.form}>
                {form.authMethod === '0' ? (
                  <Field label="SMS 인증번호" icon="💬" error={fieldErrors.smsAuthNo}>
                    <input
                      value={smsAuthNo}
                      onChange={(e) => {
                        setSmsAuthNo(e.target.value);
                        if (fieldErrors.smsAuthNo) setFieldErrors((prev) => { const next = { ...prev }; delete next.smsAuthNo; return next; });
                      }}
                      placeholder="SMS로 받은 인증번호 입력"
                      maxLength={8}
                      style={{ ...s.input, ...(fieldErrors.smsAuthNo ? s.inputError : {}) }}
                      autoFocus
                    />
                  </Field>
                ) : (
                  <div style={s.passNotice}>
                    <span style={{ fontSize: 36, lineHeight: 1 }}>📲</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>PASS 앱을 확인해주세요</div>
                      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>휴대폰 PASS 앱에서 인증 요청을 수락한 후 아래 버튼을 눌러주세요.</div>
                    </div>
                  </div>
                )}

                {fieldErrors.smsAuthNo && <div style={s.error}>{fieldErrors.smsAuthNo}</div>}
                {fieldErrors.general && <div style={s.error}>{fieldErrors.general}</div>}
                {error && <div style={s.error}>{error}</div>}

                <button type="submit" disabled={loading} style={{ ...s.cta, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '처리 중...' : '인증 완료 →'}
                </button>
                <button type="button" onClick={goPrev} style={s.backBtn}>
                  ← 다시 입력하기
                </button>
              </form>
            )}

            <div style={s.switchRow}>
              {isLogin ? (
                <>아직 계정이 없으신가요?{' '}<button type="button" onClick={() => switchMode('signup')} style={s.linkBtn}>회원가입</button></>
              ) : (
                <>이미 계정이 있으신가요?{' '}<button type="button" onClick={() => switchMode('login')} style={s.linkBtn}>로그인</button></>
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
function Field({ label, icon, children, error }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>{label}</span>
      <div style={s.inputWrap}>
        <span style={s.inputIcon}>{icon}</span>
        {children}
      </div>
      {error && <span style={s.fieldError}>{error}</span>}
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

function StepDot({ n, active, done, label }) {
  const bg = done ? '#0ea371' : active ? '#1d4ed8' : '#e2e8f0';
  const fg = done || active ? '#fff' : '#94a3b8';
  return (
    <div style={s.stepDotWrap}>
      <div style={{ ...s.stepDot, background: bg, color: fg }}>{done ? '✓' : n}</div>
      <span style={{ ...s.stepDotLabel, color: active ? '#0f172a' : '#94a3b8', fontWeight: active ? 700 : 500 }}>{label}</span>
    </div>
  );
}

function StepLine({ done }) {
  return <div style={{ ...s.stepLine, background: done ? '#0ea371' : '#e2e8f0' }} />;
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
    position: 'absolute', top: -160, left: -160, width: 420, height: 420,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,.10), transparent 70%)',
    pointerEvents: 'none',
  },
  bgDecoRight: {
    position: 'absolute', bottom: -180, right: -140, width: 460, height: 460,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,.10), transparent 70%)',
    pointerEvents: 'none',
  },
  split: {
    position: 'relative', maxWidth: 1200, margin: '0 auto', minHeight: '100vh',
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: 40, padding: '60px 32px',
  },

  // LEFT
  left: { flex: '1 1 440px', maxWidth: 560, minWidth: 300 },
  brand: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48 },
  brandDot: { display: 'inline-block', width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #2563eb, #059669)' },
  brandText: { fontSize: 20, fontWeight: 800, color: '#0f766e', letterSpacing: -0.3 },
  headline: { fontSize: 40, fontWeight: 800, lineHeight: 1.2, margin: 0, letterSpacing: -0.8 },
  subcopy: { fontSize: 15, color: '#475569', lineHeight: 1.7, marginTop: 16, marginBottom: 32 },
  featureList: { display: 'flex', flexDirection: 'column', gap: 12 },
  feature: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: 'rgba(255,255,255,.7)', border: '1px solid #e2e8f0',
    borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(6px)',
  },
  featureIcon: { flexShrink: 0, width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 },
  featureTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  featureDesc: { fontSize: 12.5, color: '#64748b', lineHeight: 1.55 },

  // RIGHT
  right: { flex: '0 1 460px', minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  formCard: { width: '100%', background: '#fff', borderRadius: 20, padding: '32px 30px', boxShadow: '0 10px 40px rgba(15,23,42,.08)', border: '1px solid #eef2f7' },
  formHead: { marginBottom: 20 },
  formTitle: { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: -0.3 },
  formSub: { fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 0 },

  // Stepper
  stepper: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 20 },
  stepDotWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto' },
  stepDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, transition: 'all .15s' },
  stepDotLabel: { fontSize: 11, letterSpacing: -0.2 },
  stepLine: { flex: 1, height: 2, marginBottom: 18, transition: 'background .15s' },

  tabs: { display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 18 },
  tab: { flex: 1, padding: '8px 0', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#64748b', transition: 'all .15s' },
  tabActive: { background: '#fff', color: '#1d4ed8', boxShadow: '0 1px 4px rgba(0,0,0,.08)' },

  // Linked info box (Step2 상단)
  linkedEmail: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '12px 14px', marginBottom: 4 },
  linkedEmailLabel: { fontSize: 11, fontWeight: 700, color: '#0369a1', letterSpacing: 0.4, textTransform: 'uppercase' },
  linkedEmailRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  linkedEmailValue: { flex: 1, fontSize: 14, fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' },
  linkedEmailEdit: { background: 'none', border: 'none', color: '#0369a1', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' },
  linkedTag: { fontSize: 10, fontWeight: 700, color: '#0369a1', background: '#dbeafe', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3 },

  // 중복 배너
  dupBanner: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px', marginBottom: 14 },
  dupTitle: { fontSize: 13.5, fontWeight: 700, color: '#92400e', marginBottom: 2 },
  dupDesc: { fontSize: 12.5, color: '#854d0e', lineHeight: 1.5 },
  dupBtn: { flexShrink: 0, alignSelf: 'center', background: '#f59e0b', color: '#fff', border: 'none', padding: '7px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },

  // 성공 메시지
  successMsg: { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '12px 16px', color: '#15803d', fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 14 },

  // PASS 안내
  passNotice: { display: 'flex', gap: 14, alignItems: 'flex-start', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '18px 16px' },

  // 폼
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldError: { fontSize: 11.5, color: '#dc2626', marginTop: 2 },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', pointerEvents: 'none' },
  input: { width: '100%', padding: '11px 14px 11px 36px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box', transition: 'border-color .15s, background .15s' },
  inputError: { borderColor: '#ef4444' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  agree: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 4 },
  link: { color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', color: '#b91c1c', fontSize: 13 },
  cta: { marginTop: 4, padding: '13px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px rgba(29,78,216,.30)', transition: 'transform .1s, box-shadow .15s' },
  backBtn: { padding: '10px', background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 13.5, fontWeight: 600, color: '#64748b', cursor: 'pointer' },
  switchRow: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #eef2f7', fontSize: 13, color: '#64748b', textAlign: 'center' },
  linkBtn: { background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 },
  securityBadge: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#64748b', marginTop: 4 },
};
