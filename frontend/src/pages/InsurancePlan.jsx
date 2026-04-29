import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { recommendAPI, analysisAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  chat:    (<><path d="M2 2h12v9H9l-3 3v-3H2V2z"/><path d="M5 6h6M5 8.5h4"/></>),
  arrow:   (<path d="M3 8h10M9 4l4 4-4 4"/>),
  shield:  (<path d="M8 1.5l5.5 2v4.5C13.5 11.5 8 14.5 8 14.5S2.5 11.5 2.5 8V3.5L8 1.5z"/>),
  sparkle: (<><path d="M8 2v4M8 10v4M2 8h4M10 8h4"/></>),
};

const MOCK_GAPS = [
  { category: '암 보장',      current: 30000000, recommended: 50000000, gap: 20000000, riskGrade: 'HIGH' },
  { category: '뇌질환 보장',  current: 0,        recommended: 20000000, gap: 20000000, riskGrade: 'HIGH' },
  { category: '심혈관 보장',  current: 0,        recommended: 20000000, gap: 20000000, riskGrade: 'MEDIUM' },
  { category: '입원 일당',    current: 30000,    recommended: 50000,    gap: 20000,    riskGrade: 'LOW' },
  { category: '치아 보장',    current: 2000000,  recommended: 2000000,  gap: 0,        riskGrade: 'NORMAL' },
];

const MOCK_RECOMMENDATIONS = [
  { id: 1, company: 'DB손해보험', product: 'DB 무배당 암보험 2025', monthlyPremium: 45000,
    reason: '현재 암 보장이 부족합니다. 당뇨 위험도를 고려한 암 보장 강화 상품입니다.' },
  { id: 2, company: '교보생명', product: '교보 뇌심혈관 특약', monthlyPremium: 28000,
    reason: '뇌졸중 위험도 대비 뇌질환 보장이 전혀 없습니다.' },
];

const CHART_DATA = [
  { category: '암 보장',     current: 30, recommended: 50 },
  { category: '뇌질환 보장', current: 0,  recommended: 20 },
  { category: '심혈관 보장', current: 0,  recommended: 20 },
  { category: '입원 일당',   current: 30, recommended: 50 },
  { category: '치아 보장',   current: 2,  recommended: 2 },
];

const RISK_LABEL = { HIGH: '높음', MEDIUM: '중간', LOW: '낮음', NORMAL: '정상' };
const RISK_TAG   = { HIGH: 'mc-tag-danger', MEDIUM: 'mc-tag-warning', LOW: 'mc-tag-blue', NORMAL: 'mc-tag-success' };
const RISK_BAR   = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'blue', NORMAL: 'success' };

