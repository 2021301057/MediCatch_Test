import React, { useState } from 'react';
import { healthAPI, insuranceAPI } from '../api/services';

const TELECOM_OPTIONS = [
  { value: '0', label: 'SKT / SKT 알뜰폰' },
  { value: '1', label: 'KT / KT 알뜰폰' },
  { value: '2', label: 'LG U+ / LG U+ 알뜰폰' },
];

const AUTH_LEVEL_OPTIONS = [
  { value: '5',  label: '통신사 PASS', icon: '📱' },
  { value: '1',  label: '카카오톡',    icon: '💬' },
  { value: '3',  label: '삼성 패스',   icon: '🔐' },
  { value: '4',  label: 'KB모바일',    icon: '🏦' },
  { value: '6',  label: '네이버',      icon: '🟢' },
  { value: '7',  label: '신한인증서',  icon: '🔴' },
  { value: '8',  label: 'toss',        icon: '💙' },
  { value: '10', label: 'NH인증서',    icon: '🌾' },
];

export default function CodefSyncModal({ userId, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1=폼입력, 2=앱 인증, 3=완료
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [resultStats, setResultStats] = useState(null);

  const [form, setForm] = useState({
    codefId:        '',
    codefPassword:  '',
    userName:       '',
    phoneNo:        '',
    identity13:     '',
    telecom:        '0',
    loginTypeLevel: '5',
  });

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const selectedAuth = AUTH_LEVEL_OPTIONS.find(o => o.value === form.loginTypeLevel);
  const needsTelecom = form.loginTypeLevel === '5';

  // ── Step1: 정보 입력 후 요청 ─────────────────────────────────────────
  const handleStep1 = async (e) => {
    e.preventDefault();
    setError('');
    const cleanId = form.identity13.replace(/-/g, '');
    if (cleanId.length !== 13) {
      setError('주민등록번호 13자리를 입력해주세요.');
      return;
    }
    if (!form.codefId || !form.codefPassword) {
      setError('CODEF 아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const [, healthResp] = await Promise.all([
        insuranceAPI.sync({
          codefId:       form.codefId,
          codefPassword: form.codefPassword,
        }),
        healthAPI.syncStep1({
          userId,
          userName:       form.userName,
          phoneNo:        form.phoneNo,
          identity13:     cleanId,
          telecom:        needsTelecom ? form.telecom : '',
          loginTypeLevel: form.loginTypeLevel,
        }),
      ]);

      localStorage.setItem('codefId', form.codefId);
      setSessionKey(healthResp.data.sessionKey);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || '요청 중 오류가 발생했습니다. 입력 정보를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step2: 앱 인증 완료 확인 ─────────────────────────────────────────
  const handleStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await healthAPI.syncStep2({ sessionKey });
      setResultStats(data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || '인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* 헤더 */}
        <div style={s.header}>
          <div>
            <h3 style={s.title}>🔄 CODEF 데이터 갱신</h3>
            <p style={s.subtitle}>
              {step === 1 && '보험·건강검진·진료 정보를 한 번에 불러옵니다'}
              {step === 2 && `${selectedAuth?.icon} ${selectedAuth?.label} 앱에서 인증을 완료해주세요`}
              {step === 3 && '동기화가 완료되었습니다 🎉'}
            </p>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* 진행 표시 */}
        <div style={s.progress}>
          {['정보 입력', '앱 인증', '완료'].map((label, i) => (
            <div key={i} style={s.progressItem}>
              <div style={{ ...s.progressDot, background: step > i ? '#1d4ed8' : step === i + 1 ? '#1d4ed8' : '#e2e8f0', opacity: step === i + 1 ? 1 : step > i + 1 ? 0.6 : 0.3 }} />
              <span style={{ ...s.progressLabel, color: step >= i + 1 ? '#1d4ed8' : '#94a3b8' }}>{label}</span>
            </div>
          ))}
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {/* ── Step1: 폼 입력 ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} style={s.form}>
            <div style={s.section}>
              <div style={s.sectionTitle}>📋 보험 정보 (내보험다보여)</div>
              <div style={s.row2}>
                <Field label="CODEF 아이디">
                  <input name="codefId" value={form.codefId} onChange={handle}
                    placeholder="내보험다보여 아이디" style={s.input} required />
                </Field>
                <Field label="CODEF 비밀번호">
                  <input name="codefPassword" type="password" value={form.codefPassword} onChange={handle}
                    placeholder="내보험다보여 비밀번호" style={s.input} required />
                </Field>
              </div>
            </div>

            <div style={s.section}>
              <div style={s.sectionTitle}>🏥 건강검진·진료 정보 (간편 인증 필요)</div>
              <div style={s.row2}>
                <Field label="이름">
                  <input name="userName" value={form.userName} onChange={handle}
                    placeholder="홍길동" style={s.input} required />
                </Field>
                <Field label="전화번호">
                  <input name="phoneNo" value={form.phoneNo} onChange={handle}
                    placeholder="01012345678" style={s.input} required />
                </Field>
              </div>
              <Field label="주민등록번호 (13자리)">
                <input name="identity13" type="password" value={form.identity13} onChange={handle}
                  placeholder="하이픈 없이 13자리" maxLength={13} style={s.input} required autoComplete="off" />
              </Field>

              <Field label="인증 방법">
                <div style={s.authGrid}>
                  {AUTH_LEVEL_OPTIONS.map(o => (
                    <label key={o.value} style={{ ...s.authOption, ...(form.loginTypeLevel === o.value ? s.authOptionActive : {}) }}>
                      <input type="radio" name="loginTypeLevel" value={o.value}
                        checked={form.loginTypeLevel === o.value} onChange={handle} style={{ display: 'none' }} />
                      <span style={s.authIcon}>{o.icon}</span>
                      <span style={s.authLabel}>{o.label}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {needsTelecom && (
                <Field label="통신사">
                  <select name="telecom" value={form.telecom} onChange={handle} style={s.input}>
                    {TELECOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ 요청 중...' : '데이터 불러오기 →'}
            </button>
          </form>
        )}

        {/* ── Step2: 앱 인증 ── */}
        {step === 2 && (
          <form onSubmit={handleStep2} style={s.form}>
            <div style={s.appNotice}>
              <span style={{ fontSize: 44 }}>{selectedAuth?.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4, fontSize: 15 }}>
                  {selectedAuth?.label} 앱을 확인해주세요
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  인증 요청을 수락한 후 아래 버튼을 눌러주세요.
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ 처리 중...' : '인증 완료 →'}
            </button>
          </form>
        )}

        {/* ── Step3: 완료 ── */}
        {step === 3 && (
          <div style={s.form}>
            <div style={s.successBox}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#15803d', marginBottom: 8 }}>동기화 완료!</div>
              {resultStats && (
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
                  <div>건강검진 결과: {resultStats.savedCheckups}건 저장</div>
                  <div>진료 기록: {resultStats.savedMedicals}건 저장</div>
                  <div>처방 약품: {resultStats.savedMedications}건 저장</div>
                </div>
              )}
            </div>
            <button onClick={handleDone} style={s.primaryBtn}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560,
    maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '24px 24px 0',
  },
  title: { fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#94a3b8', padding: '2px 6px', borderRadius: 6, flexShrink: 0,
  },
  progress: {
    display: 'flex', alignItems: 'center', padding: '16px 24px',
    borderBottom: '1px solid #f1f5f9',
  },
  progressItem: { display: 'flex', alignItems: 'center', gap: 6, flex: 1 },
  progressDot: { width: 10, height: 10, borderRadius: '50%', transition: 'all .2s' },
  progressLabel: { fontSize: 12, fontWeight: 600, transition: 'color .2s' },
  errorBox: {
    margin: '12px 24px 0', padding: '10px 14px',
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, color: '#b91c1c', fontSize: 13,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14, padding: 24 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: 0.3,
    paddingBottom: 6, borderBottom: '1px solid #f1f5f9',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  input: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc',
    boxSizing: 'border-box',
  },
  authGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
  },
  authOption: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '10px 6px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    cursor: 'pointer', background: '#f8fafc', transition: 'all .15s',
  },
  authOptionActive: {
    border: '1.5px solid #2563eb', background: '#eff6ff',
  },
  authIcon: { fontSize: 20 },
  authLabel: { fontSize: 11, fontWeight: 600, color: '#334155', textAlign: 'center' },
  appNotice: {
    display: 'flex', gap: 16, alignItems: 'center',
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 14, padding: '20px 18px',
  },
  successBox: {
    textAlign: 'center', padding: '24px 16px',
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 14,
  },
  primaryBtn: {
    padding: '13px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(29,78,216,0.3)',
  },
};
