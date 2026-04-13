import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { healthAPI } from '../api/services';

const MOCK_CHECKUPS = [
  { year: 2025, healthAge: 38, actualAge: 42, height: 172, weight: 78, bmi: 26.4,
    bloodPressure: '128/82', bloodSugar: 98, cholesterol: 215,
    riskFactors: ['복부비만', '경계성 혈압'],
    results: [
      { category: '혈압', value: '128/82', status: 'WARNING', normal: '120/80 미만' },
      { category: '혈당', value: '98 mg/dL', status: 'NORMAL', normal: '100 미만' },
      { category: '콜레스테롤', value: '215 mg/dL', status: 'WARNING', normal: '200 미만' },
      { category: 'BMI', value: '26.4', status: 'WARNING', normal: '18.5~24.9' },
    ]
  },
  { year: 2024, healthAge: 40, actualAge: 41, height: 172, weight: 80, bmi: 27.0,
    bloodPressure: '132/85', bloodSugar: 102, cholesterol: 228,
    riskFactors: ['복부비만', '경계성 혈압', '경계성 혈당'],
    results: []
  }
];

const MOCK_DISEASES = [
  { type: '뇌졸중', riskGrade: 'LOW', riskRatio: 12.3, avgProbability: 18.5, riskFactors: ['고혈압 경계', '흡연력'] },
  { type: '당뇨', riskGrade: 'MEDIUM', riskRatio: 28.5, avgProbability: 22.0, riskFactors: ['복부비만', '경계성 혈당', '가족력'] },
  { type: '심뇌혈관', riskGrade: 'LOW', riskRatio: 15.2, avgProbability: 20.3, riskFactors: ['고혈압 경계'] },
];

const MOCK_TARGETS = [
  { name: '위암검진', dueDate: '2026-06', status: 'DUE' },
  { name: '대장암검진', dueDate: '2026-06', status: 'DUE' },
  { name: '구강검진', dueDate: '2026-06', status: 'OVERDUE' },
];

const CHART_DATA = [
  { year: 2023, bloodPressure: 135, bloodSugar: 105, cholesterol: 220 },
  { year: 2024, bloodPressure: 132, bloodSugar: 102, cholesterol: 228 },
  { year: 2025, bloodPressure: 128, bloodSugar: 98, cholesterol: 215 },
];

