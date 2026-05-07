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

// 화면 단계: form → checkup-auth → medical-ready → medical-auth → done
const PROGRESS = ['정보 입력', '건강검진·보험 인증', '진료 인증', '완료'];

const progressIndex = {
  'form':          0,
  'checkup-auth':  1,
  'medical-ready': 2,
  'medical-auth':  2,
  'done':          3,
};

export default function CodefSyncModal({ userId, onClose, onSuccess }) {
  const [screen, setScreen]   = useState('form');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    codefId: '', codefPassword: '',
    userName: '', phoneNo: '', identity13: '',
    telecom: '0', loginTypeLevel: '5',
  });

  const [checkupSessionKey, setCheckupSessionKey] = useState('');
  const [medicalSessionKey, setMedicalSessionKey] = useState('');
  const [checkupResult,     setCheckupResult]     = useState(null);
  const [insuranceResult,   setInsuranceResult]   = useState(null);
  const [medicalResult,     setMedicalResult]     = useState(null);

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const auth   = AUTH_LEVEL_OPTIONS.find(o => o.value === form.loginTypeLevel);
  const cleanId = form.identity13.replace(/-/g, '');

  // ── 1단계: 건강 데이터 연동 시작 ────────────────────────────────────
  const handleStartCheckup = async (e) => {
    e.preventDefault();
    setError('');
    if (cleanId.length !== 13) { setError('주민등록번호 13자리를 입력해주세요.'); return; }
    if (!form.codefId || !form.codefPassword) { setError('CODEF 아이디와 비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    try {
      const [insData, data] = await Promise.all([
        insuranceAPI.sync({ codefId: form.codefId, codefPassword: form.codefPassword }),
        healthAPI.syncCheckupStep1({
          userId,
          userName: form.userName, phoneNo: form.phoneNo, identity13: cleanId,
          telecom: form.loginTypeLevel === '5' ? form.telecom : '',
          loginTypeLevel: form.loginTypeLevel,
        }),
      ]);
      localStorage.setItem('codefId', form.codefId);
      setInsuranceResult(insData);
      setCheckupSessionKey(data.sessionKey);
      setScreen('checkup-auth');
    } catch (err) {
      setError(err.response?.data?.message || '요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── 2단계: 건강검진 2차 인증 ─────────────────────────────────────────
  const handleConfirmCheckup = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await healthAPI.syncCheckupStep2({ sessionKey: checkupSessionKey });
      setCheckupResult(data);
      setScreen('medical-ready');
    } catch (err) {
      setError(err.response?.data?.message || '인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ── 3단계: 진료 데이터 연동 시작 ─────────────────────────────────────
  const handleStartMedical = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await healthAPI.syncMedicalStep1({
        userId,
        userName: form.userName, phoneNo: form.phoneNo, identity13: cleanId,
        telecom: form.loginTypeLevel === '5' ? form.telecom : '',
        loginTypeLevel: form.loginTypeLevel,
      });
      setMedicalSessionKey(data.sessionKey);
      setScreen('medical-auth');
    } catch (err) {
      setError(err.response?.data?.message || '요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── 4단계: 진료 기록 2차 인증 ────────────────────────────────────────
  const handleConfirmMedical = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await healthAPI.syncMedicalStep2({ sessionKey: medicalSessionKey });
      setMedicalResult(data);
      setScreen('done');
    } catch (err) {
      setError(err.response?.data?.message || '인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const pIdx = progressIndex[screen] ?? 0;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        {/* 헤더 */}
        <div style={s.header}>
          <div>
            <h3 style={s.title}>🔄 데이터 연동</h3>
            <p style={s.subtitle}>{PROGRESS[pIdx]}</p>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* 진행 표시 */}
        <div style={s.progress}>
          {PROGRESS.map((label, i) => (
            <React.Fragment key={i}>
              <div style={s.progressItem}>
                <div style={{
                  ...s.progressDot,
                  background: i < pIdx ? '#1d4ed8' : i === pIdx ? '#2563eb' : '#e2e8f0',
                  opacity: i <= pIdx ? 1 : 0.35,
                }} />
                <span style={{ ...s.progressLabel, color: i <= pIdx ? '#1d4ed8' : '#94a3b8' }}>
                  {label}
                </span>
              </div>
              {i < PROGRESS.length - 1 && (
                <div style={{ ...s.progressLine, background: i < pIdx ? '#1d4ed8' : '#e2e8f0' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {/* ── 화면 1: 정보 입력 ── */}
        {screen === 'form' && (
          <form onSubmit={handleStartCheckup} style={s.body}>
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
              <div style={s.sectionTitle}>🏥 건강검진 · 진료 (간편인증 공통)</div>
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
              {form.loginTypeLevel === '5' && (
                <Field label="통신사">
                  <select name="telecom" value={form.telecom} onChange={handle} style={s.input}>
                    {TELECOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ 연동 요청 중...' : '1단계: 건강검진·보험 연동 시작 →'}
            </button>
          </form>
        )}

        {/* ── 화면 2: 건강검진 2차 인증 ── */}
        {screen === 'checkup-auth' && (
          <div style={s.body}>
            <AuthNotice auth={auth} />
            <InfoBox>
              건강검진 결과(NHIS)와 보험 계약정보(내보험다보여) 연동을 진행 중입니다.<br />
              {auth?.label} 앱에서 인증 요청을 승인한 후 아래 버튼을 눌러주세요.
            </InfoBox>
            <button onClick={handleConfirmCheckup} disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ 처리 중...' : '2단계: 인증 완료 →'}
            </button>
          </div>
        )}

        {/* ── 화면 3: 진료 데이터 연동 준비 ── */}
        {screen === 'medical-ready' && (
          <div style={s.body}>
            <ResultBox title="✅ 건강검진 + 보험 연동 완료">
              건강검진 결과 <b>{checkupResult?.savedCheckups ?? 0}건</b>,{' '}
              보험 계약 <b>{insuranceResult?.savedPolicies ?? 0}건</b> 저장됐습니다.
            </ResultBox>
            <InfoBox>
              이어서 진료 기록(HIRA) 연동을 시작합니다.<br />
              아래 버튼을 누르면 {auth?.label} 앱으로 새로운 인증 요청이 전송됩니다.
            </InfoBox>
            <button onClick={handleStartMedical} disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ 연동 요청 중...' : '3단계: 진료 데이터 연동 시작 →'}
            </button>
          </div>
        )}

        {/* ── 화면 4: 진료 기록 2차 인증 ── */}
        {screen === 'medical-auth' && (
          <div style={s.body}>
            <AuthNotice auth={auth} />
            <InfoBox>
              내진료정보열람(HIRA) 연동을 진행 중입니다.<br />
              {auth?.label} 앱에서 인증 요청을 승인한 후 아래 버튼을 눌러주세요.
            </InfoBox>
            <button onClick={handleConfirmMedical} disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ 처리 중...' : '4단계: 인증 완료 →'}
            </button>
          </div>
        )}

        {/* ── 화면 5: 완료 ── */}
        {screen === 'done' && (
          <div style={s.body}>
            <div style={s.doneBox}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a', marginBottom: 16 }}>
                모든 데이터 연동 완료!
              </div>
              <div style={s.resultGrid}>
                <ResultRow icon="🏥" label="건강검진 결과"  value={`${checkupResult?.savedCheckups ?? 0}건`} />
                <ResultRow icon="📑" label="보험 계약"       value={`${insuranceResult?.savedPolicies ?? 0}건`} />
                <ResultRow icon="📋" label="진료 기록"       value={`${medicalResult?.savedMedicals ?? 0}건`} />
                <ResultRow icon="💊" label="처방 약품"       value={`${medicalResult?.savedMedications ?? 0}건`} />
              </div>
            </div>
            <button onClick={() => { onSuccess?.(); onClose(); }} style={s.primaryBtn}>
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 공통 컴포넌트 ──────────────────────────────────────────────────
function AuthNotice({ auth }) {
  return (
    <div style={s.authNotice}>
      <span style={{ fontSize: 48 }}>{auth?.icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 4 }}>
          {auth?.label} 앱을 확인해주세요
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          앱에서 인증 요청이 도착했습니다. 승인 후 아래 버튼을 눌러주세요.
        </div>
      </div>
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div style={s.infoBox}>{children}</div>
  );
}

function ResultBox({ title, children }) {
  return (
    <div style={s.resultBox}>
      <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#475569' }}>{children}</div>
    </div>
  );
}

function ResultRow({ icon, label, value }) {
  return (
    <div style={s.resultRow}>
      <span>{icon} {label}</span>
      <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

// ── 스타일 ──────────────────────────────────────────────────────────
const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560,
    maxHeight: '92vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '22px 24px 0',
  },
  title:    { fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 },
  subtitle: { fontSize: 13, color: '#2563eb', fontWeight: 600, marginTop: 3 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#94a3b8', padding: '2px 6px', borderRadius: 6,
  },
  // 진행 표시
  progress: {
    display: 'flex', alignItems: 'center', padding: '16px 24px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  progressItem:  { display: 'flex', alignItems: 'center', gap: 5 },
  progressDot:   { width: 10, height: 10, borderRadius: '50%', transition: 'all .2s', flexShrink: 0 },
  progressLabel: { fontSize: 11.5, fontWeight: 600, transition: 'color .2s', whiteSpace: 'nowrap' },
  progressLine:  { flex: 1, height: 2, borderRadius: 1, margin: '0 6px', transition: 'background .2s', minWidth: 16 },
  // 에러
  errorBox: {
    margin: '10px 24px 0', padding: '10px 14px',
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, color: '#b91c1c', fontSize: 13,
  },
  // 본문
  body: { display: 'flex', flexDirection: 'column', gap: 16, padding: 24 },
  section:      { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: {
    fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.3,
    paddingBottom: 6, borderBottom: '1px solid #f1f5f9',
  },
  row2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  input: {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc',
    boxSizing: 'border-box',
  },
  authGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 },
  authOption: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '8px 4px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    cursor: 'pointer', background: '#f8fafc', transition: 'all .15s',
  },
  authOptionActive: { border: '1.5px solid #2563eb', background: '#eff6ff' },
  authIcon:  { fontSize: 18 },
  authLabel: { fontSize: 10.5, fontWeight: 600, color: '#334155', textAlign: 'center' },
  // 인증 대기 화면
  authNotice: {
    display: 'flex', gap: 18, alignItems: 'center',
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 16, padding: '22px 20px',
  },
  infoBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: '14px 16px',
    fontSize: 13, color: '#475569', lineHeight: 1.7,
  },
  resultBox: {
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 12, padding: '14px 16px',
  },
  // 완료 화면
  doneBox: {
    textAlign: 'center', padding: '24px 16px',
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 16,
  },
  resultGrid: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  resultRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fff', borderRadius: 10, padding: '10px 14px',
    fontSize: 14, color: '#334155',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  primaryBtn: {
    padding: '13px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(29,78,216,0.3)',
  },
};
