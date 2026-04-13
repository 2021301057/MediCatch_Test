import React, { useState, useEffect } from 'react';
import { healthAPI } from '../api/services';

const MOCK_RECORDS = [
  { id: 1, visitDate: '2026-03-15', hospitalName: '서울성모병원', treatmentType: '외래',
    patientPayment: 45000, insurancePayment: 180000, totalCost: 225000,
    hasClaimOpportunity: true, claimAmount: 45000, claimInsurance: '삼성생명 실손' },
  { id: 2, visitDate: '2026-02-28', hospitalName: '연세세브란스병원', treatmentType: '입원',
    patientPayment: 320000, insurancePayment: 1280000, totalCost: 1600000,
    hasClaimOpportunity: true, claimAmount: 320000, claimInsurance: '한화생명 암보험' },
  { id: 3, visitDate: '2026-01-10', hospitalName: '강남구 우리약국', treatmentType: '약국',
    patientPayment: 8500, insurancePayment: 0, totalCost: 8500,
    hasClaimOpportunity: false, claimAmount: 0, claimInsurance: null },
  { id: 4, visitDate: '2025-12-05', hospitalName: '분당서울대병원', treatmentType: '외래',
    patientPayment: 28000, insurancePayment: 112000, totalCost: 140000,
    hasClaimOpportunity: false, claimAmount: 0, claimInsurance: null },
];

const MedicalRecords = () => {
  const [records, setRecords] = useState(MOCK_RECORDS);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const data = await healthAPI.getMedicalRecords();
        setRecords(data);
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  const claimOpportunities = records.filter(r => r.hasClaimOpportunity);
  const totalUnclaimedAmount = claimOpportunities.reduce((sum, r) => sum + r.claimAmount, 0);

  const filteredRecords = filterStatus === '전체'
    ? records
    : filterStatus === '청구가능'
      ? records.filter(r => r.hasClaimOpportunity)
      : records.filter(r => !r.hasClaimOpportunity);

  const handleClaimClick = (record) => {
    setSelectedRecord(record);
    setShowClaimModal(true);
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

  const alertBannerStyle = {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const alertTextStyle = {
    color: '#7f1d1d',
    fontSize: '14px',
    fontWeight: '600',
    margin: '0',
  };

  const alertAmountStyle = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#dc2626',
    margin: '0 0 4px 0',
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    marginBottom: '16px',
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

  const recordItemStyle = {
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const recordInfoStyle = {
    flex: 1,
  };

  const recordHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };

  const recordDateStyle = {
    fontSize: '12px',
    color: '#64748b',
  };

  const recordHospitalStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px',
  };

  const recordTypeStyle = {
    fontSize: '12px',
    color: '#475569',
    marginBottom: '8px',
  };

  const costBreakdownStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    fontSize: '11px',
  };

  const costItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#475569',
  };

  const costAmountStyle = {
    fontWeight: '700',
    color: '#0f172a',
  };

  const claimBadgeStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  };

  const claimButtonStyle = {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
    marginLeft: '12px',
  };

  const modalStyle = {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000',
  };

  const modalContentStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
  };

  const modalTitleStyle = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '16px',
  };

  const stepStyle = {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
  };

  const stepNumberStyle = {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    backgroundColor: '#1d4ed8',
    color: '#fff',
    borderRadius: '50%',
    textAlign: 'center',
    lineHeight: '24px',
    fontWeight: '700',
    marginRight: '8px',
    fontSize: '12px',
  };

  const stepTitleStyle = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#0f172a',
    display: 'inline-block',
  };

  const stepDescStyle = {
    fontSize: '12px',
    color: '#475569',
    marginTop: '8px',
    marginLeft: '32px',
  };

  const closeButtonStyle = {
    background: '#e2e8f0',
    color: '#0f172a',
    border: 'none',
    borderRadius: '8px',
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
  };

  const syncButtonStyle = {
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

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>의료 기록</h1>

      {claimOpportunities.length > 0 && (
        <div style={alertBannerStyle}>
          <div>
            <p style={alertTextStyle}>청구 가능한 의료비가 있습니다</p>
            <p style={alertAmountStyle}>{formatCurrency(totalUnclaimedAmount)}</p>
          </div>
          <div style={{ textAlign: 'right', color: '#7f1d1d' }}>
            <p style={alertTextStyle}>{claimOpportunities.length}건</p>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>필터</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {['전체', '청구가능', '청구완료'].map(status => (
            <button
              key={status}
              style={filterButtonStyle(filterStatus === status)}
              onClick={() => setFilterStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <h3 style={sectionTitleStyle}>의료 기록</h3>
      {filteredRecords.map(record => (
        <div key={record.id} style={recordItemStyle}>
          <div style={recordInfoStyle}>
            <div style={recordHeaderStyle}>
              <div>
                <div style={recordHospitalStyle}>{record.hospitalName}</div>
                <div style={recordDateStyle}>{record.visitDate}</div>
              </div>
              {record.hasClaimOpportunity && (
                <span style={claimBadgeStyle}>청구 가능</span>
              )}
            </div>
            <div style={recordTypeStyle}>
              {record.treatmentType} ({record.claimInsurance || '비급여'})
            </div>
            <div style={costBreakdownStyle}>
              <div style={costItemStyle}>
                <span>환자부담:</span>
                <span style={costAmountStyle}>{formatCurrency(record.patientPayment)}</span>
              </div>
              <div style={costItemStyle}>
                <span>보험청구:</span>
                <span style={costAmountStyle}>{formatCurrency(record.insurancePayment)}</span>
              </div>
              <div style={costItemStyle}>
                <span>총 비용:</span>
                <span style={costAmountStyle}>{formatCurrency(record.totalCost)}</span>
              </div>
            </div>
          </div>

          {record.hasClaimOpportunity && (
            <button
              style={claimButtonStyle}
              onClick={() => handleClaimClick(record)}
            >
              청구하기
            </button>
          )}
        </div>
      ))}

      <button style={syncButtonStyle}>
        CODEF 동기화
      </button>

      {showClaimModal && selectedRecord && (
        <div style={modalStyle} onClick={() => setShowClaimModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>청구 절차</h2>

            <div style={stepStyle}>
              <span style={stepNumberStyle}>1</span>
              <span style={stepTitleStyle}>서류 준비</span>
              <div style={stepDescStyle}>
                영수증, 진료비 명세서, 처방전 등을 준비합니다
              </div>
            </div>

            <div style={stepStyle}>
              <span style={stepNumberStyle}>2</span>
              <span style={stepTitleStyle}>보험사 접수</span>
              <div style={stepDescStyle}>
                보험사에 서류를 제출합니다 ({selectedRecord.claimInsurance})
              </div>
            </div>

            <div style={stepStyle}>
              <span style={stepNumberStyle}>3</span>
              <span style={stepTitleStyle}>심사 및 승인</span>
              <div style={stepDescStyle}>
                보험사에서 청구 내용을 심사합니다 (약 7-10일)
              </div>
            </div>

            <div style={stepStyle}>
              <span style={stepNumberStyle}>4</span>
              <span style={stepTitleStyle}>보험금 지급</span>
              <div style={stepDescStyle}>
                승인 후 {formatCurrency(selectedRecord.claimAmount)}이 지급됩니다
              </div>
            </div>

            <button style={closeButtonStyle} onClick={() => setShowClaimModal(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalRecords;
