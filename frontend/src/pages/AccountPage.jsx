import React, { useMemo, useState } from 'react';
import useAuthStore from '../store/authStore';

export default function AccountPage() {
  const { user } = useAuthStore();
  const currentUser = useMemo(() => ({
    userId: user?.userId || Number(localStorage.getItem('userId') || 0),
    codefId: user?.codefId || localStorage.getItem('codefId') || '',
    name: user?.name || localStorage.getItem('userName') || '',
    email: user?.email || localStorage.getItem('email') || '',
    phoneNo: user?.phoneNo || localStorage.getItem('phoneNo') || '',
  }), [user]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const getSavedPassword = () => {
    const directPassword = localStorage.getItem('currentPassword');
    if (directPassword) return directPassword;

    try {
      const demoUsers = JSON.parse(localStorage.getItem('medicatchDemoUsers') || '[]');
      return demoUsers.find((u) => u.codefId === currentUser.codefId)?.password || '';
    } catch {
      return '';
    }
  };

  const updateSavedPassword = (nextPassword) => {
    localStorage.setItem('currentPassword', nextPassword);
    try {
      const demoUsers = JSON.parse(localStorage.getItem('medicatchDemoUsers') || '[]');
      const nextUsers = demoUsers.map((u) => (
        u.codefId === currentUser.codefId ? { ...u, password: nextPassword } : u
      ));
      localStorage.setItem('medicatchDemoUsers', JSON.stringify(nextUsers));
    } catch {
      // 데모 유저 저장소가 없으면 localStorage currentPassword만 갱신합니다.
    }
  };

  const handlePasswordSave = (e) => {
    e.preventDefault();
    const savedPassword = getSavedPassword();

    if (!currentPassword) {
      setPasswordMessage('현재 비밀번호를 입력해주세요.');
      return;
    }
    if (savedPassword && currentPassword !== savedPassword) {
      setPasswordMessage('현재 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 9) {
      setPasswordMessage('비밀번호는 9자 이상 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordMessage('비밀번호가 일치하지 않습니다.');
      return;
    }
    updateSavedPassword(password);
    localStorage.setItem('passwordUpdatedAt', new Date().toISOString());
    setCurrentPassword('');
    setPassword('');
    setPasswordConfirm('');
    setPasswordMessage('비밀번호가 수정되었습니다.');
  };

  return (
    <div className="mc-page mc-account-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">내 로그인 정보</div>
          <div className="mc-page-subtitle">계정 정보를 확인하고 비밀번호를 수정할 수 있어요.</div>
        </div>
      </div>

      <div className="mc-account-grid">
        <section className="mc-card mc-account-card">
          <div className="mc-card-body">
            <h2 className="mc-account-section-title">계정 정보</h2>
            <div className="mc-account-info-list">
              <InfoRow label="아이디" value={currentUser.codefId || '-'} />
              <InfoRow label="이름" value={currentUser.name || '-'} />
              <InfoRow label="이메일" value={currentUser.email || '-'} />
              <InfoRow label="전화번호" value={currentUser.phoneNo || '-'} />
            </div>
          </div>
        </section>

        <section className="mc-card mc-account-card">
          <div className="mc-card-body">
            <h2 className="mc-account-section-title">비밀번호 수정</h2>
            <form className="mc-account-form" onSubmit={handlePasswordSave}>
              <div>
                <label className="mc-account-label">현재 비밀번호</label>
                <input className="mc-input" type="password" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordMessage(''); }} placeholder="현재 비밀번호 입력" />
              </div>
              <div className="mc-grid mc-grid-2">
                <div>
                  <label className="mc-account-label">새 비밀번호</label>
                  <input className="mc-input" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setPasswordMessage(''); }} placeholder="9자 이상 입력" />
                </div>
                <div>
                  <label className="mc-account-label">비밀번호 확인</label>
                  <input className="mc-input" type="password" value={passwordConfirm} onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordMessage(''); }} placeholder="비밀번호 재입력" />
                </div>
              </div>
              {passwordMessage && <div className="mc-account-message">{passwordMessage}</div>}
              <div className="mc-account-actions"><button className="mc-btn mc-btn-primary mc-account-submit" type="submit">변경</button></div>
            </form>
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