const formatCurrency = (amount) => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}천만원`;
  if (amount >= 1000000)  return `${(amount / 1000000).toFixed(1)}백만원`;
  return new Intl.NumberFormat('ko-KR').format(amount || 0) + '원';
};

const InsurancePlan = () => {
  const navigate = useNavigate();
  const [gaps, setGaps] = useState(MOCK_GAPS);
  const [recommendations, setRecommendations] = useState(MOCK_RECOMMENDATIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      try {
        const [gapData, recData] = await Promise.allSettled([
          analysisAPI.getCoverageGap(),
          recommendAPI.getProducts(),
        ]);
        if (gapData.status === 'fulfilled' && Array.isArray(gapData.value) && gapData.value.length) {
          setGaps(gapData.value);
        }
        if (recData.status === 'fulfilled' && Array.isArray(recData.value) && recData.value.length) {
          setRecommendations(recData.value);
        }
      } catch (error) {
        console.error('Failed to fetch plan:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, []);

  const score = 73;
  const currentPremium = 297000;
  const addPremium = recommendations.reduce((s, r) => s + (r.monthlyPremium || 0), 0);
  const optimizedPremium = currentPremium + addPremium;

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">보험 추천 & 공백</div>
          <div className="mc-page-subtitle">내 건강 데이터에 맞춰 보장 공백을 분석하고 최적 상품을 제안해요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn" onClick={() => navigate('/chat?query=보험 보장 최적화')}>
            <Ic d={P.chat} size={12}/> AI에게 물어보기
          </button>
        </div>
      </div>

      {/* 점수 카드 + 요약 2열 */}
      <div className="mc-two-col" style={{ gridTemplateColumns: '360px 1fr' }}>
        <div className="mc-card mc-card-body" style={{
          background: 'linear-gradient(135deg, #1E55C4 0%, #2F6FE8 100%)',
          color: '#fff', borderColor: 'transparent',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', opacity: 0.85,
          }}>
            <Ic d={P.shield} size={12}/> 보장 점수
          </div>
          <div style={{
            fontSize: 44, fontWeight: 800, letterSpacing: '-1px',
            marginTop: 8, lineHeight: 1,
          }}>
            {score}<span style={{ fontSize: 22, fontWeight: 600, marginLeft: 4 }}>/ 100</span>
          </div>
          <div style={{ fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>
            현재 보장 수준 · 보장 공백 {gaps.filter((g) => g.gap > 0).length}개 발견
          </div>
          <div className="mc-pbar" style={{ marginTop: 14, background: 'rgba(255,255,255,0.2)' }}>
            <div className="mc-pbar-fill" style={{ width: `${score}%`, background: '#fff' }}/>
          </div>
        </div>

        <div className="mc-grid-2">
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">현재 월 보험료</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>
              {formatCurrency(currentPremium)}
            </div>
            <div className="mc-stat-sub">매월 납입 중</div>
          </div>
          <div className="mc-card mc-card-body mc-card-accent-warning">
            <div className="mc-field-label">추가 권장 보험료</div>
            <div className="mc-stat-value" style={{ marginTop: 4, color: '#8A7040' }}>
              +{formatCurrency(addPremium)}
            </div>
            <div className="mc-stat-sub">{recommendations.length}개 상품 제안</div>
          </div>
          <div className="mc-card mc-card-body mc-card-accent-blue" style={{ gridColumn: 'span 2' }}>
            <div className="mc-row-between">
              <div>
                <div className="mc-field-label">최적화 후 월 보험료</div>
                <div className="mc-stat-value" style={{ marginTop: 4, color: 'var(--blue)' }}>
                  {formatCurrency(optimizedPremium)}
                </div>
              </div>
              <span className="mc-tag mc-tag-blue">
                <Ic d={P.sparkle} size={10}/> 추천
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 보장 범위 분석 차트 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">보장 범위 분석</span>
      </div>
      <div className="mc-card mc-card-body">
        <div className="mc-chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={CHART_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
              <XAxis
                dataKey="category" interval={0}
                tick={{ fill: '#4A5568', fontSize: 11 }}
                axisLine={{ stroke: '#DDE1EA' }}
              />
              <YAxis tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
              <Tooltip
                formatter={(v) => `${v}만원`}
                contentStyle={{
                  background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                  fontSize: 12, color: '#0D1520',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}/>
              <Bar dataKey="current"     fill="#9AA3B2" name="현재 보장"/>
              <Bar dataKey="recommended" fill="#2F6FE8" name="권장 보장"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 보장 부족 항목 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">보장 공백 상세</span>
      </div>
      <div className="mc-stack-sm">
        {gaps.map((gap, idx) => {
          const pct = gap.recommended
            ? Math.min((gap.current / gap.recommended) * 100, 100)
            : 100;
          return (
            <div key={idx} className="mc-card mc-card-body">
              <div className="mc-row-between" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                  {gap.category}
                </div>
                <span className={`mc-tag ${RISK_TAG[gap.riskGrade]}`}>
                  위험도 {RISK_LABEL[gap.riskGrade]}
                </span>
              </div>
              <div className="mc-pbar" style={{ height: 10 }}>
                <div
                  className={`mc-pbar-fill ${RISK_BAR[gap.riskGrade]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mc-row-between" style={{ marginTop: 10 }}>
                <div className="mc-card-sub">
                  현재 <strong style={{ color: 'var(--text-1)' }}>{formatCurrency(gap.current)}</strong>
                  <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>→</span>
                  권장 <strong style={{ color: 'var(--blue)' }}>{formatCurrency(gap.recommended)}</strong>
                </div>
                {gap.gap > 0 ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8A7040' }}>
                    부족 {formatCurrency(gap.gap)}
                  </div>
                ) : (
                  <span className="mc-tag mc-tag-success">충족</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 추천 상품 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">추천 보험 상품 · {recommendations.length}건</span>
      </div>
      <div className="mc-grid-2">
        {recommendations.map((rec) => (
          <div key={rec.id} className="mc-card">
            <div className="mc-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 6,
                  background: 'var(--blue-soft)', color: 'var(--blue)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, letterSpacing: '-0.4px',
                }}>
                  {rec.company?.charAt(0) || '보'}
                </div>
                <div>
                  <div className="mc-card-title">{rec.product || rec.productName}</div>
                  <div className="mc-card-sub">{rec.company || rec.companyName}</div>
                </div>
              </div>
              <div style={{
                fontSize: 15, fontWeight: 800, color: 'var(--blue)', letterSpacing: '-0.3px',
              }}>
                +{formatCurrency(rec.monthlyPremium)}
                <div className="mc-card-sub" style={{ textAlign: 'right', marginTop: 2 }}>/ 월</div>
              </div>
            </div>
            <div className="mc-card-body">
              <div className="mc-alert mc-alert-blue">
                <div>
                  <div className="mc-alert-title">추천 이유</div>
                  <div className="mc-alert-body">{rec.reason || rec.description}</div>
                </div>
              </div>
              <button
                className="mc-btn mc-btn-primary mc-btn-block"
                style={{ marginTop: 12 }}
                onClick={() => navigate(`/chat?query=${encodeURIComponent(rec.product || rec.productName || '')}`)}
              >
                <Ic d={P.arrow} size={12}/> 자세히 보기
              </button>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">보장 분석 불러오는 중…</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsurancePlan;
