import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { recommendAPI } from '../api/services';

const MOCK_GAPS = [
  { category: '암 보장', current: 30000000, recommended: 50000000, gap: 20000000, riskGrade: 'HIGH', color: '#ef4444' },
  { category: '뇌질환 보장', current: 0, recommended: 20000000, gap: 20000000, riskGrade: 'HIGH', color: '#ef4444' },
  { category: '심혈관 보장', current: 0, recommended: 20000000, gap: 20000000, riskGrade: 'MEDIUM', color: '#f59e0b' },
  { category: '입원 일당', current: 30000, recommended: 50000, gap: 20000, riskGrade: 'LOW', color: '#3b82f6' },
  { category: '치아 보장', current: 2000000, recommended: 2000000, gap: 0, riskGrade: 'NORMAL', color: '#22c55e' },
];

const MOCK_RECOMMENDATIONS = [
  { id: 1, company: 'DB손해보험', product: 'DB 무배당 암보험 2025', monthlyPremium: 45000, reason: '현재 암 보장이 부족합니다. 당뇨 위험도를 고려한 암 보장 강화 상품입니다.' },
  { id: 2, company: '교보생명', product: '교보 뇌심혈관 특약', monthlyPremium: 28000, reason: '뇌졸중 위험도 대비 뇌질환 보장이 전혀 없습니다.' },
];

const CHART_DATA = [
  { category: '암 보장', current: 30, recommended: 50 },
  { category: '뇌질환 보장', current: 0, recommended: 20 },
  { category: '심혈관 보장', current: 0, recommended: 20 },
  { category: '입원 일당', current: 30, recommended: 50 },
  { category: '치아 보장', current: 2, recommended: 2 },
];

