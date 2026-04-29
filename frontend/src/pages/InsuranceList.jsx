import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { insuranceAPI } from '../api/services';

const MOCK_POLICIES = [
  { id: 1, companyName: '삼성생명', productName: '삼성생명 실손보험 (3세대)', policyType: 'HEALTH',
    monthlyPremium: 85000, endDate: '2045-03-15', contractStatus: 'ACTIVE',
    coverageItems: [
      { name: '실손의료비', amount: 50000000, category: 'INDEMNITY' },
      { name: '입원의료비', amount: 30000000, category: 'INDEMNITY' },
    ]
  },
  { id: 2, companyName: '한화생명', productName: '한화생명 종신보험', policyType: 'LIFE',
    monthlyPremium: 180000, endDate: '2060-07-01', contractStatus: 'ACTIVE',
    coverageItems: [
      { name: '사망보험금', amount: 100000000, category: 'DEATH' },
      { name: '암진단금', amount: 30000000, category: 'CANCER' },
    ]
  },
  { id: 3, companyName: '현대해상', productName: '현대해상 치아보험', policyType: 'ACCIDENT',
    monthlyPremium: 32000, endDate: '2030-12-31', contractStatus: 'ACTIVE',
    coverageItems: [
      { name: '치과치료비', amount: 2000000, category: 'DENTAL' },
    ]
  },
];

const COVERAGE_PIE_DATA = [
  { name: '실손의료비', value: 80 },
  { name: '종신보험', value: 130 },
  { name: '치아보험', value: 2 },
];

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899'];

const InsuranceList = () => {
  const [policies, setPolicies] = useState(MOCK_POLICIES);
  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const [filterType, setFilterType] = useState('전체');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPolicies = async () => {
      setLoading(true);
      try {
        const data = await insuranceAPI.getPolicies();
        if (Array.isArray(data) && data.length > 0) setPolicies(data);
      } catch (error) {
        console.error('Failed to fetch policies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  const filteredPolicies = filterType === '전체'
    ? policies
    : policies.filter(p => {
      const typeMap = { SUPPLEMENTARY: '실손', LIFE: '생명', NON_LIFE: '손해' };
      return typeMap[p.policyType] === filterType;
    });

  const totalPremium = policies.reduce((sum, p) => sum + (p.monthlyPremium || 0), 0);
  const totalCoverage = policies.reduce((sum, p) =>
    sum + (p.coverageItems || []).reduce((itemSum, item) => itemSum + (item.amount || 0), 0), 0
  );

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
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  };

  const summaryItemStyle = {
    ...cardStyle,
    marginBottom: '0',
    padding: '16px',
  };

  const summaryLabelStyle = {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '4px',
  };

  const summaryValueStyle = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
  };

  const filterButtonStyle = (isActive) => ({
    padding: '8px 16px',
    backgroundColor: isActive ? '#1d4ed8' : '#e2e8f0',
    color: isActive ? '#fff' : '#0f172a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    marginRight: '8px',
    marginBottom: '16px',
  });

  const policyCardStyle = {
    ...cardStyle,
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const policyHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  };

  const logoStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#1d4ed8',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    marginRight: '12px',
  };

  const policyNameStyle = {
    flex: 1,
  };

  const statusBadgeStyle = (status) => ({
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: status === 'ACTIVE' ? '#dbeafe' : '#e2e8f0',
    color: status === 'ACTIVE' ? '#1d4ed8' : '#64748b',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  });

  const policyInfoStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    fontSize: '12px',
    color: '#475569',
    marginBottom: '12px',
  };

  const policyInfoItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
  };

  const expandButtonStyle = {
    width: '100%',
    padding: '8px',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: '6px',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
  };

  const coverageTableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '8px',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '11px',
    fontWeight: '600',
  };

  const tdStyle = {
    padding: '8px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
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
      <h1 style={titleStyle}>보험 관리</h1>

      <div style={summaryGridStyle}>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>총 월 보험료</div>
          <div style={summaryValueStyle}>{formatCurrency(totalPremium)}</div>
        </div>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>보험 건수</div>
          <div style={summaryValueStyle}>{policies.length}개</div>
        </div>
        <div style={summaryItemStyle}>
          <div style={summaryLabelStyle}>총 보장금</div>
          <div style={summaryValueStyle}>{formatCurrency(totalCoverage)}</div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>보장 범주 구성</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={COVERAGE_PIE_DATA}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name} (${value}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {COLORS.map((color, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>보험 필터</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {['전체', '실손', '생명', '손해'].map(type => (
            <button
              key={type}
              style={filterButtonStyle(filterType === type)}
              onClick={() => setFilterType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <h3 style={sectionTitleStyle}>보험 상품</h3>
      {filteredPolicies.map(policy => (
        <div
          key={policy.id}
          style={policyCardStyle}
          onClick={() => setExpandedPolicy(expandedPolicy === policy.id ? null : policy.id)}
        >
          <div style={policyHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={logoStyle}>
                {(policy.companyName || '?').charAt(0)}
              </div>
              <div style={policyNameStyle}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
                  {policy.productName || policy.policyNumber}
                </p>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0' }}>
                  {policy.companyName}
                </p>
              </div>
            </div>
            <span style={statusBadgeStyle(policy.contractStatus)}>
              {policy.contractStatus === 'ACTIVE' ? '활성' : '만료'}
            </span>
          </div>

          <div style={policyInfoStyle}>
            <div style={policyInfoItemStyle}>
              <span>월 보험료:</span>
              <strong>{policy.monthlyPremium ? formatCurrency(policy.monthlyPremium) : '-'}</strong>
            </div>
            <div style={policyInfoItemStyle}>
              <span>만료일:</span>
              <strong>{policy.endDate || '-'}</strong>
            </div>
          </div>

          {expandedPolicy === policy.id && (
            <>
              <table style={coverageTableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>보장 항목</th>
                    <th style={thStyle}>보장금</th>
                    <th style={thStyle}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {(policy.coverageItems || []).map((item, idx) => (
                    <tr key={idx}>
                      <td style={tdStyle}>{item.name}</td>
                      <td style={tdStyle}>{item.amount ? formatCurrency(item.amount) : '-'}</td>
                      <td style={tdStyle}>{item.isCovered ? '정상' : '해지'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <button style={expandButtonStyle}>
            {expandedPolicy === policy.id ? '상세정보 닫기 ▲' : '상세정보 보기 ▼'}
          </button>
        </div>
      ))}

      <button style={buttonStyle}>
        CODEF 동기화
      </button>
    </div>
  );
};

export default InsuranceList;
