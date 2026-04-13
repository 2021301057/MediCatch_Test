import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { analysisAPI } from '../api/services';

const MOCK_MONTHLY = [
  { month: '3월', medicalCost: 65000, claimed: 45000, unclaimed: 20000 },
  { month: '2월', medicalCost: 328000, claimed: 250000, unclaimed: 78000 },
  { month: '1월', medicalCost: 8500, claimed: 0, unclaimed: 8500 },
  { month: '12월', medicalCost: 28000, claimed: 0, unclaimed: 28000 },
  { month: '11월', medicalCost: 145000, claimed: 120000, unclaimed: 25000 },
  { month: '10월', medicalCost: 0, claimed: 0, unclaimed: 0 },
  { month: '9월', medicalCost: 52000, claimed: 40000, unclaimed: 12000 },
  { month: '8월', medicalCost: 88000, claimed: 65000, unclaimed: 23000 },
];

const MOCK_RISK_TREND = [
  { year: '2023', stroke: 8, diabetes: 20, cardio: 10 },
  { year: '2024', stroke: 10, diabetes: 25, cardio: 12 },
  { year: '2025', stroke: 12, diabetes: 28, cardio: 15 },
];

const PIE_DATA = [
  { name: '급여', value: 520000 },
  { name: '비급여', value: 194500 },
];

const COLORS = ['#10b981', '#f59e0b'];

const MOCK_STATS = {
  totalSpending: 714500,
  totalClaimed: 520000,
  unclaimedAmount: 194500,
  visitCount: 8,
  topHospital: '서울성모병원',
  topDepartment: '내과',
};

const VACCINATION_DATA = [
  { name: '독감', status: true, date: '2025-10-15' },
  { name: '폐렴구균', status: true, date: '2025-09-20' },
  { name: '코로나', status: true, date: '2025-04-10' },
  { name: 'B형간염', status: false, date: null },
];

const HealthReport = () => {
  const [monthlyData, setMonthlyData] = useState(MOCK_MONTHLY);
  const [riskTrend, setRiskTrend] = useState(MOCK_RISK_TREND);
  const [stats, setStats] = useState(MOCK_STATS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await analysisAPI.getHealthReport();
        setMonthlyData(data.monthly);
        setRiskTrend(data.riskTrend);
        setStats(data.stats);
      } catch (error) {
        console.error('Failed to fetch report:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  const handlePDFDownload = () => {
    alert('PDF 다운로드 기능은 준비 중입니다.');
  };

  const formatCurrency = (amount) => {
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

  const summaryGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  };

  const summaryItemStyle = {
    ...cardStyle,
    marginBottom: '0',
    padding: '16px',
  };

  const summaryLabelStyle = {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '6px',
  };

  const summaryValueStyle = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px',
  };

  const summaryDescStyle = {
    fontSize: '10px',
    color: '#94a3b8',
  };

  const sectionTitleStyle = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '16px',
    marginTop: '20px',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '16px',
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

  const statusBadgeStyle = (status) => ({
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: status ? '#dcfce7' : '#fee2e2',
    color: status ? '#16a34a' : '#dc2626',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  });

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

  const topListStyle = {
    marginTop: '16px',
  };

  const topListItemStyle = {
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  };

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>12개월 건강 리포트</h1>

      <div style={summaryGridStyle}>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>총 의료비</div>
          <div style={summaryValueStyle}>{formatCurrency(stats.totalSpending)}</div>
          <div style={summaryDescStyle}>8회 방문</div>
        </div>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>청구 완료</div>
          <div style={summaryValueStyle}>{formatCurrency(stats.totalClaimed)}</div>
          <div style={summaryDescStyle}>72.8%</div>
        </div>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>미청구</div>
          <div style={summaryValueStyle}>{formatCurrency(stats.unclaimedAmount)}</div>
          <div style={summaryDescStyle}>27.2%</div>
        </div>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>병원 방문</div>
          <div style={summaryValueStyle}>{stats.visitCount}회</div>
          <div style={summaryDescStyle}>평균 88,812원</div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>월별 의료비 추이</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="claimed" fill="#10b981" name="청구 완료" />
            <Bar dataKey="unclaimed" fill="#f59e0b" name="미청구" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>질병 위험도 추이</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={riskTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="stroke" stroke="#ef4444" name="뇌졸중" strokeWidth={2} />
            <Line type="monotone" dataKey="diabetes" stroke="#f59e0b" name="당뇨" strokeWidth={2} />
            <Line type="monotone" dataKey="cardio" stroke="#3b82f6" name="심뇌혈관" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>급여 vs 비급여</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={PIE_DATA}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {COLORS.map((color, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>병원 방문 현황</h3>
        <div style={topListStyle}>
          <div style={topListItemStyle}>
            <span>가장 많이 방문한 병원:</span>
            <strong>{stats.topHospital}</strong>
          </div>
          <div style={topListItemStyle}>
            <span>가장 많이 방문한 진료과:</span>
            <strong>{stats.topDepartment}</strong>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>예방접종 현황</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>백신명</th>
              <th style={thStyle}>접종 상태</th>
              <th style={thStyle}>접종일</th>
            </tr>
          </thead>
          <tbody>
            {VACCINATION_DATA.map((vacc, idx) => (
              <tr key={idx}>
                <td style={tdStyle}>{vacc.name}</td>
                <td style={tdStyle}>
                  <span style={statusBadgeStyle(vacc.status)}>
                    {vacc.status ? '접종 완료' : '미접종'}
                  </span>
                </td>
                <td style={tdStyle}>{vacc.date || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button style={buttonStyle} onClick={handlePDFDownload}>
        PDF 다운로드
      </button>
    </div>
  );
};

export default HealthReport;