const InsurancePlan = () => {
  const navigate = useNavigate();
  const [gaps, setGaps] = useState(MOCK_GAPS);
  const [recommendations, setRecommendations] = useState(MOCK_RECOMMENDATIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      try {
        const data = await recommendAPI.getCoveragePlan();
        setGaps(data.gaps);
        setRecommendations(data.recommendations);
      } catch (error) {
        console.error('Failed to fetch plan:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, []);

  const totalGap = gaps.reduce((sum, g) => sum + g.gap, 0);
  const totalCurrent = gaps.reduce((sum, g) => sum + g.current, 0);
  const totalRecommended = gaps.reduce((sum, g) => sum + g.recommended, 0);

  const currentPremium = 297000;
  const optimizedPremium = 285000;

  const handleAskAI = () => {
    navigate('/chat?query=보험 보장 최적화');
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}백만원`;
    }
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pageStyle = {
    padding: '20px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  };

  const titleStyle = {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '20px',
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    marginBottom: '16px',
  };

  const scoreCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
    color: '#fff',
    textAlign: 'center',
  };

  const scoreValueStyle = {
    fontSize: '36px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  };

  const scoreDescStyle = {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: '0',
  };

  const gapItemStyle = {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
  };

  const gapHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };

  const gapTitleStyle = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#0f172a',
  };

  const gapRiskBadgeStyle = (grade) => {
    const styles = {
      HIGH: { bg: '#fee2e2', text: '#dc2626' },
      MEDIUM: { bg: '#fef3c7', text: '#d97706' },
      LOW: { bg: '#dbeafe', text: '#1d4ed8' },
      NORMAL: { bg: '#dcfce7', text: '#16a34a' },
    };
    return {
      display: 'inline-block',
      padding: '4px 8px',
      backgroundColor: styles[grade].bg,
      color: styles[grade].text,
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
    };
  };

  const barContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  };

  const barStyle = {
    flex: 1,
    height: '20px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  };

  const barFillStyle = (color, percentage) => ({
    height: '100%',
    width: `${Math.min(percentage, 100)}%`,
    backgroundColor: color,
  });

  const barLabelStyle = {
    fontSize: '11px',
    color: '#475569',
  };

  const gapInfoStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    fontSize: '11px',
    color: '#475569',
  };

  const gapInfoItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
  };

  const recommendationCardStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    border: '2px solid #e2e8f0',
    marginBottom: '12px',
  };

  const recommendationHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '8px',
  };

  const recommendationCompanyStyle = {
    fontSize: '12px',
    color: '#64748b',
  };

  const recommendationProductStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px',
  };

  const recommendationPremiumStyle = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1d4ed8',
  };

  const recommendationReasonStyle = {
    fontSize: '12px',
    color: '#475569',
    lineHeight: '1.5',
  };

  const optimizationCardStyle = {
    ...cardStyle,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
  };

  const optimizationTitleStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#15803d',
    marginBottom: '12px',
  };

  const optimizationItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '13px',
    borderBottom: '1px solid #d1fae5',
  };

  const optimizationLastItemStyle = {
    ...optimizationItemStyle,
    borderBottom: 'none',
  };

  const savingStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#16a34a',
  };

  const buttonStyle = {
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    width: '100%',
    marginTop: '16px',
  };

  const sectionTitleStyle = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '16px',
    marginTop: '20px',
  };

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>보험 보장 분석</h1>

      <div style={scoreCardStyle}>
        <div style={scoreValueStyle}>73점</div>
        <div style={scoreDescStyle}>현재 보장 수준 (만점 100점)</div>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>보장 범위 분석</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" interval={0} tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip formatter={(value) => `${value}만원`} />
            <Legend />
            <Bar dataKey="current" fill="#3b82f6" name="현재 보장" />
            <Bar dataKey="recommended" fill="#10b981" name="권장 보장" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>보장 부족 항목</h3>
        {gaps.map((gap, idx) => (
          <div key={idx} style={gapItemStyle}>
            <div style={gapHeaderStyle}>
              <span style={gapTitleStyle}>{gap.category}</span>
              <span style={gapRiskBadgeStyle(gap.riskGrade)}>
                {gap.riskGrade === 'HIGH' ? '높음' : gap.riskGrade === 'MEDIUM' ? '중간' : gap.riskGrade === 'LOW' ? '낮음' : '정상'}
              </span>
            </div>

            <div style={barContainerStyle}>
              <div style={barStyle}>
                <div style={barFillStyle(gap.color, (gap.current / gap.recommended) * 100)} />
              </div>
              <span style={barLabelStyle}>
                {formatCurrency(gap.current)} / {formatCurrency(gap.recommended)}
              </span>
            </div>

            {gap.gap > 0 && (
              <div style={gapInfoStyle}>
                <div style={gapInfoItemStyle}>
                  <span>부족액:</span>
                  <strong style={{ color: '#dc2626' }}>{formatCurrency(gap.gap)}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>추천 보험 상품</h3>
        {recommendations.map((rec, idx) => (
          <div key={idx} style={recommendationCardStyle}>
            <div style={recommendationHeaderStyle}>
              <div>
                <div style={recommendationCompanyStyle}>{rec.company}</div>
                <div style={recommendationProductStyle}>{rec.product}</div>
              </div>
              <div style={recommendationPremiumStyle}>
                +{formatCurrency(rec.monthlyPremium)} / 월
              </div>
            </div>
            <p style={recommendationReasonStyle}>{rec.reason}</p>
          </div>
        ))}
      </div>

      <div style={optimizationCardStyle}>
        <h3 style={optimizationTitleStyle}>보험료 최적화</h3>
        <div style={optimizationItemStyle}>
          <span>현재 월 보험료:</span>
          <strong>{formatCurrency(currentPremium)}</strong>
        </div>
        <div style={optimizationItemStyle}>
          <span>추가 월 보험료:</span>
          <strong>+{formatCurrency(45000 + 28000)}</strong>
        </div>
        <div style={optimizationLastItemStyle}>
          <span>최적화 시 월 보험료:</span>
          <strong style={savingStyle}>{formatCurrency(currentPremium + 45000 + 28000)} (+73,000원)</strong>
        </div>
      </div>

      <button style={buttonStyle} onClick={handleAskAI}>
        AI에게 물어보기 →
      </button>
    </div>
  );
};

export default InsurancePlan;
