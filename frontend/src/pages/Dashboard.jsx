import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { insuranceAPI, analysisAPI, healthAPI } from '../api/services';
import useAuthStore from '../store/authStore';

// Mock 데이터 (API 연결 전 사용)
const MOCK = {
  summary: { totalPremium: 387000, policyCount: 3, claimOpportunities: 2, riskGrade: 'MEDIUM' },
  claims: [
    { id: 1, hospital: '서울성모병원', date: '2026-03-15', amount: 45000, status: 'AVAILABLE', insurance: '삼성생명 실손' },
    { id: 2, hospital: '연세세브란스', date: '2026-02-28', amount: 120000, status: 'AVAILABLE', insurance: '한화생명 암보험' },
  ],
  riskSummary: { stroke: 'LOW', diabetes: 'MEDIUM', cardiovascular: 'LOW' },
};

const RISK_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e', NORMAL: '#3b82f6' };
const RISK_LABEL = { HIGH: '고위험', MEDIUM: '중위험', LOW: '저위험', NORMAL: '정상' };

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState(MOCK);
  const [syncing, setSyncing] = useState(false);

  const syncCodef = async () => {
    setSyncing(true);
    try {
      await Promise.all([healthAPI.syncFromCodef(), insuranceAPI.syncFromCodef()]);
      alert('CODEF 데이터 동기화 완료!');
    } catch { alert('동기화 실패. CODEF 연동을 확인해주세요.'); }
    finally { setSyncing(false); }
  };

  const cards = [
    { label: '월 보험료 합계', value: `${data.summary.totalPremium.toLocaleString()}원`, sub: '3개 보험사', icon: '💰', color: '#1d4ed8', path: '/insurance' },
    { label: '청구 가능 보험금', value: `${data.summary.claimOpportunities}건 발견`, sub: '지금 확인하세요!', icon: '🔔', color: '#dc2626', path: '/medical-records' },
    { label: '건강 위험도', value: RISK_LABEL[data.summary.riskGrade], sub: '종합 평가', icon: '❤️', color: RISK_COLOR[data.summary.riskGrade], path: '/checkup' },
    { label: '보장 공백', value: '2개 항목', sub: '개선 가능', icon: '📊', color: '#f59e0b', path: '/insurance-plan' },
  ];

  return (
    <div>
      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <h2 style={s.greeting}>안녕하세요, {user?.name || '사용자'}님 👋</h2>
          <p style={s.subtext}>오늘도 건강한 하루 되세요. 놓친 보험금이 없는지 확인해보세요.</p>
        </div>
        <button onClick={syncCodef} disabled={syncing} style={s.syncBtn}>
          {syncing ? '⏳ 동기화 중...' : '🔄 CODEF 데이터 갱신'}
        </button>
      </div>

      {/* 요약 카드 */}
      <div style={s.cardGrid}>
        {cards.map(c => (
          <div key={c.label} onClick={() => navigate(c.path)} style={{ ...s.card, cursor: 'pointer' }}>
            <div style={{ ...s.cardIcon, background: c.color + '20', color: c.color }}>{c.icon}</div>
            <div style={s.cardValue} >{c.value}</div>
            <div style={s.cardLabel}>{c.label}</div>
            <div style={s.cardSub}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={s.twoCol}>
        {/* 청구 가능 알림 */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h3 style={s.sectionTitle}>🔔 청구 가능한 보험금</h3>
            <button onClick={() => navigate('/medical-records')} style={s.linkBtn}>전체 보기 →</button>
          </div>
          {data.claims.map(c => (
            <div key={c.id} style={s.claimCard}>
              <div style={s.claimLeft}>
                <div style={s.claimHospital}>{c.hospital}</div>
                <div style={s.claimDate}>{c.date} · {c.insurance}</div>
              </div>
              <div style={s.claimRight}>
                <div style={s.claimAmount}>+{c.amount.toLocaleString()}원</div>
                <button onClick={() => navigate('/medical-records')} style={s.claimBtn}>청구하기</button>
              </div>
            </div>
          ))}
        </div>

        {/* 건강 위험도 */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h3 style={s.sectionTitle}>❤️ 건강 위험도 요약</h3>
            <button onClick={() => navigate('/checkup')} style={s.linkBtn}>상세 보기 →</button>
          </div>
          {Object.entries(data.riskSummary).map(([key, grade]) => {
            const labels = { stroke: '뇌졸중', diabetes: '당뇨', cardiovascular: '심뇌혈관' };
            return (
              <div key={key} style={s.riskRow}>
                <span style={s.riskLabel}>{labels[key]}</span>
                <div style={s.riskBar}>
                  <div style={{ ...s.riskFill, width: grade === 'HIGH' ? '80%' : grade === 'MEDIUM' ? '50%' : '25%', background: RISK_COLOR[grade] }} />
                </div>
                <span style={{ ...s.riskGrade, color: RISK_COLOR[grade] }}>{RISK_LABEL[grade]}</span>
              </div>
            );
          })}
          <div style={s.chatPrompt} onClick={() => navigate('/chat')}>
            <span>💬</span>
            <span>"내 건강 위험도에 대해 자세히 알려줘" → AI에게 물어보기</span>
          </div>
        </div>
      </div>

      {/* 빠른 기능 */}
      <div style={s.section}>
        <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>⚡ 빠른 기능</h3>
        <div style={s.quickGrid}>
          {[
            { icon: '🔍', title: '도수치료 보험 되나요?', sub: '진료 전 보장 검색', path: '/pre-treatment' },
            { icon: '📋', title: '최근 진료 기록 확인', sub: '자동 수집된 내역', path: '/medical-records' },
            { icon: '📈', title: '12개월 건강 리포트', sub: '의료 패턴 분석', path: '/health-report' },
            { icon: '💬', title: 'AI에게 보험 물어보기', sub: '건강 채팅', path: '/chat' },
          ].map(q => (
            <div key={q.title} onClick={() => navigate(q.path)} style={s.quickCard}>
              <span style={s.quickIcon}>{q.icon}</span>
              <div style={s.quickTitle}>{q.title}</div>
              <div style={s.quickSub}>{q.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  subtext: { color: '#64748b', fontSize: 14 },
  syncBtn: { padding: '10px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  card: { background: '#fff', borderRadius: 14, padding: '20px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  cardIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 },
  cardValue: { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  cardLabel: { fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#94a3b8' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  section: { background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 16 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  linkBtn: { background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 13 },
  claimCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  claimLeft: {},
  claimHospital: { fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2 },
  claimDate: { fontSize: 12, color: '#94a3b8' },
  claimRight: { textAlign: 'right' },
  claimAmount: { fontSize: 16, fontWeight: 700, color: '#22c55e', marginBottom: 6 },
  claimBtn: { padding: '5px 12px', background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  riskRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  riskLabel: { width: 70, fontSize: 13, color: '#334155', fontWeight: 500 },
  riskBar: { flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  riskFill: { height: '100%', borderRadius: 4, transition: 'width .5s' },
  riskGrade: { width: 50, fontSize: 12, fontWeight: 700, textAlign: 'right' },
  chatPrompt: { marginTop: 16, padding: '10px 14px', background: '#f5f3ff', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: '#7c3aed' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  quickCard: { padding: '16px', background: '#f8fafc', borderRadius: 12, cursor: 'pointer', border: '1.5px solid #e2e8f0', transition: 'border-color .15s' },
  quickIcon: { fontSize: 24, marginBottom: 10, display: 'block' },
  quickTitle: { fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 },
  quickSub: { fontSize: 11, color: '#94a3b8' },
};
