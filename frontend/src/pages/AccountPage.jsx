import React, { useMemo, useState } from 'react';
import { authAPI } from '../api/services';
import useAuthStore from '../store/authStore';
import ProfileAvatar from '../components/common/ProfileAvatar';

const cleanDigits = (value) => value.replace(/\D/g, '');

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

export default function AccountPage() {
  const { user, setUser } = useAuthStore();
  const currentUser = useMemo(() => ({
    userId: user?.userId || Number(localStorage.getItem('userId') || 0),
    codefId: user?.codefId || localStorage.getItem('codefId') || '',
    name: user?.name || localStorage.getItem('userName') || '',
    email: user?.email || localStorage.getItem('email') || '',
    phoneNo: user?.phoneNo || localStorage.getItem('phoneNo') || '',
    identity: localStorage.getItem('identity13') || '',
  }), [user]);

  const [activeAction, setActiveAction] = useState('password');
  const [phoneAuth, setPhoneAuth] = useState({ name: currentUser.name, identityFront: '', identityBack: '', phoneNo: currentUser.phoneNo, code: '', requested: false, verified: false, authSessionId: '' });
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', passwordConfirm: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');
  const [avatar, setAvatar] = useState(loadAvatar);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const updateAvatar = (nextAvatar) => {
    setAvatar(nextAvatar);
    localStorage.setItem('medicatchAvatar', JSON.stringify(nextAvatar));
    window.dispatchEvent(new CustomEvent('medicatch-avatar-change', { detail: nextAvatar }));
    setShowAvatarPicker(false);
  };

  const resetActionState = (nextAction) => {
    setActiveAction(nextAction);
    setPhoneAuth({ name: currentUser.name, identityFront: '', identityBack: '', phoneNo: currentUser.phoneNo, code: '', requested: false, verified: false, authSessionId: '' });
    setEmailForm({ email: '' });
    setPasswordForm({ password: '', passwordConfirm: '' });
    setMessage('');
  };

  const verifyIdentityForm = () => {
    const savedPhone = cleanDigits(currentUser.phoneNo || localStorage.getItem('phoneNo') || '');
    const inputPhone = cleanDigits(phoneAuth.phoneNo || '');
    const inputIdentity = cleanDigits(`${phoneAuth.identityFront || ''}${phoneAuth.identityBack || ''}`);
    if (!phoneAuth.name.trim()) return '이름을 입력해주세요.';
    if (currentUser.name && phoneAuth.name.trim() !== currentUser.name) return '가입된 이름과 일치하지 않습니다.';
    if (inputIdentity.length !== 13) return '주민등록번호 13자리를 입력해주세요.';
    if (!inputPhone) return '휴대폰번호를 입력해주세요.';
    if (savedPhone && inputPhone !== savedPhone) return '가입된 휴대폰번호와 일치하지 않습니다.';
    return '';
  };

  const handleRequestPhoneAuth = async () => {
    setMessage('');
    const phoneError = verifyIdentityForm();
    if (phoneError) { setMessage(phoneError); return; }
    setLoading('request');
    try {
      const response = await authAPI.requestPhoneAuth?.({ name: phoneAuth.name.trim(), identity13: cleanDigits(`${phoneAuth.identityFront || ''}${phoneAuth.identityBack || ''}`), phoneNo: cleanDigits(phoneAuth.phoneNo), purpose: activeAction });
      setPhoneAuth((f) => ({ ...f, requested: true, code: '', authSessionId: response?.authSessionId || response?.data?.authSessionId || '' }));
    } catch {
      // 백엔드 미연결/데모 환경에서는 인증번호 000000으로 처리합니다.
    } finally {
      localStorage.setItem('accountPhoneAuthCode', '000000');
      setPhoneAuth((f) => ({ ...f, requested: true, code: '', authSessionId: f.authSessionId || 'demo-auth-session' }));
      setMessage('인증번호를 발송했습니다. 데모 환경에서는 000000을 입력해주세요.');
      setLoading('');
    }
  };

  const handleVerifyPhoneAuth = async () => {
    setMessage('');
    const phoneError = verifyIdentityForm();
    if (phoneError) { setMessage(phoneError); return; }
    if (!phoneAuth.code.trim()) { setMessage('인증번호를 입력해주세요.'); return; }

    setLoading('verify');
    try {
      await authAPI.verifyPhoneAuth?.({ authSessionId: phoneAuth.authSessionId, name: phoneAuth.name.trim(), identity13: cleanDigits(`${phoneAuth.identityFront || ''}${phoneAuth.identityBack || ''}`), phoneNo: cleanDigits(phoneAuth.phoneNo), code: phoneAuth.code.trim(), purpose: activeAction });
    } catch {
      const demoCode = localStorage.getItem('accountPhoneAuthCode') || '000000';
      if (phoneAuth.code.trim() !== demoCode) {
        setMessage('인증번호가 일치하지 않습니다.');
        setLoading('');
        return;
      }
    }
    setPhoneAuth((f) => ({ ...f, verified: true }));
    setMessage('');
    setLoading('');
  };

  const updateDemoUser = (patch) => {
    try {
      const demoUsers = JSON.parse(localStorage.getItem('medicatchDemoUsers') || '[]');
      const nextUsers = demoUsers.map((u) => (
        u.codefId === currentUser.codefId ? { ...u, ...patch } : u
      ));
      localStorage.setItem('medicatchDemoUsers', JSON.stringify(nextUsers));
    } catch {
      // ignore demo store update
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!phoneAuth.verified) { setMessage('휴대폰 본인인증을 먼저 완료해주세요.'); return; }
    const nextEmailInput = emailForm.email.trim();
    const emailDomain = nextEmailInput.split('@')[1]?.toLowerCase();
    if (!nextEmailInput || !nextEmailInput.includes('@')) { setMessage('변경할 이메일을 올바르게 입력해주세요.'); return; }
    if (!emailDomain || !ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) { setMessage('사용 가능한 이메일 도메인이 아닙니다. (naver.com, daum.net, kakao.com 등)'); return; }

    setLoading('email');
    try {
      await authAPI.changeEmail?.({ authSessionId: phoneAuth.authSessionId, name: phoneAuth.name.trim(), identity13: cleanDigits(`${phoneAuth.identityFront || ''}${phoneAuth.identityBack || ''}`), phoneNo: cleanDigits(phoneAuth.phoneNo), email: emailForm.email.trim() });
    } catch {
      // 백엔드 미연결/데모 환경에서는 로컬 데이터만 갱신합니다.
    } finally {
      const nextEmail = nextEmailInput;
      localStorage.setItem('email', nextEmail);
      updateDemoUser({ email: nextEmail });
      setUser({ ...currentUser, email: nextEmail });
      setEmailForm({ email: '' });
      setPhoneAuth((f) => ({ ...f, verified: false, requested: false, code: '', authSessionId: '' }));
      setMessage('이메일이 변경되었습니다.');
      setLoading('');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!phoneAuth.verified) { setMessage('휴대폰 본인인증을 먼저 완료해주세요.'); return; }
    if (passwordForm.password !== passwordForm.passwordConfirm) { setMessage('비밀번호가 일치하지 않습니다.'); return; }
    const passwordPolicyError = validatePasswordPolicy(passwordForm.password, currentUser.codefId);
    if (passwordPolicyError) { setMessage(passwordPolicyError); return; }

    setLoading('password');
    try {
      await authAPI.changePassword?.({ authSessionId: phoneAuth.authSessionId, name: phoneAuth.name.trim(), identity13: cleanDigits(`${phoneAuth.identityFront || ''}${phoneAuth.identityBack || ''}`), phoneNo: cleanDigits(phoneAuth.phoneNo), password: passwordForm.password, passwordConfirm: passwordForm.passwordConfirm });
    } catch {
      // 백엔드 미연결/데모 환경에서는 로컬 데이터만 갱신합니다.
    } finally {
      localStorage.setItem('currentPassword', passwordForm.password);
      localStorage.setItem('passwordUpdatedAt', new Date().toISOString());
      updateDemoUser({ password: passwordForm.password });
      setPasswordForm({ password: '', passwordConfirm: '' });
      setPhoneAuth((f) => ({ ...f, verified: false, requested: false, code: '', authSessionId: '' }));
      setMessage('비밀번호가 변경되었습니다.');
      setLoading('');
    }
  };

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

            <div className="mc-phone-auth-box">
              <div className="mc-identity-auth-grid">
                <div>
                  <label className="mc-account-label">이름</label>
                  <input className="mc-input" value={phoneAuth.name} onChange={(e) => { setPhoneAuth((f) => ({ ...f, name: e.target.value, verified: false, authSessionId: '' })); setMessage(''); }} placeholder="이름" />
                </div>
                <div>
                  <label className="mc-account-label">주민등록번호</label>
                  <div className="mc-identity-split">
                    <input className="mc-input" value={phoneAuth.identityFront} onChange={(e) => { setPhoneAuth((f) => ({ ...f, identityFront: cleanDigits(e.target.value).slice(0, 6), verified: false, authSessionId: '' })); setMessage(''); }} placeholder="" inputMode="numeric" />
                    <span>-</span>
                    <input className="mc-input" type="password" value={phoneAuth.identityBack} onChange={(e) => { setPhoneAuth((f) => ({ ...f, identityBack: cleanDigits(e.target.value).slice(0, 7), verified: false, authSessionId: '' })); setMessage(''); }} placeholder="" inputMode="numeric" />
                  </div>
                </div>
                <div>
                  <label className="mc-account-label">휴대폰번호</label>
                  <input className="mc-input" value={phoneAuth.phoneNo} onChange={(e) => { setPhoneAuth((f) => ({ ...f, phoneNo: e.target.value, verified: false, authSessionId: '' })); setMessage(''); }} placeholder="01012345678" inputMode="tel" />
                </div>
                <div>
                  <label className="mc-account-label">인증번호</label>
                  <input className="mc-input" value={phoneAuth.code} onChange={(e) => { setPhoneAuth((f) => ({ ...f, code: e.target.value })); setMessage(''); }} placeholder="인증번호 입력" disabled={!phoneAuth.requested || phoneAuth.verified} inputMode="numeric" />
                </div>
              </div>
              <div className="mc-account-actions split">
                <button className="mc-btn mc-account-ghost-btn" type="button" onClick={handleRequestPhoneAuth} disabled={loading === 'request'}>{phoneAuth.requested ? '재발송' : '인증번호 받기'}</button>
                <button className="mc-btn mc-btn-primary mc-account-submit" type="button" onClick={handleVerifyPhoneAuth} disabled={!phoneAuth.requested || phoneAuth.verified || loading === 'verify'}>{phoneAuth.verified ? '인증 완료' : '확인'}</button>
              </div>
            </div>

            {message && !phoneAuth.verified && <div className="mc-account-message">{message}</div>}

            {!phoneAuth.verified ? null : activeAction === 'password' ? (
              <form className="mc-account-form compact mc-account-reveal" onSubmit={handlePasswordChange}>
                <div className="mc-grid mc-grid-2">
                  <div>
                    <label className="mc-account-label">새 비밀번호</label>
                    <input className="mc-input" type="password" value={passwordForm.password} onChange={(e) => { setPasswordForm((f) => ({ ...f, password: e.target.value })); setMessage(''); }} placeholder="9자 이상 입력" />
                  </div>
                  <div>
                    <label className="mc-account-label">비밀번호 확인</label>
                    <input className="mc-input" type="password" value={passwordForm.passwordConfirm} onChange={(e) => { setPasswordForm((f) => ({ ...f, passwordConfirm: e.target.value })); setMessage(''); }} placeholder="비밀번호 재입력" />
                  </div>
                </div>
                {message && <div className="mc-account-message">{message}</div>}
                <div className="mc-account-actions"><button className="mc-btn mc-btn-primary mc-account-submit" type="submit" disabled={loading === 'password'}>{loading === 'password' ? '변경 중' : '변경'}</button></div>
              </form>
            ) : (
              <form className="mc-account-form compact mc-account-reveal" onSubmit={handleEmailChange}>
                <div>
                  <label className="mc-account-label">변경할 이메일</label>
                  <input className="mc-input" type="email" value={emailForm.email} onChange={(e) => { setEmailForm((f) => ({ ...f, email: e.target.value })); setMessage(''); }} placeholder="new@example.com" />
                </div>
                {message && <div className="mc-account-message">{message}</div>}
                <div className="mc-account-actions"><button className="mc-btn mc-btn-primary mc-account-submit" type="submit" disabled={loading === 'email'}>{loading === 'email' ? '변경 중' : '변경'}</button></div>
              </form>
            )}
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
