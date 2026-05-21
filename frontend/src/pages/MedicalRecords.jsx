import React, { useState, useEffect } from 'react';
import { healthAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  hosp:    (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  cal:     (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  chart:   (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
};

const MOCK_RECORDS = [
  { id: 1, visitDate: '2026-03-15', hospitalName: '서울성모병원', treatmentType: '외래',
    patientPayment: 45000, insurancePayment: 180000, totalCost: 225000 },
  { id: 2, visitDate: '2026-02-28', hospitalName: '연세세브란스병원', treatmentType: '입원',
    patientPayment: 320000, insurancePayment: 1280000, totalCost: 1600000 },
  { id: 3, visitDate: '2026-01-10', hospitalName: '강남구 우리약국', treatmentType: '약국',
    patientPayment: 8500, insurancePayment: 0, totalCost: 8500 },
  { id: 4, visitDate: '2025-12-05', hospitalName: '분당서울대병원', treatmentType: '외래',
    patientPayment: 28000, insurancePayment: 112000, totalCost: 140000 },
];

const FILTERS = ['전체', '외래', '입원', '약국'];
const formatKRW = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';

const MedicalRecords = () => {
  const [records, setRecords] = useState(MOCK_RECORDS);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const data = await healthAPI.getMedicalRecords();
        if (Array.isArray(data) && data.length) setRecords(data);
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const filteredRecords =
    filterStatus === '전체'
      ? records
      : records.filter((r) => r.treatmentType === filterStatus);

  const totalCost = records.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const outpatientCount = records.filter((r) => r.treatmentType === '외래').length;
  const hospitalCount = new Set(records.map((r) => r.hospitalName)).size;

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">진료 기록</div>
          <div className="mc-page-subtitle">병원 방문 내역과 진료 구분을 한 곳에서 확인하세요.</div>
        </div>
      </div>

      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">전체 진료</div>
          <div className="mc-stat-value">{records.length}건</div>
          <div className="mc-stat-sub">최근 기록</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">방문 병원</div>
          <div className="mc-stat-value">{hospitalCount}곳</div>
          <div className="mc-stat-sub">중복 제외</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">외래 진료</div>
          <div className="mc-stat-value">{outpatientCount}건</div>
          <div className="mc-stat-sub">가장 잦은 유형</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">총 진료비</div>
          <div className="mc-stat-value">{formatKRW(totalCost)}</div>
          <div className="mc-stat-sub">기록 기준</div>
        </div>
      </div>

      <div className="mc-sec-head">
        <span className="mc-sec-title">진료 유형</span>
      </div>
      <div className="mc-row-wrap" style={{ marginBottom: 18 }}>
        {FILTERS.map((status) => (
          <button
            key={status}
            className={`mc-chip ${filterStatus === status ? 'active' : ''}`}
            onClick={() => setFilterStatus(status)}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mc-sec-head">
        <span className="mc-sec-title">진료 기록 · {filteredRecords.length}건</span>
      </div>
      <div className="mc-stack-sm">
        {filteredRecords.map((r) => (
          <div key={r.id} className="mc-card">
            <div className="mc-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: 'var(--blue-soft)', color: 'var(--blue)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic d={P.hosp} size={16}/>
                </div>
                <div>
                  <div className="mc-card-title">{r.hospitalName}</div>
                  <div className="mc-card-sub">
                    <Ic d={P.cal} size={10}/> {r.visitDate} · {r.treatmentType}
                  </div>
                </div>
              </div>
              <span className="mc-tag">{r.treatmentType}</span>
            </div>

            <div className="mc-card-body">
              <div className="mc-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <div className="mc-field-label">환자 부담</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }}>
                    {formatKRW(r.patientPayment)}
                  </div>
                </div>
                <div>
                  <div className="mc-field-label">보험 부담</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }}>
                    {formatKRW(r.insurancePayment)}
                  </div>
                </div>
                <div>
                  <div className="mc-field-label">총 비용</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                    <Ic d={P.chart} size={11}/> {formatKRW(r.totalCost)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredRecords.length === 0 && (
          <div className="mc-card mc-card-body" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
            조건에 맞는 진료 기록이 없어요.
          </div>
        )}
      </div>

      {loading && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">진료 기록 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalRecords;
