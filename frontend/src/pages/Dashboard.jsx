import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { healthAPI, analysisAPI } from '../api/services';

const Icon = ({ children, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>
    {children}
  </svg>
);

const P = {
  arrow:  (<path d="M3 8h10M9 4l4 4-4 4" />),
  check:  (<path d="m3 8 4 4 6-7" />),
  plus:   (<path d="M8 3v10M3 8h10" />),
  search: (<><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></>),
  clip:   (<><rect x="3" y="2" width="10" height="12" rx="1.5" /><path d="M6 2v2h4V2" /><path d="M5.5 8h5M5.5 10.5h3" /></>),
  chart:  (<path d="M2 14h12M4 14V9M7 14V6M10 14V8M13 14V4" />),
  chat:   (<><path d="M2 2h12v9H9l-3 3v-3H2V2z" /><path d="M5 6h6M5 8.5h4" /></>),
  shield: (<path d="M8 1 3 3.5v4C3 10 5.5 12.5 8 14c2.5-1.5 5-4 5-6.5v-4L8 1z" />),
};

const QUICK_ACTS = [
  { icon: 'search', title: '진료 전 보장 확인',   sub: '병원 가기 전에',  path: '/pre-treatment' },
  { icon: 'clip',   title: '최근 진료 기록',      sub: '방문 내역 확인', path: '/medical-records' },
  { icon: 'chart',  title: '12개월 건강 리포트',  sub: '최신 분석',      path: '/health-report' },
  { icon: 'chat',   title: 'AI 건강 상담',        sub: '지금 채팅',      path: '/chat' },
];

const RISK_LEVEL_MAP = {
  '위험': 'hi', '높음': 'hi', 'HIGH': 'hi',
  '주의': 'mid', '보통': 'mid', 'MEDIUM': 'mid',
  '낮음': 'lo', '정상': 'lo', 'LOW': 'lo',
};

const DISEASE_NAME_MAP = {
  '뇌졸중': '뇌졸중', 'STROKE': '뇌졸중',
  '당뇨': '당뇨', 'DIABETES': '당뇨',
  '심뇌혈관': '심뇌관계', 'CARDIOVASCULAR': '심뇌관계',
};

const GAP_LEVEL_STYLE = {
  '필수': { lc: '#BBA8A8', tc: '#7A5050', tb: '#F2ECEC' },
  '권장': { lc: '#C0B890', tc: '#7A6A40', tb: '#F4EFDE' },
  '선택': { lc: '#A8B8BB', tc: '#405A7A', tb: '#ECF0F2' },
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [visits, setVisits] = useState([]);
  const [risks, setRisks] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [totalVisits, setTotalVisits] = useState(0);

  useEffect(() => {
    healthAPI.getMedicalRecords()
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setTotalVisits(rows.length);
        setVisits(rows.slice(0, 3).map((r) => ({
          hospital: r.hospitalName || r.hospital || '-',
          detail: r.treatmentType || '-',
          date: r.visitDate || '-',
          type: r.treatmentType || '-',
        })));
      })
      .catch(() => {});

    healthAPI.getDiseasePredictions()
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const latest = {};
        rows.forEach((r) => {
          const key = r.predictionType;
          if (!latest[key]) latest[key] = r;
        });
        setRisks(Object.values(latest).map((r) => ({
          name: DISEASE_NAME_MAP[r.predictionType] || r.predictionType,
          pct: Math.min(Math.round((r.riskRatio ?? 0) * 100), 100),
          level: r.riskGrade || '-',
          cls: RISK_LEVEL_MAP[r.riskGrade] || 'lo',
        })));
      })
      .catch(() => {});

    analysisAPI.getCoverageGap()
      .then((data) => {
        if (!data) return;
        const rawGaps = data.coverageGaps ?? [];
        if (Array.isArray(rawGaps) && rawGaps.length > 0) {
          setGaps(rawGaps.map((g) => ({
            name: g.coverageName ?? g.name ?? '-',
            desc: g.description ?? g.desc ?? '',
            level: g.priority ?? g.level ?? '권장',
          })));
        }
      })
      .catch(() => {});
  }, []);

  const topRisk = risks.length > 0
    ? risks.reduce((a, b) => (a.pct > b.pct ? a : b))
    : null;

  const stats = [
    { lbl: '최근 진료 기록',   val: `${totalVisits}건`,  meta: '최근 12개월 기준', blue: true },
    { lbl: '건강 위험도',      val: topRisk ? topRisk.level : '-', meta: topRisk ? `${topRisk.name} 주의 구간` : '데이터 없음', blue: false },
    { lbl: '보험 공백',        val: gaps.length > 0 ? `${gaps.length}개 항목` : '확인 필요', meta: gaps.length > 0 ? '즉시 개선 권장' : '보험 공백 페이지 확인', blue: false },
  ];

  return (
    <div className="mc-page fade-in">
      {/* Header */}
      <div className="mc-page-top">
        <div>
          <div className="mc-greeting-name">안녕하세요, {user?.name || '사용자'} 님</div>
          <div className="mc-greeting-sub">오늘도 건강한 하루 되세요. 내 건강 기록과 보험 현황을 한눈에 확인해보세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn mc-btn-primary" onClick={() => navigate('/insurance')}>
            <Icon size={12}>{P.shield}</Icon> 내 보험 현황 보기
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mc-stats-strip">
        {stats.map((s, i) => (
          <div className="mc-stat-cell" key={i}>
            <div className="mc-stat-lbl">{s.lbl}</div>
            <div className={`mc-stat-val${s.blue ? ' blue' : ''}`}>{s.val}</div>
            <div className="mc-stat-meta">{s.meta}</div>
          </div>
        ))}
      </div>

      {/* Medical records + Risk */}
      <div className="mc-two-col">
        {/* 최근 진료 기록 */}
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">최근 진료 기록</span>
            <button className="mc-sec-link" onClick={() => navigate('/medical-records')}>
              전체 보기 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <table className="mc-tbl">
            <thead>
              <tr>
                <th>병원 / 내역</th>
                <th>날짜</th>
                <th>구분</th>
              </tr>
            </thead>
            <tbody>
              {visits.length > 0 ? visits.map((c, i) => (
                <tr key={i} onClick={() => navigate('/medical-records')}>
                  <td>
                    <div className="mc-tbl-hospital">{c.hospital}</div>
                    <div className="mc-tbl-detail">{c.detail}</div>
                  </td>
                  <td><span className="mc-tbl-date">{c.date}</span></td>
                  <td><span className="mc-tbl-tag">{c.type}</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>
                    아직 연동된 진료 기록이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mc-tbl-footer">
            <span className="mc-tbl-footer-label">최근 방문 기록</span>
            <span className="mc-tbl-footer-value">총 {totalVisits}건</span>
          </div>
        </div>

        {/* Risk */}
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">건강 위험도</span>
            <button className="mc-sec-link" onClick={() => navigate('/health-report')}>
              리포트 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <div className="mc-risk-list">
            {risks.length > 0 ? risks.map((r, i) => (
              <div className="mc-risk-row" key={i}>
                <div className="mc-risk-meta">
                  <span className="mc-risk-name">{r.name}</span>
                  <span className={`mc-risk-lvl ${r.cls}`}>{r.level}</span>
                </div>
                <div className="mc-risk-bar">
                  <div className={`mc-risk-fill ${r.cls}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
                건강 위험도 데이터가 없어요.
              </div>
            )}
          </div>
          <div className="mc-ai-strip" onClick={() => navigate('/chat')}>
            <strong>AI 인사이트</strong> — 내 건강 이력 기반 맞춤 보험·보건 어드바이스 →
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mc-three-col">
        {/* Quick actions */}
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">빠른 기능</span>
          </div>
          <div className="mc-action-grid">
            {QUICK_ACTS.map((a, i) => (
              <button className="mc-action-cell" key={i} onClick={() => navigate(a.path)}>
                <div className="mc-action-icon"><Icon size={13}>{P[a.icon]}</Icon></div>
                <div className="mc-action-title">{a.title}</div>
                <div className="mc-action-sub">{a.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Insurance gap */}
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">보험 공백</span>
            <button className="mc-sec-link" onClick={() => navigate('/insurance-plan')}>
              개선하기 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <div className="mc-gap-list">
            {gaps.length > 0 ? gaps.map((g, i) => {
              const style = GAP_LEVEL_STYLE[g.level] || GAP_LEVEL_STYLE['권장'];
              return (
                <div className="mc-gap-row" key={i}>
                  <div className="mc-gap-accent" style={{ background: style.lc }} />
                  <div className="mc-gap-info">
                    <div className="mc-gap-name">{g.name}</div>
                    <div className="mc-gap-sub">{g.desc}</div>
                  </div>
                  <span className="mc-gap-tag" style={{ color: style.tc, background: style.tb }}>{g.level}</span>
                </div>
              );
            }) : (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
                보험 공백 분석 데이터가 없어요.
              </div>
            )}
            <div className="mc-gap-footer">
              <button
                className="mc-btn mc-btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={() => navigate('/insurance-plan')}
              >
                <Icon size={12}>{P.plus}</Icon> 보험 공백 확인
              </button>
            </div>
          </div>
        </div>

        {/* Upcoming widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="mc-sec-head">
            <span className="mc-sec-title">다가오는 검진</span>
          </div>
          <div className="mc-widget">
            <div className="mc-widget-title">국가건강검진</div>
            <div className="mc-widget-sub">2024년 대상자 · 예약 필요</div>
            <button
              className="mc-btn"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
              onClick={() => navigate('/checkup')}
            >
              예약하기
            </button>
          </div>
          <div className="mc-widget mc-widget-tight">
            <div className="mc-widget-section-lbl">최근 진료 요약</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: 'var(--text-2)' }}>최근 방문</span>
              <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{totalVisits}건</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>주요 진료과</span>
              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>
                {visits.length > 0 ? (visits[0].detail || '-') : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
