import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisAPI } from '../api/services';

const TREATMENTS = [
  { id: 1, name: '도수치료', category: '재활치료', avgCost: 80000, isBigeup: true,
    coverage: { gen1: '70% 보장 (연 180일)', gen2: '50만원 한도', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 2, name: 'MRI', category: '영상검사', avgCost: 500000, isBigeup: false,
    coverage: { gen1: '80% 보장', gen2: '80% 보장', gen3: '80% 보장', gen4: '80% 보장' } },
  { id: 3, name: '백내장수술', category: '안과', avgCost: 1500000, isBigeup: true,
    coverage: { gen1: '70% 보장', gen2: '70% 보장', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 4, name: '체외충격파', category: '재활치료', avgCost: 50000, isBigeup: true,
    coverage: { gen1: '70% 보장', gen2: '50만원 한도', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 5, name: '비급여주사', category: '주사치료', avgCost: 30000, isBigeup: true,
    coverage: { gen1: '70% 보장', gen2: '50만원 한도', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 6, name: '내시경', category: '검사', avgCost: 150000, isBigeup: false,
    coverage: { gen1: '80% 보장', gen2: '80% 보장', gen3: '80% 보장', gen4: '80% 보장' } },
  { id: 7, name: '고혈압약', category: '약물', avgCost: 15000, isBigeup: false,
    coverage: { gen1: '처방전 80%', gen2: '처방전 80%', gen3: '처방전 80%', gen4: '처방전 80%' } },
  { id: 8, name: '물리치료', category: '재활치료', avgCost: 20000, isBigeup: false,
    coverage: { gen1: '80% 보장', gen2: '80% 보장', gen3: '80% 보장', gen4: '80% 보장' } },
];

const QUICK_SEARCHES = ['도수치료', 'MRI', '백내장', '체외충격파', '내시경'];

const PreTreatmentSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [userInsuranceGen, setUserInsuranceGen] = useState('gen1');

  const filteredTreatments = useMemo(() => {
    if (!searchQuery.trim()) return TREATMENTS;
    return TREATMENTS.filter(t =>
      t.name.includes(searchQuery) || t.category.includes(searchQuery)
    );
  }, [searchQuery]);

  const handleQuickSearch = (name) => {
    setSearchQuery(name);
  };

  const handleSelectTreatment = (treatment) => {
    setSelectedTreatment(treatment);
  };

  const handleAskAI = () => {
    if (selectedTreatment) {
      navigate(`/chat?query=${encodeURIComponent(selectedTreatment.name)}`);
    }
  };

  const formatCost = (cost) => {
    return new Intl.NumberFormat('ko-KR').format(cost);
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

  const searchContainerStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    marginBottom: '16px',
  };

  const searchInputStyle = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '16px',
  };

  const quickChipsStyle = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  };

  const chipStyle = {
    padding: '8px 16px',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  };

  const resultsContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    cursor: 'pointer',
    border: selectedTreatment?.id === undefined ? 'none' : '2px solid transparent',
    transition: 'all 0.2s',
  };

  const selectedCardStyle = {
    ...cardStyle,
    borderColor: '#1d4ed8',
    backgroundColor: '#f0f9ff',
  };

  const badgeStyle = (isBigeup) => ({
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: isBigeup ? '#fef3c7' : '#dcfce7',
    color: isBigeup ? '#d97706' : '#16a34a',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    marginRight: '8px',
  });

  const detailModalStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    marginBottom: '20px',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '16px',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '10px 8px',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
    fontWeight: '600',
  };

  const tdStyle = {
    padding: '10px 8px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '13px',
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
    marginTop: '16px',
  };

  const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '12px',
    marginTop: '16px',
  };

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>치료비 보장 검색</h1>

      <div style={searchContainerStyle}>
        <input
          style={searchInputStyle}
          placeholder="치료명을 검색해주세요 (예: 도수치료, MRI)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={quickChipsStyle}>
          {QUICK_SEARCHES.map((name) => (
            <button
              key={name}
              style={chipStyle}
              onClick={() => handleQuickSearch(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div style={resultsContainerStyle}>
        {filteredTreatments.map((treatment) => (
          <div
            key={treatment.id}
            style={selectedTreatment?.id === treatment.id ? selectedCardStyle : cardStyle}
            onClick={() => handleSelectTreatment(treatment)}
          >
            <div style={{ marginBottom: '12px' }}>
              <span style={badgeStyle(treatment.isBigeup)}>
                {treatment.isBigeup ? '비급여' : '급여'}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{treatment.category}</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              {treatment.name}
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
              평균 비용: ₩{formatCost(treatment.avgCost)}
            </p>
          </div>
        ))}
      </div>

      {selectedTreatment && (
        <div style={detailModalStyle}>
          <h2 style={sectionTitleStyle}>{selectedTreatment.name} 보장 정보</h2>

          <div style={sectionTitleStyle}>세대별 실손보험 보장 현황</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>보험 세대</th>
                <th style={thStyle}>보장 내용</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>1세대</td>
                <td style={tdStyle}>{selectedTreatment.coverage.gen1}</td>
              </tr>
              <tr>
                <td style={tdStyle}>2세대</td>
                <td style={tdStyle}>{selectedTreatment.coverage.gen2}</td>
              </tr>
              <tr>
                <td style={tdStyle}>3세대</td>
                <td style={tdStyle}>{selectedTreatment.coverage.gen3}</td>
              </tr>
              <tr>
                <td style={tdStyle}>4세대</td>
                <td style={tdStyle}>{selectedTreatment.coverage.gen4}</td>
              </tr>
            </tbody>
          </table>

          <div style={sectionTitleStyle}>나의 보험 보장 여부</div>
          <div style={{ padding: '12px', backgroundColor: '#dbeafe', borderRadius: '8px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', color: '#0c4a6e', margin: '0' }}>
              현재 보험: 1세대 실손보험
            </p>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
              {selectedTreatment.coverage.gen1}
            </p>
          </div>

          <div style={sectionTitleStyle}>예상 환자부담금</div>
          <div style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '8px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px 0' }}>
              평균 비용: ₩{formatCost(selectedTreatment.avgCost)}
            </p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444', margin: '0' }}>
              예상 환자부담: ₩{formatCost(Math.floor(selectedTreatment.avgCost * 0.3))}
            </p>
          </div>

          <button style={buttonStyle} onClick={handleAskAI}>
            AI에게 물어보기 →
          </button>
        </div>
      )}
    </div>
  );
};

export default PreTreatmentSearch;
