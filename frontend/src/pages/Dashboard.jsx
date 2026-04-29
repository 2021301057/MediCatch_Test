import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * MediCatch 대시보드 — 디자인 handoff에 맞춰 재작성.
 * 시각적 출력물을 픽셀 단위로 재현하는 것이 목표.
 */

// ── SVG 아이콘 헬퍼 ──────────────────────────────
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

// ── Mock 데이터 ──────────────────────────────────
const MOCK = {
  claims: [
    { hospital: '서울성모병원', detail: '입원진료 실손 · 2024.03.11', amount: '+45,000원',  date: '3일 전',  ok: true },
    { hospital: '연세세브란스',  detail: '안과 수술 실손 · 2024.03.04', amount: '+120,000원', date: '10일 전', ok: true },
    { hospital: '강남성심병원', detail: '물리치료 · 2024.02.20',       amount: '+28,000원',  date: '22일 전', ok: false },
  ],
  risks: [
    { name: '비만증',   pct: 72, level: '위험', cls: 'hi' },
    { name: '당뇨',    pct: 55, level: '주의', cls: 'mid' },
    { name: '심뇌관계', pct: 38, level: '보통', cls: 'lo' },
  ],
  quickActs: [
    { icon: 'search', title: '진료 전 보장 확인',   sub: '병원 가기 전에',  path: '/pre-treatment' },
    { icon: 'clip',   title: '최근 진료 기록',      sub: '미처리 4건',     path: '/medical-records' },
    { icon: 'chart',  title: '12개월 건강 리포트',  sub: '최신 분석',      path: '/health-report' },
    { icon: 'chat',   title: 'AI 건강 상담',        sub: '지금 채팅',      path: '/chat' },
  ],
  gaps: [
    { name: '암 진단비 보장', desc: '현재 진단금 미가입 상태', level: '필수', lc: '#BBA8A8', tc: '#7A5050', tb: '#F2ECEC' },
    { name: '치매 간병 특약', desc: '가족력 고위험군 해당',   level: '권장', lc: '#C0B890', tc: '#7A6A40', tb: '#F4EFDE' },
  ],
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data] = useState(MOCK);

  const stats = [
    { lbl: '월 보험료 합계',   val: '387,000원', meta: '3개 보험사 통합',           blue: false },
    { lbl: '청구 가능 보험금', val: '2건 발견',  pill: '+165,000원 예상',          blue: true },
    { lbl: '건강 위험도',      val: '중위험',    meta: '비만 · 당뇨 주의 구간',     blue: false },
    { lbl: '보험 공백',        val: '2개 항목',  meta: '즉시 개선 권장',            blue: false },
  ];

  return (
    <div className="mc-page fade-in">
      {/* Header */}
      <div className="mc-page-top">
        <div>
          <div className="mc-greeting-name">안녕하세요, {user?.name || '김사용'} 님</div>
          <div className="mc-greeting-sub">미처리 보험 청구 2건이 확인됩니다. 지금 청구해보세요.</div>
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
            {s.pill
              ? <span className="mc-stat-pill">{s.pill}</span>
              : <div className="mc-stat-meta">{s.meta}</div>}
          </div>
        ))}
      </div>

      {/* Claims + Risk */}
      <div className="mc-two-col">
        {/* 청구 가능한 보험금 */}
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">청구 가능한 보험금</span>
            <button className="mc-sec-link" onClick={() => navigate('/medical-records')}>
              전체 보기 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <table className="mc-tbl">
            <thead>
              <tr>
                <th>병원 / 내역</th>
                <th>날짜</th>
                <th>예상 금액</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {data.claims.map((c, i) => (
                <tr key={i} onClick={() => navigate('/medical-records')}>
                  <td>
                    <div className="mc-tbl-hospital">{c.hospital}</div>
                    <div className="mc-tbl-detail">{c.detail}</div>
                  </td>
                  <td><span className="mc-tbl-date">{c.date}</span></td>
                  <td><span className="mc-tbl-amount">{c.amount}</span></td>
                  <td>
                    {c.ok
                      ? (
                        <button
                          className="mc-tbl-action"
                          onClick={(e) => { e.stopPropagation(); navigate('/medical-records'); }}
                        >
                          <Icon size={11}>{P.check}</Icon> 청구하기
                        </button>
                      )
                      : <span className="mc-tbl-tag">검토 중</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mc-tbl-footer">
            <span className="mc-tbl-footer-label">총 예상 수령액</span>
            <span className="mc-tbl-footer-value">+193,000원</span>
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
            {data.risks.map((r, i) => (
              <div className="mc-risk-row" key={i}>
                <div className="mc-risk-meta">
                  <span className="mc-risk-name">{r.name}</span>
                  <span className={`mc-risk-lvl ${r.cls}`}>{r.level}</span>
                </div>
                <div className="mc-risk-bar">
                  <div className={`mc-risk-fill ${r.cls}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
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
            {data.quickActs.map((a, i) => (
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
            {data.gaps.map((g, i) => (
              <div className="mc-gap-row" key={i}>
                <div className="mc-gap-accent" style={{ background: g.lc }} />
                <div className="mc-gap-info">
                  <div className="mc-gap-name">{g.name}</div>
                  <div className="mc-gap-sub">{g.desc}</div>
                </div>
                <span className="mc-gap-tag" style={{ color: g.tc, background: g.tb }}>{g.level}</span>
              </div>
            ))}
            <div className="mc-gap-footer">
              <button
                className="mc-btn mc-btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={() => navigate('/insurance-plan')}
              >
                <Icon size={12}>{P.plus}</Icon> 보험 추천 받기
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
            <div className="mc-widget-section-lbl">최근 청구 현황</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: 'var(--text-2)' }}>이번 달 청구</span>
              <span style={{ fontWeight: 700, color: 'var(--blue)' }}>2건</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>누적 수령액</span>
              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>385,000원</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
