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

// flow 상태: idle | requesting | auth | confirming | done | error
const INIT = { state: 'idle', sessionKey: '', result: null, error: '' };

export default function CodefSyncModal({ userId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    codefId: '', codefPassword: '',
    userName: '', phoneNo: '', identity13: '',
    telecom: '0', loginTypeLevel: '5',
  });
  const [checkup, setCheckup] = useState({ ...INIT });
  const [medical, setMedical] = useState({ ...INIT });

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const selectedAuth = AUTH_LEVEL_OPTIONS.find(o => o.value === form.loginTypeLevel);
  const needsTelecom = form.loginTypeLevel === '5';
  const cleanId = form.identity13.replace(/-/g, '');
  const formReady = form.userName && form.phoneNo && cleanId.length === 13;
  const insuranceReady = form.codefId && form.codefPassword;

  // ── 건강검진 + 보험 연동 ────────────────────────────────────────────
  const startCheckup = async () => {
    if (!formReady || !insuranceReady) return;
    setCheckup({ ...INIT, state: 'requesting' });
    try {
      const [, { data }] = await Promise.all([
        insuranceAPI.sync({ codefId: form.codefId, codefPassword: form.codefPassword }),
        healthAPI.syncCheckupStep1({
          userId,
          userName: form.userName, phoneNo: form.phoneNo,
          identity13: cleanId,
          telecom: needsTelecom ? form.telecom : '',
          loginTypeLevel: form.loginTypeLevel,
        }),
      ]);
      localStorage.setItem('codefId', form.codefId);
      setCheckup(f => ({ ...f, state: 'auth', sessionKey: data.sessionKey }));
    } catch (err) {
      setCheckup(f => ({ ...f, state: 'error', error: err.response?.data?.message || '요청 중 오류가 발생했습니다.' }));
    }
  };

  const confirmCheckup = async () => {
    setCheckup(f => ({ ...f, state: 'confirming', error: '' }));
    try {
      const { data } = await healthAPI.syncCheckupStep2({ sessionKey: checkup.sessionKey });
      setCheckup(f => ({ ...f, state: 'done', result: data }));
    } catch (err) {
      setCheckup(f => ({ ...f, state: 'error', error: err.response?.data?.message || '인증에 실패했습니다.' }));
    }
  };

  // ── 진료 기록 연동 ──────────────────────────────────────────────────
  const startMedical = async () => {
    if (!formReady) return;
    setMedical({ ...INIT, state: 'requesting' });
    try {
      const { data } = await healthAPI.syncMedicalStep1({
        userId,
        userName: form.userName, phoneNo: form.phoneNo,
        identity13: cleanId,
        telecom: needsTelecom ? form.telecom : '',
        loginTypeLevel: form.loginTypeLevel,
      });
      setMedical(f => ({ ...f, state: 'auth', sessionKey: data.sessionKey }));
    } catch (err) {
      setMedical(f => ({ ...f, state: 'error', error: err.response?.data?.message || '요청 중 오류가 발생했습니다.' }));
    }
  };

  const confirmMedical = async () => {
    setMedical(f => ({ ...f, state: 'confirming', error: '' }));
    try {
      const { data } = await healthAPI.syncMedicalStep2({ sessionKey: medical.sessionKey });
      setMedical(f => ({ ...f, state: 'done', result: data }));
    } catch (err) {
      setMedical(f => ({ ...f, state: 'error', error: err.response?.data?.message || '인증에 실패했습니다.' }));
    }
  };

  const allDone = checkup.state === 'done' && medical.state === 'done';

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        {/* 헤더 */}
        <div style={s.header}>
          <div>
            <h3 style={s.title}>🔄 데이터 연동</h3>
            <p style={s.subtitle}>건강검진·보험과 진료 기록을 각각 별도로 연동합니다</p>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.body}>
          {/* 입력 폼 */}
          <div style={s.section}>
            <div style={s.sectionTitle}>📋 보험 정보 (내보험다보여)</div>
            <div style={s.row2}>
              <Field label="CODEF 아이디">
                <input name="codefId" value={form.codefId} onChange={handle}
                  placeholder="내보험다보여 아이디" style={s.input} />
              </Field>
              <Field label="CODEF 비밀번호">
                <input name="codefPassword" type="password" value={form.codefPassword} onChange={handle}
                  placeholder="내보험다보여 비밀번호" style={s.input} />
              </Field>
            </div>
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>🏥 건강검진 · 진료 (간편인증 공통 정보)</div>
            <div style={s.row2}>
              <Field label="이름">
                <input name="userName" value={form.userName} onChange={handle}
                  placeholder="홍길동" style={s.input} />
              </Field>
              <Field label="전화번호">
                <input name="phoneNo" value={form.phoneNo} onChange={handle}
                  placeholder="01012345678" style={s.input} />
              </Field>
            </div>
            <Field label="주민등록번호 (13자리)">
              <input name="identity13" type="password" value={form.identity13} onChange={handle}
                placeholder="하이픈 없이 13자리" maxLength={13} style={s.input} autoComplete="off" />
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

          {/* ── 연동 카드 두 개 ── */}
          <SyncCard
            title="🏥 건강검진 + 보험 연동"
            description="건강검진 결과 · 내보험다보여 계약정보"
            flow={checkup}
            authLabel={selectedAuth?.label}
            authIcon={selectedAuth?.icon}
            canStart={formReady && insuranceReady}
            cantStartMsg={!formReady ? '이름·전화번호·주민번호를 입력해주세요.' : 'CODEF 아이디·비밀번호를 입력해주세요.'}
            onStart={startCheckup}
            onConfirm={confirmCheckup}
            onRetry={() => setCheckup({ ...INIT })}
            resultNode={checkup.result && (
              <div style={s.resultText}>
                건강검진 {checkup.result.savedCheckups}건 저장
              </div>
            )}
          />

          <SyncCard
            title="📋 진료 기록 연동"
            description="내진료정보열람 (HIRA) · 진료내역 · 처방약"
            flow={medical}
            authLabel={selectedAuth?.label}
            authIcon={selectedAuth?.icon}
            canStart={formReady}
            cantStartMsg="이름·전화번호·주민번호를 입력해주세요."
            onStart={startMedical}
            onConfirm={confirmMedical}
            onRetry={() => setMedical({ ...INIT })}
            resultNode={medical.result && (
              <div style={s.resultText}>
                진료 기록 {medical.result.savedMedicals}건 · 처방약 {medical.result.savedMedications}건 저장
              </div>
            )}
          />

          {allDone && (
            <button onClick={() => { onSuccess?.(); onClose(); }} style={s.primaryBtn}>
              ✅ 완료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 연동 카드 컴포넌트 ────────────────────────────────────────────────
function SyncCard({ title, description, flow, authLabel, authIcon, canStart, cantStartMsg,
                    onStart, onConfirm, onRetry, resultNode }) {
  const isIdle       = flow.state === 'idle';
  const isRequesting = flow.state === 'requesting';
  const isAuth       = flow.state === 'auth';
  const isConfirming = flow.state === 'confirming';
  const isDone       = flow.state === 'done';
  const isError      = flow.state === 'error';

  return (
    <div style={{ ...s.card, ...(isDone ? s.cardDone : isError ? s.cardError : {}) }}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardTitle}>{title}</div>
          <div style={s.cardDesc}>{description}</div>
        </div>
        {isDone && <span style={s.badge}>완료 ✓</span>}
        {isError && <span style={{ ...s.badge, background: '#fef2f2', color: '#b91c1c' }}>실패</span>}
      </div>

      {isError && (
        <div style={s.errorBox}>
          {flow.error}
          <button onClick={onRetry} style={s.retryBtn}>다시 시도</button>
        </div>
      )}

      {isDone && resultNode}

      {isAuth && (
        <div style={s.appNotice}>
          <span style={{ fontSize: 36 }}>{authIcon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              {authLabel} 앱에서 인증을 승인해주세요
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              승인 후 아래 버튼을 눌러주세요
            </div>
          </div>
        </div>
      )}

      {(isIdle || isError) && !isDone && isIdle && (
        <button
          onClick={canStart ? onStart : undefined}
          disabled={!canStart}
          title={canStart ? '' : cantStartMsg}
          style={{ ...s.cardBtn, opacity: canStart ? 1 : 0.45 }}
        >
          연동 시작 →
        </button>
      )}

      {isRequesting && (
        <button disabled style={{ ...s.cardBtn, opacity: 0.7 }}>⏳ 요청 중...</button>
      )}

      {isAuth && (
        <button onClick={onConfirm} style={s.cardBtn}>인증 완료 →</button>
      )}

      {isConfirming && (
        <button disabled style={{ ...s.cardBtn, opacity: 0.7 }}>⏳ 처리 중...</button>
      )}
    </div>
  );
}

// ── 공통 필드 래퍼 ──────────────────────────────────────────────────
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
    background: '#fff', borderRadius: 20, width: '100%', maxWidth: 580,
    maxHeight: '92vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '22px 24px 0',
  },
  title:    { fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 3 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#94a3b8', padding: '2px 6px', borderRadius: 6, flexShrink: 0,
  },
  body: { display: 'flex', flexDirection: 'column', gap: 16, padding: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: {
    fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.3,
    paddingBottom: 6, borderBottom: '1px solid #f1f5f9',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
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
  // 연동 카드
  card: {
    border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 12,
    background: '#fafafa',
  },
  cardDone:  { border: '1.5px solid #86efac', background: '#f0fdf4' },
  cardError: { border: '1.5px solid #fecaca', background: '#fef2f2' },
  cardHeader:{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  cardDesc:  { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: {
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
    background: '#dcfce7', color: '#15803d', whiteSpace: 'nowrap',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, color: '#b91c1c',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  retryBtn: {
    background: 'none', border: '1px solid #fca5a5', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, color: '#b91c1c', cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  appNotice: {
    display: 'flex', gap: 14, alignItems: 'center',
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 12, padding: '14px 16px',
  },
  cardBtn: {
    padding: '11px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(29,78,216,0.25)',
  },
  resultText: { fontSize: 13, color: '#15803d', fontWeight: 600 },
  primaryBtn: {
    padding: '13px', background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
  },
};
