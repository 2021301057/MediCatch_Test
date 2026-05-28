import React, { useRef, useState } from 'react';
import { healthAPI, insuranceAPI } from '../api/services';

const TELECOM_OPTIONS = [
  { value: '0', label: 'SKT / SKT 알뜰폰' },
  { value: '1', label: 'KT / KT 알뜰폰' },
  { value: '2', label: 'LG U+ / LG U+ 알뜰폰' },
];

const AUTH_LEVEL_OPTIONS = [
  { value: '1', label: '카카오톡',    mark: 'K', markStyle: 'kakao' },
  { value: '5', label: '휴대폰 인증', mark: 'P', markStyle: 'pass'  },
  { value: '6', label: '네이버',      mark: 'N', markStyle: 'naver' },
  { value: '8', label: '토스',        mark: 'T', markStyle: 'toss'  },
];

// 화면 단계: form → checkup-auth → medical-ready → medical-auth → done
const PROGRESS = ['정보 입력', '건강검진 인증', '진료 인증', '완료'];

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

  const [form, setForm] = useState(() => ({
    codefId:       localStorage.getItem('codefId')   || '',
    codefPassword: '',
    userName:      localStorage.getItem('userName')  || '',
    phoneNo:       localStorage.getItem('phoneNo')   || '',
    identityFront: '',
    identityBack:  '',
    telecom:       '0',
    loginTypeLevel: '1',
  }));
  const identityBackRef = useRef(null);

  const [checkupSessionKey, setCheckupSessionKey] = useState('');
  const [medicalSessionKey, setMedicalSessionKey] = useState('');
  const [checkupResult,     setCheckupResult]     = useState(null);
  const [medicalResult,     setMedicalResult]     = useState(null);

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleIdentityFront = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setForm(f => ({ ...f, identityFront: value }));
    if (value.length === 6) identityBackRef.current?.focus();
  };
  const handleIdentityBack = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 7);
    setForm(f => ({ ...f, identityBack: value }));
  };

  const auth    = AUTH_LEVEL_OPTIONS.find(o => o.value === form.loginTypeLevel);
  const cleanId = `${form.identityFront}${form.identityBack}`;

  // ── 1단계: 건강 데이터 연동 시작 ────────────────────────────────────
  const handleStartCheckup = async (e) => {
    e.preventDefault();
    setError('');
    if (cleanId.length !== 13) { setError('주민등록번호 13자리를 입력해주세요.'); return; }
    if (!form.codefId || !form.codefPassword) { setError('ID와 비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    try {
      const [, data] = await Promise.all([
        insuranceAPI.sync({ codefId: form.codefId, codefPassword: form.codefPassword }),
        healthAPI.syncCheckupStep1({
          userId,
          userName: form.userName, phoneNo: form.phoneNo, identity13: cleanId,
          telecom: form.loginTypeLevel === '5' ? form.telecom : '',
          loginTypeLevel: form.loginTypeLevel,
        }),
      ]);
      localStorage.setItem('codefId', form.codefId);
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
        <style>{`
          @keyframes mcProgressPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.12); }
            50% { transform: scale(1.12); box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.045); }
          }
        `}</style>

        {/* 헤더 */}
        <div style={s.header}>
          <h3 style={s.title}>데이터 연동</h3>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* 진행 표시 */}
        <div style={s.progress}>
          {PROGRESS.map((label, i) => (
            <React.Fragment key={i}>
              <div style={s.progressItem}>
                <div style={{
                  ...s.progressDot,
                  background: i < pIdx ? '#60a5fa' : i === pIdx ? '#3b82f6' : '#f8fafc',
                  border: i <= pIdx ? '1.5px solid transparent' : '1.5px solid #e2e8f0',
                  opacity: i <= pIdx ? 1 : 0.45,
                  animation: i === pIdx ? 'mcProgressPulse 1.55s ease-in-out infinite' : 'none',
                }} />
                <span style={{ ...s.progressLabel, color: i <= pIdx ? '#2563eb' : '#94a3b8' }}>
                  {label}
                </span>
              </div>
              {i < PROGRESS.length - 1 && (
                <div style={{ ...s.progressLine, background: i < pIdx ? '#7db7fb' : '#e2e8f0' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {/* ── 화면 1: 정보 입력 ── */}
        {screen === 'form' && (
          <form onSubmit={handleStartCheckup} style={s.body}>
            <div style={s.section}>
              <div style={s.row2}>
                <Field label="ID">
                  <input name="codefId" value={form.codefId} onChange={handle}
                    placeholder="가입시 입력한 아이디" style={s.input} required autoComplete="username" />
                </Field>
                <Field label="비밀번호">
                  <input name="codefPassword" type="password" value={form.codefPassword} onChange={handle}
                    placeholder="비밀번호" style={s.input} required autoComplete="current-password" />
                </Field>
              </div>
            </div>

            <div style={s.section}>
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
              <Field label="인증 방법">
                <div style={s.authGrid}>
                  {AUTH_LEVEL_OPTIONS.map(o => (
                    <label key={o.value} style={{ ...s.authOption, ...(form.loginTypeLevel === o.value ? s.authOptionActive : {}) }}>
                      <input type="radio" name="loginTypeLevel" value={o.value}
                        checked={form.loginTypeLevel === o.value} onChange={handle} style={{ display: 'none' }} />
                      <span style={{ ...s.authMark, ...s[`authMark_${o.markStyle}`] }}>{o.mark}</span>
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
              <Field label="주민등록번호 (13자리)">
                <div style={s.identityRow}>
                  <input name="identityFront" inputMode="numeric" value={form.identityFront}
                    onChange={handleIdentityFront} placeholder="" maxLength={6}
                    style={{ ...s.input, ...s.identityInput }} required autoComplete="off" />
                  <span style={s.identityDash}>-</span>
                  <input ref={identityBackRef} name="identityBack" type="password" inputMode="numeric"
                    value={form.identityBack} onChange={handleIdentityBack} placeholder=""
                    maxLength={7} style={{ ...s.input, ...s.identityInput }} required autoComplete="off" />
                </div>
              </Field>
            </div>

            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? '연동 중...' : '연동하기'}
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
            <ResultBox title="건강검진 + 보험 연동 완료">
              건강검진 결과 <b>{checkupResult?.savedCheckups ?? 0}건</b> 저장됐습니다.
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
              <div style={s.doneStatusMark} aria-hidden="true" />
              <div style={s.doneTitle}>모든 데이터 연동 완료</div>
              <div style={s.doneDesc}>건강 데이터와 보험 정보를 안전하게 불러왔습니다.</div>
              <div style={s.resultGrid}>
                <ResultRow label="건강검진 결과" value={`${checkupResult?.savedCheckups ?? 0}건`} />
                <ResultRow label="진료 기록"     value={`${medicalResult?.savedMedicals ?? 0}건`} />
                <ResultRow label="처방 약품"     value={`${medicalResult?.savedMedications ?? 0}건`} />
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
      <div style={{ fontWeight: 800, fontSize: 14.5, color: '#1e293b', marginBottom: 2 }}>
        {auth?.label} 앱을 확인해주세요
      </div>
      <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55 }}>
        앱에서 인증 요청이 도착했습니다. 승인 후 아래 버튼을 눌러주세요.
      </div>
    </div>
  );
}

function InfoBox({ children }) {
  return <div style={s.infoBox}>{children}</div>;
}

function ResultBox({ title, children }) {
  return (
    <div style={s.resultBox}>
      <div style={s.resultBoxTop}>
        <span style={s.resultCheckBadge} aria-hidden="true">✓</span>
        <span style={s.resultBoxTitle}>{title}</span>
      </div>
      <div style={s.resultBoxDesc}>{children}</div>
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <div style={s.resultRow}>
      <span style={s.resultRowLabel}>{label}</span>
      <span style={s.resultRowValue}>{value}</span>
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '22px 24px 0',
  },
  title:   { fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 },
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
  progressDot:   { width: 10, height: 10, borderRadius: '50%', transition: 'all .2s', flexShrink: 0, boxSizing: 'border-box' },
  progressLabel: { fontSize: 11.5, fontWeight: 600, transition: 'color .2s', whiteSpace: 'nowrap' },
  progressLine:  { flex: 1, height: 2, borderRadius: 1, margin: '0 6px', transition: 'background .2s', minWidth: 16 },
  // 에러
  errorBox: {
    margin: '10px 24px 0', padding: '10px 14px',
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, color: '#b91c1c', fontSize: 13,
  },
  // 본문
  body:    { display: 'flex', flexDirection: 'column', gap: 16, padding: 24 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  input: {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc',
    boxSizing: 'border-box',
  },
  identityRow: {
    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center', gap: 8,
  },
  identityInput: { textAlign: 'center', letterSpacing: 0.6 },
  identityDash:  { color: '#94a3b8', fontWeight: 700, fontSize: 16 },
  authGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 },
  authOption: {
    minHeight: 78, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 5,
    padding: '9px 5px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    cursor: 'pointer', background: '#f8fafc', transition: 'all .15s', textAlign: 'center',
  },
  authOptionActive: { border: '1.5px solid #2563eb', background: '#eff6ff', boxShadow: '0 0 0 3px rgba(37,99,235,.08)' },
  authMark: {
    width: 24, height: 24, borderRadius: 8, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 900, letterSpacing: -0.2,
    border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 3px 8px rgba(15,23,42,.08)',
  },
  authMark_kakao: { background: '#FEE500', color: '#191919' },
  authMark_pass:  { background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', color: '#fff' },
  authMark_naver: { background: '#03C75A', color: '#fff' },
  authMark_toss:  { background: '#3182F6', color: '#fff' },
  authLabel: { fontSize: 10.5, fontWeight: 700, color: '#334155', textAlign: 'center', whiteSpace: 'nowrap' },
  // 인증 대기 화면
  authNotice: {
    display: 'flex', flexDirection: 'column', gap: 6,
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 16, padding: '20px 22px',
  },
  infoBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: '14px 16px',
    fontSize: 13, color: '#475569', lineHeight: 1.7,
  },
  resultBox: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, #ffffff 0%, #eef6ff 52%, #ecfdf5 100%)',
    border: '1px solid #bfdbfe', borderRadius: 14, padding: '15px 16px',
    boxShadow: '0 10px 26px rgba(37,99,235,0.10)',
  },
  resultBoxTop:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  resultCheckBadge: {
    width: 22, height: 22, borderRadius: 999, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #2563eb 0%, #22c55e 100%)',
    color: '#ffffff', fontSize: 13, fontWeight: 900, lineHeight: 1,
    boxShadow: '0 0 0 4px rgba(34,197,94,0.12), 0 6px 14px rgba(37,99,235,0.16)',
  },
  resultBoxTitle: { fontWeight: 800, color: '#1e3a8a', fontSize: 14.5 },
  resultBoxDesc:  { fontSize: 13.5, color: '#475569', lineHeight: 1.55 },
  // 완료 화면
  doneBox: {
    textAlign: 'center', padding: '24px 18px 20px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f7fbff 100%)',
    border: '1px solid #bfdbfe', borderRadius: 16,
    boxShadow: '0 10px 26px rgba(37,99,235,0.08)',
  },
  doneStatusMark: {
    width: 34, height: 4, borderRadius: 999, margin: '0 auto 16px',
    background: 'linear-gradient(90deg, #60a5fa, #22c55e)',
  },
  doneTitle: { fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 6 },
  doneDesc:  { fontSize: 12.5, color: '#64748b', marginBottom: 16 },
  resultGrid: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  resultRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 13px',
    fontSize: 13.5, color: '#334155',
  },
  resultRowLabel: { color: '#64748b', fontWeight: 600 },
  resultRowValue: { fontWeight: 800, color: '#2563eb' },
  primaryBtn: {
    padding: '13px',
    background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
    color: '#2563eb', border: '1.5px solid #93c5fd', borderRadius: 12,
    fontSize: 15, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(37,99,235,0.12)',
  },
};
