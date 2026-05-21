import React, { useState, useEffect } from 'react';
import { healthAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  hosp: (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  cal:  (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
};

const FILTERS = ['전체', '외래', '입원', '약국'];

const MedicalRecords = () => {
  const [records, setRecords] = useState([]);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const data = await healthAPI.getMedicalRecords();
        if (Array.isArray(data)) setRecords(data);
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

      {loading ? (
        <div className="mc-alert mc-alert-blue">
          <div>
            <div className="mc-alert-title">진료 기록 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      ) : (
        <div className="mc-stack-sm">
          {filteredRecords.map((r) => (
            <div key={r.id} className="mc-card mc-card-head" style={{ padding: '14px 16px' }}>
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
                  {(r.department || r.diagnosis) && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                      {[r.department, r.diagnosis && r.diagnosis !== '해당없음' ? r.diagnosis : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="mc-card-sub">
                    <Ic d={P.cal} size={10}/> {r.visitDate} · {r.treatmentType}
                  </div>
                </div>
              </div>
              <span className="mc-tag">{r.treatmentType}</span>
            </div>
          ))}

          {filteredRecords.length === 0 && (
            <div className="mc-card mc-card-body" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
              {records.length === 0
                ? '아직 연동된 진료 기록이 없어요.'
                : '조건에 맞는 진료 기록이 없어요.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalRecords;
