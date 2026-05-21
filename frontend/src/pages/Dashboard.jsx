import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { healthAPI, insuranceAPI } from '../api/services';

const Icon = ({ children, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>
    {children}
  </svg>
);

const P = {
  arrow:  (<path d="M3 8h10M9 4l4 4-4 4" />),
  plus:   (<path d="M8 3v10M3 8h10" />),
  search: (<><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></>),
  clip:   (<><rect x="3" y="2" width="10" height="12" rx="1.5" /><path d="M6 2v2h4V2" /><path d="M5.5 8h5M5.5 10.5h3" /></>),
  chart:  (<path d="M2 14h12M4 14V9M7 14V6M10 14V8M13 14V4" />),
  chat:   (<><path d="M2 2h12v9H9l-3 3v-3H2V2z" /><path d="M5 6h6M5 8.5h4" /></>),
  shield: (<path d="M8 1 3 3.5v4C3 10 5.5 12.5 8 14c2.5-1.5 5-4 5-6.5v-4L8 1z" />),
};

const QUICK_ACTS = [
  { icon: 'search', title: '진료 전 보장 확인',  sub: '병원 가기 전에',  path: '/pre-treatment' },
  { icon: 'clip',   title: '최근 진료 기록',     sub: '방문 내역 확인', path: '/medical-records' },
  { icon: 'chart',  title: '12개월 건강 리포트', sub: '최신 분석',      path: '/health-report' },
  { icon: 'chat',   title: 'AI 건강 상담',       sub: '지금 채팅',      path: '/chat' },
];

// riskGrade: CODEF resRiskGrade "1"~"5"
const RISK_GRADE = {
  '1': { label: '낮음',    cls: 'lo' },
  '2': { label: '보통',    cls: 'lo' },
  '3': { label: '주의',    cls: 'mid' },
  '4': { label: '위험',    cls: 'hi' },
  '5': { label: '매우위험', cls: 'hi' },
};

const DISEASE_NAME = {
  'STROKE':        '뇌졸중',
  '뇌졸중':        '뇌졸중',
  'DIABETES':      '당뇨',
  '당뇨':          '당뇨',
  'CARDIO':        '심뇌관계',
  'CARDIOVASCULAR':'심뇌관계',
  '심뇌혈관':      '심뇌관계',
};

const GAP_STYLE = {
  hi:  { lc: '#BBA8A8', tc: '#7A5050', tb: '#F2ECEC', label: '필수' },
  mid: { lc: '#C0B890', tc: '#7A6A40', tb: '#F4EFDE', label: '권장' },
  lo:  { lc: '#A8B8BB', tc: '#405A7A', tb: '#ECF0F2', label: '확인' },
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [visits, setVisits]           = useState([]);
  const [risks, setRisks]             = useState([]);
  const [gaps, setGaps]               = useState([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [topDept, setTopDept]         = useState('-');

  useEffect(() => {
    healthAPI.getMedicalRecords()
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setTotalVisits(rows.length);
        setVisits(rows.slice(0, 3).map((r) => ({
          hospital:  r.hospitalName || r.hospital || '-',
          date:      r.visitDate    || '-',
          diagnosis: r.diagnosis    || r.treatmentType || '-',
          dept:      r.department   || '-',
          type:      r.treatmentType || '-',
        })));
        // 가장 많이 방문한 진료과
        const deptCount = {};
        rows.forEach((r) => { if (r.department) deptCount[r.department] = (deptCount[r.department] || 0) + 1; });
        const top = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0];
        if (top) setTopDept(top[0]);
      })
      .catch(() => {});

    healthAPI.getDiseasePredictions()
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        // 질환별 최신 1건
        const latest = {};
        rows.forEach((r) => { if (!latest[r.predictionType]) latest[r.predictionType] = r; });
        // averageRatio: "69" 또는 "69/100" 형식 모두 처리
        const parseAvgRatio = (val) => {
          if (!val) return null;
          const s = String(val);
          return parseFloat(s.includes('/') ? s.split('/')[0] : s) || null;
        };
        const mapped = Object.values(latest).map((r) => {
          const ratio    = parseFloat(r.riskRatio) || 0;
          const avgRatio = parseAvgRatio(r.averageRatio);
          const grade    = RISK_GRADE[r.riskGrade] || { label: r.riskGrade || '-', cls: 'lo' };
          return {
            name:     DISEASE_NAME[r.predictionType] || r.predictionType,
            ratio,
            avgRatio,
            level:    grade.label,
            cls:      grade.cls,
            // 바 너비: 100명 중 내 순위 그대로 사용, 없으면 grade 기반 fallback
            pct:      avgRatio ?? { '1': 20, '2': 40, '3': 60, '4': 80, '5': 100 }[r.riskGrade] ?? 20,
          };
        });
        // 색상: 발병률 높은 순 상대 순위로 hi → mid → lo 배분
        const sortedByRatio = [...mapped].sort((a, b) => b.ratio - a.ratio);
        const RANK_CLS = ['hi', 'mid', 'lo'];
        setRisks(mapped.map((r) => ({
          ...r,
          cls: RANK_CLS[Math.min(sortedByRatio.findIndex((s) => s.name === r.name), 2)],
        })));
      })
      .catch(() => {});

    insuranceAPI.getCoverageComparison()
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const gapItems = rows
          .filter((r) => {
            const self = r.selfCoverageAmount ?? r.self_coverage_amount ?? 0;
            const avg  = r.avgGroupCoverageAmount ?? r.avg_group_coverage_amount ?? 0;
            return avg > 0 && self < avg;
          })
          .slice(0, 3)
          .map((r) => {
            const self = r.selfCoverageAmount ?? r.self_coverage_amount ?? 0;
            const avg  = r.avgGroupCoverageAmount ?? r.avg_group_coverage_amount ?? 1;
            const pct  = Math.round((1 - self / avg) * 100);
            const severity = pct >= 70 ? 'hi' : pct >= 30 ? 'mid' : 'lo';
            return {
              name:     r.coverageName ?? r.coverage_name ?? '-',
              desc:     `평균 대비 ${pct}% 부족`,
              severity,
            };
          });
        setGaps(gapItems);
      })
      .catch(() => {});
  }, []);

  const topRisk = risks.length > 0
    ? risks.reduce((a, b) => (a.ratio > b.ratio ? a : b))
    : null;

  const RISK_COLOR = { hi: '#9A6060', mid: '#8A7040', lo: '#3A7A62' };

  const stats = [
    { lbl: '최근 진료 기록', val: `${totalVisits}건`,            meta: '최근 12개월 기준',                               blue: true,  color: null },
    { lbl: '건강 위험도',    val: topRisk ? topRisk.level : '-', meta: topRisk ? `${topRisk.name} 주의 구간` : '데이터 없음',
      color: null },
    { lbl: '보험 공백',      val: gaps.length > 0 ? `${gaps.length}개 항목` : '확인 필요',
      meta: gaps.length > 0 ? '즉시 개선 권장' : '보험 공백 페이지 확인', color: null },
  ];

  return (
    <div className="mc-page fade-in">
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
            <div
              className={`mc-stat-val${s.blue ? ' blue' : ''}`}
              style={s.color ? { color: s.color } : undefined}
            >
              {s.val}
            </div>
            <div className="mc-stat-meta">{s.meta}</div>
          </div>
        ))}
      </div>

      {/* Medical records + Risk */}
      <div className="mc-two-col">
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
                <th>병원</th>
                <th>날짜</th>
                <th>병명 / 진료 내역</th>
              </tr>
            </thead>
            <tbody>
              {visits.length > 0 ? visits.map((c, i) => (
                <tr key={i} onClick={() => navigate('/medical-records')} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="mc-tbl-hospital">{c.hospital}</div>
                    {c.dept !== '-' && <div className="mc-tbl-detail">{c.dept}</div>}
                  </td>
                  <td><span className="mc-tbl-date">{c.date}</span></td>
                  <td style={{ color: 'var(--text-1)', fontSize: 13 }}>{c.diagnosis}</td>
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
                  <span className={`mc-risk-lvl ${r.cls}`}>
                    {r.level}
                    {r.avgRatio != null && (
                      <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
                        100명 중 {r.avgRatio}번째
                      </span>
                    )}
                  </span>
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

        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">보험 공백</span>
            <button className="mc-sec-link" onClick={() => navigate('/insurance-plan')}>
              개선하기 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <div className="mc-gap-list">
            {gaps.length > 0 ? gaps.map((g, i) => {
              const s = GAP_STYLE[g.severity] || GAP_STYLE.mid;
              return (
                <div className="mc-gap-row" key={i}>
                  <div className="mc-gap-accent" style={{ background: s.lc }} />
                  <div className="mc-gap-info">
                    <div className="mc-gap-name">{g.name}</div>
                    <div className="mc-gap-sub">{g.desc}</div>
                  </div>
                  <span className="mc-gap-tag" style={{ color: s.tc, background: s.tb }}>{s.label}</span>
                </div>
              );
            }) : (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 16px' }}>
                보험 공백 데이터가 없어요.
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
              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{topDept}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
