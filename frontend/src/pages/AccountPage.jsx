import React, { useMemo, useRef, useState } from 'react';
import { authAPI } from '../api/services';
import useAuthStore from '../store/authStore';
import ProfileAvatar from '../components/common/ProfileAvatar';

// 서비스 공통 아이콘 스타일(인라인 SVG, stroke 기반)과 동일하게 구성
const Icon = ({ children, size = 16 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>
    {children}
  </svg>
);

const EYE_ICON = {
  show: (<><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2" /></>),
  hide: (<><path d="M2 2l12 12" /><path d="M6.6 6.6a2 2 0 002.8 2.8" /><path d="M4 4.6C2.5 5.7 1 8 1 8s2.6 5 7 5c1.2 0 2.3-.3 3.3-.7" /><path d="M7.1 3.1A6 6 0 018 3c4.4 0 7 5 7 5s-.7 1.3-1.9 2.5" /></>),
};

const PW_TOGGLE_STYLE = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, margin: 0, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', lineHeight: 0 };

// 비밀번호 입력 + 표시/숨김 토글 (서비스 공통 아이콘 스타일)
function PasswordInput({ style, onChange, ...props }) {
  const [show, setShow] = useState(false);
  // 토글을 켜면 type=text라 한글 IME가 동작하므로 비ASCII(한글 등)를 제거해 차단.
  // 단, 조합(composition) 중에는 값을 건드리지 않고 조합 종료 시에만 정리해 기존 글자 손실을 방지.
  const composing = useRef(false);
  const sanitize = (e) => {
    const clean = e.target.value.replace(/[^\x00-\x7F]/g, '');
    if (clean !== e.target.value) e.target.value = clean;
    onChange?.(e);
  };
  const handleChange = (e) => {
    if (composing.current) { onChange?.(e); return; }
    sanitize(e);
  };
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input {...props}
        onChange={handleChange}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(e) => { composing.current = false; sanitize(e); }}
        type={show ? 'text' : 'password'} style={{ ...style, paddingRight: 42 }} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        style={PW_TOGGLE_STYLE}
        tabIndex={-1}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
        title={show ? '비밀번호 숨기기' : '비밀번호 표시'}
      >
        <Icon size={16}>{show ? EYE_ICON.hide : EYE_ICON.show}</Icon>
      </button>
    </div>
  );
}

const cleanDigits = (value) => (value || '').replace(/\D/g, '');

const ALLOWED_EMAIL_DOMAINS = ['naver.com','hanmail.net','daum.net','nate.com','korea.kr',
  'kcredit.or.kr','korea.com','yahoo.com','goe.go.kr','chol.com',
  'sen.go.kr','gyo6.net','jnu.ac.kr','kakao.com'];

const AVATAR_OPTIONS = [
  { key: 'bot', label: '봇' },
  { key: 'medi', label: '메디' },
  { key: 'shield', label: '쉴드' },
  { key: 'leaf', label: '리프' },
  { key: 'pill', label: '필' },
  { key: 'sparkle', label: '반짝' },
];

const TELECOM_OPTIONS = [
  { value: '0', label: 'SKT' },
  { value: '1', label: 'KT' },
  { value: '2', label: 'LG U+' },
  { value: '3', label: '알뜰폰(SKT)' },
  { value: '4', label: '알뜰폰(KT)' },
  { value: '5', label: '알뜰폰(LG U+)' },
];

const loadAvatar = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('medicatchAvatar') || 'null');
    return AVATAR_OPTIONS.find((option) => option.key === saved?.key) || AVATAR_OPTIONS[0];
  } catch {
    return AVATAR_OPTIONS[0];
  }
};

const validatePasswordPolicy = (password, codefId = '') => {
  if (password.length < 9 || password.length > 20) return '비밀번호는 9자 이상 20자 이하여야 합니다.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*?_~[\]+='|(){}:;"<>,/\-]/.test(password)) {
    return '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.';
  }
  for (let i = 0; i < password.length - 2; i += 1) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      return '동일한 문자/숫자를 3자 이상 연속 사용할 수 없습니다.';
    }
    const d1 = password.charCodeAt(i + 1) - password.charCodeAt(i);
    const d2 = password.charCodeAt(i + 2) - password.charCodeAt(i + 1);
    if ((d1 === 1 && d2 === 1) || (d1 === -1 && d2 === -1)) {
      return '연속되는 문자/숫자를 3자 이상 사용할 수 없습니다.';
    }
  }
  if (codefId && password.toLowerCase().includes(codefId.toLowerCase())) {
    return '비밀번호에 아이디를 포함할 수 없습니다.';
  }
  return '';
};