const CheckupRecords = () => {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [checkups, setCheckups] = useState(MOCK_CHECKUPS);
  const [diseases, setDiseases] = useState(MOCK_DISEASES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCheckups = async () => {
      setLoading(true);
      try {
        const data = await healthAPI.getCheckupRecords();
        setCheckups(data);
      } catch (error) {
        console.error('Failed to fetch checkups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCheckups();
  }, []);

  const currentCheckup = checkups.find(c => c.year === selectedYear) || checkups[0];

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

  const healthAgeCardStyle = {
    ...cardStyle,
    background: currentCheckup.healthAge < currentCheckup.actualAge ? '#dcfce7' : '#fee2e2',
  };

  const healthAgeTextStyle = {
    fontSize: '24px',
    fontWeight: '700',
    color: currentCheckup.healthAge < currentCheckup.actualAge ? '#16a34a' : '#dc2626',
    marginBottom: '8px',
  };

  const tabContainerStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  };

  const tabButtonStyle = (isActive) => ({
    padding: '10px 20px',
    backgroundColor: isActive ? '#1d4ed8' : '#e2e8f0',
    color: isActive ? '#fff' : '#0f172a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  });

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '16px',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '10px 8px',
    backgroundColor: '#f1f5f9',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '12px',
    fontWeight: '600',
  };

  const tdStyle = {
    padding: '10px 8px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '13px',
  };

  const badgeStyle = (status) => {
    const styles = {
      NORMAL: { background: '#dcfce7', color: '#16a34a' },
      WARNING: { background: '#fef3c7', color: '#d97706' },
      DANGER: { background: '#fee2e2', color: '#dc2626' },
    };
    return {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      ...styles[status],
    };
  };

  const riskCardStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #e2e8f0',
  };

  const riskGradeColors = {
    LOW: { bg: '#dbeafe', text: '#1d4ed8' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706' },
    HIGH: { bg: '#fee2e2', text: '#dc2626' },
  };

  const sectionTitleStyle = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '16px',
    marginTop: '20px',
  };

  const riskBarStyle = (probability) => ({
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  });

  const riskBarFillStyle = (probability) => ({
    height: '100%',
    width: `${probability}%`,
    backgroundColor: probability > 25 ? '#ef4444' : probability > 15 ? '#f59e0b' : '#22c55e',
  });

  const targetListStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  };

  const targetItemStyle = {
    background: '#fff',
    borderRadius: '10px',
    padding: '12px',
    borderLeft: '4px solid #f59e0b',
  };

  const overdueBadgeStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  };

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>건강검진 기록</h1>

      <div style={healthAgeCardStyle}>
        <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px 0' }}>건강나이</p>
        <div style={healthAgeTextStyle}>
          {currentCheckup.healthAge}세
        </div>
        <p style={{ fontSize: '13px', color: '#475569', margin: '0' }}>
          실제나이: {currentCheckup.actualAge}세 ({currentCheckup.healthAge - currentCheckup.actualAge > 0 ? '+' : ''}{currentCheckup.healthAge - currentCheckup.actualAge}세)
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={sectionTitleStyle}>검사 연도 선택</h3>
        <div style={tabContainerStyle}>
          {checkups.map(c => (
            <button
              key={c.year}
              style={tabButtonStyle(selectedYear === c.year)}
              onClick={() => setSelectedYear(c.year)}
            >
              {c.year}년
            </button>
          ))}
        </div>
      </div>

      {currentCheckup.results.length > 0 && (
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>검사 결과</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>검사항목</th>
                <th style={thStyle}>측정값</th>
                <th style={thStyle}>정상범위</th>
                <th style={thStyle}>상태</th>
              </tr>
            </thead>
            <tbody>
              {currentCheckup.results.map((result, idx) => (
                <tr key={idx}>
                  <td style={tdStyle}>{result.category}</td>
                  <td style={tdStyle}><strong>{result.value}</strong></td>
                  <td style={tdStyle}>{result.normal}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(result.status)}>
                      {result.status === 'NORMAL' ? '정상' : result.status === 'WARNING' ? '주의' : '경고'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>3년 추이 분석</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="bloodPressure" fill="#ef4444" name="혈압" />
            <Bar dataKey="bloodSugar" fill="#f59e0b" name="혈당" />
            <Bar dataKey="cholesterol" fill="#3b82f6" name="콜레스테롤" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>질병 위험도</h3>
        {diseases.map((disease, idx) => (
          <div key={idx} style={riskCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0', color: '#0f172a' }}>
                {disease.type}
              </h4>
              <span style={{
                padding: '4px 8px',
                backgroundColor: riskGradeColors[disease.riskGrade].bg,
                color: riskGradeColors[disease.riskGrade].text,
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
              }}>
                {disease.riskGrade === 'LOW' ? '낮음' : disease.riskGrade === 'MEDIUM' ? '중간' : '높음'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px 0' }}>
              위험률: {disease.avgProbability}%
            </p>
            <div style={riskBarStyle(disease.avgProbability)}>
              <div style={riskBarFillStyle(disease.avgProbability)} />
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '8px 0 0 0' }}>
              위험요인: {disease.riskFactors.join(', ')}
            </p>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>필수 검진 대상</h3>
        <div style={targetListStyle}>
          {MOCK_TARGETS.map((target, idx) => (
            <div key={idx} style={targetItemStyle}>
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', margin: '0 0 4px 0' }}>
                {target.name}
              </p>
              <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px 0' }}>
                {target.dueDate}
              </p>
              {target.status === 'OVERDUE' && (
                <span style={overdueBadgeStyle}>미접종</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CheckupRecords;