const errMessage = (e, fallback) =>
  e?.response?.data?.message
  || e?.response?.data?.fieldErrors?.[0]?.message
  || fallback;

export default function AccountPage() {
  const { user, setUser } = useAuthStore();
  const currentUser = useMemo(() => ({
    userId: user?.userId || Number(localStorage.getItem('userId') || 0),
    codefId: user?.codefId || localStorage.getItem('codefId') || '',
    name: user?.name || localStorage.getItem('userName') || '',
    email: user?.email || localStorage.getItem('email') || '',
    phoneNo: user?.phoneNo || localStorage.getItem('phoneNo') || '',
  }), [user]);

  const [avatar, setAvatar] = useState(loadAvatar);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const [activeAction, setActiveAction] = useState('password'); // 'password' | 'email'
  const [step, setStep] = useState(1); // 1=입력/인증요청, 2=인증번호 확인, 3=이메일임시비번(비번)/이메일인증번호(이메일)
  const [sessionKey, setSessionKey] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [emailAuthNo, setEmailAuthNo] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', passwordConfirm: '',
    identityFront: '', identityBack: '', telecom: '0',
    phoneNo: currentUser.phoneNo || '', authMethod: '0',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');

  const isPass = form.authMethod === '1';
  const setField = (patch) => { setForm((f) => ({ ...f, ...patch })); setMessage(''); };

  const updateAvatar = (nextAvatar) => {
    setAvatar(nextAvatar);
    localStorage.setItem('medicatchAvatar', JSON.stringify(nextAvatar));
    window.dispatchEvent(new CustomEvent('medicatch-avatar-change', { detail: nextAvatar }));
    setShowAvatarPicker(false);
  };

  const resetActionState = (nextAction) => {
    setActiveAction(nextAction);
    setStep(1);
    setSessionKey('');
    setSmsCode('');
    setTempPassword('');
    setEmailAuthNo('');
    setMessage('');
    setForm({ email: '', password: '', passwordConfirm: '',
      identityFront: '', identityBack: '', telecom: '0',
      phoneNo: currentUser.phoneNo || '', authMethod: '0' });
  };

  // ── Step1: 입력값 검증 후 CODEF 인증요청(SMS 발송 / PASS 트리거) ──
  const handleRequest = async () => {
    const identity = cleanDigits(`${form.identityFront}${form.identityBack}`);
    if (identity.length !== 13) { setMessage('주민등록번호 13자리를 정확히 입력해주세요.'); return; }
    if (cleanDigits(form.phoneNo).length < 10) { setMessage('휴대폰번호를 정확히 입력해주세요.'); return; }

    if (activeAction === 'email') {
      const email = form.email.trim();
      const domain = email.split('@')[1]?.toLowerCase();
      if (!email.includes('@') || !domain || !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        setMessage('사용 가능한 이메일 도메인이 아닙니다. (naver.com, daum.net, kakao.com 등)'); return;
      }
    } else {
      if (form.password !== form.passwordConfirm) { setMessage('비밀번호가 일치하지 않습니다.'); return; }
      const policyErr = validatePasswordPolicy(form.password, currentUser.codefId);
      if (policyErr) { setMessage(policyErr); return; }
    }

    setLoading('request');
    try {
      const base = {
        identity, telecom: form.telecom,
        phoneNo: cleanDigits(form.phoneNo), authMethod: form.authMethod,
      };
      const res = activeAction === 'email'
        ? await authAPI.changeEmailStep1({ ...base, email: form.email.trim() })
        : await authAPI.changePwdStep1({ ...base, password: form.password, passwordConfirm: form.passwordConfirm });
      setSessionKey(res?.sessionKey || '');
      setStep(2);
      setMessage(isPass ? 'PASS 앱에서 인증을 완료한 뒤 [변경]을 눌러주세요.' : '인증번호를 발송했습니다.');
    } catch (e) {
      setMessage(errMessage(e, '인증 요청에 실패했습니다.'));
    } finally {
      setLoading('');
    }
  };

  // ── Step2: 인증번호 확인 ──
  const handleConfirm = async () => {
    if (!isPass && cleanDigits(smsCode).length < 6) { setMessage('인증번호 6자리를 입력해주세요.'); return; }
    setLoading('confirm');
    try {
      const payload = { sessionKey, smsAuthNo: isPass ? '' : smsCode.trim() };
      if (activeAction === 'email') {
        const res = await authAPI.changeEmailStep2(payload);
        if (res?.needsStep3) {
          // 새 이메일로 인증번호 발송됨 → step3(이메일 인증번호)으로 이동 (세션키 유지)
          setStep(3);
          setEmailAuthNo('');
          setMessage(res.message || '변경할 이메일 주소로 인증번호를 발송했습니다. 메일을 확인 후 입력해주세요.');
        } else {
          const nextEmail = form.email.trim();
          localStorage.setItem('email', nextEmail);
          setUser({ ...currentUser, email: nextEmail });
          setMessage('이메일이 변경되었습니다.');
          setStep(1); setSessionKey(''); setSmsCode('');
          setForm((f) => ({ ...f, email: '', identityFront: '', identityBack: '' }));
        }
      } else {
        const res = await authAPI.changePwdStep2(payload);
        if (res?.needsStep3) {
          // 이메일로 임시비번 발송됨 → step3으로 이동 (세션키 유지)
          setStep(3);
          setTempPassword('');
          setMessage(res.message || '휴대폰으로 임시비밀번호를 발송했습니다. 확인 후 입력해주세요.');
        } else {
          setMessage('비밀번호가 변경되었습니다.');
          setStep(1); setSessionKey(''); setSmsCode('');
          setForm((f) => ({ ...f, password: '', passwordConfirm: '', identityFront: '', identityBack: '' }));
        }
      }
    } catch (e) {
      setMessage(errMessage(e, '인증에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setLoading('');
    }
  };

  // ── Step3: 이메일 임시비번 확인 → 최종 비밀번호 변경 완료 ──
  const handleConfirmStep3 = async () => {
    if (!tempPassword.trim()) { setMessage('휴대폰으로 받은 임시비밀번호를 입력해주세요.'); return; }
    setLoading('step3');
    try {
      await authAPI.changePwdStep3({ sessionKey, tempPassword: tempPassword.trim() });
      setMessage('비밀번호가 변경되었습니다.');
      setStep(1); setSessionKey(''); setSmsCode(''); setTempPassword('');
      setForm((f) => ({ ...f, password: '', passwordConfirm: '', identityFront: '', identityBack: '' }));
    } catch (e) {
      setMessage(errMessage(e, '임시비밀번호가 올바르지 않습니다. 휴대폰 문자를 다시 확인해주세요.'));
    } finally {
      setLoading('');
    }
  };

  // ── Step3(이메일): 새 이메일로 받은 인증번호 확인 → 최종 이메일 변경 완료 ──
  const handleEmailConfirmStep3 = async () => {
    if (!emailAuthNo.trim()) { setMessage('이메일로 받은 인증번호를 입력해주세요.'); return; }
    setLoading('step3');
    try {
      await authAPI.changeEmailStep3({ sessionKey, emailAuthNo: emailAuthNo.trim() });
      const nextEmail = form.email.trim();
      localStorage.setItem('email', nextEmail);
      setUser({ ...currentUser, email: nextEmail });
      setMessage('이메일이 변경되었습니다.');
      setStep(1); setSessionKey(''); setSmsCode(''); setEmailAuthNo('');
      setForm((f) => ({ ...f, email: '', identityFront: '', identityBack: '' }));
    } catch (e) {
      setMessage(errMessage(e, '인증번호가 올바르지 않습니다. 메일을 다시 확인해주세요.'));
    } finally {
      setLoading('');
    }
  };

  const step2Locked = step === 2 || step === 3;

  return (
    <div className="mc-page mc-account-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">내 로그인 정보</div>
          <div className="mc-page-subtitle">본인확인 후 이메일과 비밀번호를 변경할 수 있어요.</div>
        </div>
      </div>

      <div className="mc-account-layout">
        <section className="mc-card mc-account-summary-card">
          <div className="mc-card-body">
            <div className="mc-account-profile-head">
              <div className="mc-account-avatar-zone">
                <button
                  type="button"
                  className="mc-profile-avatar-button mc-profile-avatar-button-lg"
                  onClick={() => setShowAvatarPicker((v) => !v)}
                  aria-label="프로필 캐릭터 변경"
                  title="프로필 캐릭터 변경"
                >
                  <ProfileAvatar type={avatar.key} size={48} />
                  <span className="mc-avatar-edit-badge" aria-hidden="true">✎</span>
                </button>
                {showAvatarPicker && (
                  <div className="mc-avatar-picker">
                    <div className="mc-avatar-picker-title">프로필 선택</div>
                    <div className="mc-avatar-picker-grid">
                      {AVATAR_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`mc-avatar-choice ${avatar.key === option.key ? 'active' : ''}`}
                          onClick={() => updateAvatar(option)}
                          aria-label={`${option.label} 프로필`}
                        >
                          <span className="mc-avatar-choice-icon">
                            <ProfileAvatar type={option.key} size={38} />
                          </span>
                          <em>{option.label}</em>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h2 className="mc-account-profile-name">{currentUser.name || '사용자'}</h2>
                <p className="mc-account-profile-id">{currentUser.codefId || '-'}</p>
              </div>
            </div>
            <div className="mc-account-info-list compact">
              <InfoRow label="아이디" value={currentUser.codefId || '-'} />
              <InfoRow label="이메일" value={currentUser.email || '-'} />
              <InfoRow label="전화번호" value={currentUser.phoneNo || '-'} />
            </div>
          </div>
        </section>

        <section className="mc-card mc-account-security-card">
          <div className="mc-card-body">
            <div className="mc-account-security-head">
              <div>
                <h2 className="mc-account-section-title">로그인 정보 변경</h2>
              </div>
              <div className="mc-account-tabs">
                <button type="button" className={activeAction === 'password' ? 'active' : ''} onClick={() => resetActionState('password')}>비밀번호</button>
                <button type="button" className={activeAction === 'email' ? 'active' : ''} onClick={() => resetActionState('email')}>이메일</button>
              </div>
            </div>

            {/* 1) 변경할 값 입력 */}
            {activeAction === 'email' ? (
              <div className="mc-account-form compact">
                <label className="mc-account-label">변경할 이메일</label>
                <input className="mc-input" type="email" value={form.email} disabled={step2Locked}
                  onChange={(e) => setField({ email: e.target.value })} placeholder="new@example.com" />
              </div>
            ) : (
              <div className="mc-account-form compact">
                <div className="mc-grid mc-grid-2">
                  <div>
                    <label className="mc-account-label">새 비밀번호</label>
                    <PasswordInput className="mc-input" value={form.password} disabled={step2Locked}
                      onChange={(e) => setField({ password: e.target.value })} placeholder="9~20자, 영문+숫자+특수문자" />
                  </div>
                  <div>
                    <label className="mc-account-label">비밀번호 확인</label>
                    <PasswordInput className="mc-input" value={form.passwordConfirm} disabled={step2Locked}
                      onChange={(e) => setField({ passwordConfirm: e.target.value })} placeholder="비밀번호 재입력" />
                  </div>
                </div>
              </div>
            )}

            {/* 2) 본인인증 정보 */}
            <div className="mc-phone-auth-box">
              <div className="mc-identity-auth-grid">
                <div>
                  <label className="mc-account-label">주민등록번호</label>
                  <div className="mc-identity-split">
                    <input className="mc-input" value={form.identityFront} disabled={step2Locked} inputMode="numeric"
                      onChange={(e) => setField({ identityFront: cleanDigits(e.target.value).slice(0, 6) })} placeholder="앞 6자리" />
                    <span>-</span>
                    <input className="mc-input" type="password" value={form.identityBack} disabled={step2Locked} inputMode="numeric"
                      onChange={(e) => setField({ identityBack: cleanDigits(e.target.value).slice(0, 7) })} placeholder="뒤 7자리" />
                  </div>
                </div>
                <div>
                  <label className="mc-account-label">통신사</label>
                  <select className="mc-input" value={form.telecom} disabled={step2Locked}
                    onChange={(e) => setField({ telecom: e.target.value })}>
                    {TELECOM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mc-account-label">휴대폰번호</label>
                  <input className="mc-input" value={form.phoneNo} disabled={step2Locked} inputMode="tel"
                    onChange={(e) => setField({ phoneNo: e.target.value })} placeholder="01012345678" />
                </div>
                <div>
                  <label className="mc-account-label">인증방식</label>
                  <select className="mc-input" value={form.authMethod} disabled={step2Locked}
                    onChange={(e) => setField({ authMethod: e.target.value })}>
                    <option value="0">SMS 인증</option>
                    <option value="1">PASS 인증</option>
                  </select>
                </div>
                {step === 2 && !isPass && (
                  <div>
                    <label className="mc-account-label">인증번호</label>
                    <input className="mc-input" value={smsCode} inputMode="numeric" maxLength={6}
                      onChange={(e) => { setSmsCode(e.target.value); setMessage(''); }} placeholder="인증번호 6자리" />
                  </div>
                )}
                {step === 3 && activeAction === 'password' && (
                  <div>
                    <label className="mc-account-label">휴대폰 임시비밀번호</label>
                    <input className="mc-input" type="text" value={tempPassword}
                      onChange={(e) => { setTempPassword(e.target.value); setMessage(''); }}
                      placeholder="휴대폰으로 받은 임시비밀번호 입력" autoComplete="off" />
                  </div>
                )}
                {step === 3 && activeAction === 'email' && (
                  <div>
                    <label className="mc-account-label">이메일 인증번호</label>
                    <input className="mc-input" value={emailAuthNo} inputMode="numeric"
                      onChange={(e) => { setEmailAuthNo(e.target.value); setMessage(''); }}
                      placeholder="새 이메일로 받은 인증번호 입력" autoComplete="off" />
                  </div>
                )}
              </div>

              <div className="mc-account-actions split">
                {step === 1 && (
                  <button className="mc-btn mc-btn-primary mc-account-submit" type="button"
                    onClick={handleRequest} disabled={loading === 'request'}>
                    {loading === 'request' ? '요청 중…' : (isPass ? 'PASS 인증요청' : '인증번호 받기')}
                  </button>
                )}
                {step === 2 && (
                  <>
                    <button className="mc-btn mc-account-ghost-btn" type="button"
                      onClick={() => resetActionState(activeAction)} disabled={loading === 'confirm'}>취소</button>
                    <button className="mc-btn mc-btn-primary mc-account-submit" type="button"
                      onClick={handleConfirm} disabled={loading === 'confirm'}>
                      {loading === 'confirm' ? '처리 중…' : '확인'}
                    </button>
                  </>
                )}
                {step === 3 && activeAction === 'password' && (
                  <>
                    <button className="mc-btn mc-account-ghost-btn" type="button"
                      onClick={() => resetActionState(activeAction)} disabled={loading === 'step3'}>취소</button>
                    <button className="mc-btn mc-btn-primary mc-account-submit" type="button"
                      onClick={handleConfirmStep3} disabled={loading === 'step3'}>
                      {loading === 'step3' ? '처리 중…' : '비밀번호 변경'}
                    </button>
                  </>
                )}
                {step === 3 && activeAction === 'email' && (
                  <>
                    <button className="mc-btn mc-account-ghost-btn" type="button"
                      onClick={() => resetActionState(activeAction)} disabled={loading === 'step3'}>취소</button>
                    <button className="mc-btn mc-btn-primary mc-account-submit" type="button"
                      onClick={handleEmailConfirmStep3} disabled={loading === 'step3'}>
                      {loading === 'step3' ? '처리 중…' : '이메일 변경'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {message && <div className="mc-account-message">{message}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="mc-account-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
