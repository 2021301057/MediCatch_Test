import React, { useState, useEffect } from 'react';
import { healthAPI } from '../api/services';
import useAuthStore from '../store/authStore';
import CodefSyncModal from '../components/CodefSyncModal';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  alert:   (<><path d="M8 3l6 10H2z"/><path d="M8 7v3M8 12v.01"/></>),
  close:   (<path d="M4 4l8 8M12 4l-8 8"/>),
  sync:    (<><path d="M3 8a5 5 0 0 1 8.5-3.5L13 6"/><path d="M13 2v4h-4"/><path d="M13 8a5 5 0 0 1-8.5 3.5L3 10"/><path d="M3 14v-4h4"/></>),
  hosp:    (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  cal:     (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  check:   (<path d="M3 8l3 3 7-7"/>),
  arrow:   (<path d="M3 8h10M9 4l4 4-4 4"/>),
};

const MOCK_RECORDS = [
  { id: 1, visitDate: '2026-03-15', hospitalName: '서울성모병원', treatmentType: '외래',
    department: '내과', diagnosis: '급성 상기도 감염 (감기)',
    patientPayment: 45000, insurancePayment: 180000, totalCost: 225000,
    hasClaimOpportunity: true, claimAmount: 45000, claimInsurance: '삼성생명 실손' },
  { id: 2, visitDate: '2026-02-28', hospitalName: '연세세브란스병원', treatmentType: '입원',
    department: '외과', diagnosis: '충수염 (맹장 수술)',
    patientPayment: 320000, insurancePayment: 1280000, totalCost: 1600000,
    hasClaimOpportunity: true, claimAmount: 320000, claimInsurance: '한화생명 암보험' },
  { id: 3, visitDate: '2026-01-10', hospitalName: '강남구 우리약국', treatmentType: '약국',
    department: null, diagnosis: '처방약 조제',
    patientPayment: 8500, insurancePayment: 0, totalCost: 8500,
    hasClaimOpportunity: false, claimAmount: 0, claimInsurance: null },
  { id: 4, visitDate: '2025-12-05', hospitalName: '분당서울대병원', treatmentType: '외래',
    department: '정형외과', diagnosis: '요추부 염좌',
    patientPayment: 28000, insurancePayment: 112000, totalCost: 140000,
    hasClaimOpportunity: false, claimAmount: 0, claimInsurance: null },
];

const FILTERS = ['전체', '청구가능', '청구완료'];
const formatKRW = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';

const MedicalRecords = () => {
  const { user } = useAuthStore();
  const [records, setRecords] = useState(MOCK_RECORDS);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
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

  const claimOpportunities = records.filter((r) => r.hasClaimOpportunity);
  const totalUnclaimedAmount = claimOpportunities.reduce((sum, r) => sum + r.claimAmount, 0);

  const filteredRecords =
    filterStatus === '전체' ? records :
    filterStatus === '청구가능' ? records.filter((r) => r.hasClaimOpportunity) :
    records.filter((r) => !r.hasClaimOpportunity);

  const handleClaimClick = (record) => {
    setSelectedRecord(record);
    setShowClaimModal(true);
  };

  const handleSyncSuccess = () => {
    healthAPI.getMedicalRecords()
      .then((data) => { if (Array.isArray(data) && data.length) setRecords(data); })
      .catch(() => {});
  };

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">의료 기록 & 청구</div>
          <div className="mc-page-subtitle">진료 내역을 확인하고 놓친 보험 청구 기회를 확인하세요.</div>
        </div>
      </div>

      {/* 청구 가능 알림 */}
      {claimOpportunities.length > 0 && (
        <div className="mc-alert mc-alert-warning" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ic d={P.alert} size={18}/>
            <div>
              <div className="mc-alert-title">청구 가능한 의료비가 있어요</div>
              <div className="mc-alert-body">놓친 청구를 지금 확인하세요. {claimOpportunities.length}건 대기 중</div>
            </div>
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800, color: '#8A7040', letterSpacing: '-0.4px',
          }}>
            +{formatKRW(totalUnclaimedAmount)}
          </div>
        </div>
      )}

      {/* 요약 통계 */}
      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">전체 진료</div>
          <div className="mc-stat-value">{records.length}건</div>
          <div className="mc-stat-sub">최근 기록</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">청구 가능</div>
          <div className="mc-stat-value" style={{ color: '#8A7040' }}>
            {claimOpportunities.length}건
          </div>
          <div className="mc-stat-sub">{formatKRW(totalUnclaimedAmount)}</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">청구 완료</div>
          <div className="mc-stat-value" style={{ color: '#3A7A62' }}>
            {records.length - claimOpportunities.length}건
          </div>
          <div className="mc-stat-sub">처리 완료</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">총 의료비</div>
          <div className="mc-stat-value">
            {formatKRW(records.reduce((s, r) => s + r.totalCost, 0))}
          </div>
          <div className="mc-stat-sub">기간 누적</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="mc-sec-head">
        <span className="mc-sec-title">필터</span>
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

      {/* 진료 기록 리스트 */}
      <div className="mc-sec-head">
        <span className="mc-sec-title">진료 기록 · {filteredRecords.length}건</span>
      </div>
      <div className="mc-stack-sm">
        {filteredRecords.map((r) => (
          <div key={r.id} className={`mc-card ${r.hasClaimOpportunity ? 'mc-card-accent-warning' : ''}`}>
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
                  {r.diagnosis && (
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
                      marginTop: 2, marginBottom: 2,
                    }}>
                      {r.diagnosis}
                    </div>
                  )}
                  <div className="mc-card-sub">
                    <Ic d={P.cal} size={10}/> {r.visitDate} · {r.treatmentType}
                    {r.department && <> · {r.department}</>}
                    {r.claimInsurance && <> · {r.claimInsurance}</>}
                  </div>
                </div>
              </div>
              {r.hasClaimOpportunity ? (
                <span className="mc-tag mc-tag-warning">청구 가능</span>
              ) : (
                <span className="mc-tag mc-tag-success">처리 완료</span>
              )}
            </div>

            <div className="mc-card-body">
              {(r.diagnosis || r.department) && (
                <div className="mc-kv" style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  {r.diagnosis && (
                    <div>
                      <div className="mc-field-label">진단명</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>
                        {r.diagnosis}
                      </div>
                    </div>
                  )}
                  {r.department && (
                    <span className="mc-tag mc-tag-neutral" style={{ alignSelf: 'flex-start' }}>
                      {r.department}
                    </span>
                  )}
                </div>
              )}
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
                    {formatKRW(r.totalCost)}
                  </div>
                </div>
              </div>

              {r.hasClaimOpportunity && (
                <button
                  className="mc-btn mc-btn-primary"
                  style={{ marginTop: 14 }}
                  onClick={() => handleClaimClick(r)}
                >
                  <Ic d={P.arrow} size={12}/> 청구하기 ({formatKRW(r.claimAmount)})
                </button>
              )}
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
            <div className="mc-alert-title">진료 기록 불러오는 중…</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}

      {/* 청구 절차 모달 */}
      {showSyncModal && (
        <CodefSyncModal
          userId={user?.userId}
          onClose={() => setShowSyncModal(false)}
          onSuccess={handleSyncSuccess}
        />
      )}

      {showClaimModal && selectedRecord && (
        <div className="mc-modal-backdrop" onClick={() => setShowClaimModal(false)}>
          <div className="mc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-modal-head">
              <div>
                <div className="mc-card-title" style={{ fontSize: 16 }}>청구 절차 안내</div>
                <div className="mc-card-sub" style={{ marginTop: 2 }}>
                  {selectedRecord.hospitalName} · {selectedRecord.visitDate}
                  {selectedRecord.diagnosis && <> · {selectedRecord.diagnosis}</>}
                </div>
              </div>
              <button className="mc-modal-close" onClick={() => setShowClaimModal(false)}>
                <Ic d={P.close} size={12}/>
              </button>
            </div>

            <div className="mc-modal-body">
              {[
                { n: 1, title: '서류 준비',
                  desc: '영수증, 진료비 명세서, 처방전 등을 준비합니다.' },
                { n: 2, title: '보험사 접수',
                  desc: `${selectedRecord.claimInsurance || '보험사'}에 서류를 제출합니다.` },
                { n: 3, title: '심사 및 승인',
                  desc: '보험사에서 청구 내용을 심사합니다 (약 7~10일).' },
                { n: 4, title: '보험금 지급',
                  desc: `승인 후 ${formatKRW(selectedRecord.claimAmount)}이 지급됩니다.` },
              ].map((s) => (
                <div key={s.n} className="mc-step">
                  <div className="mc-step-num">{s.n}</div>
                  <div>
                    <div className="mc-step-title">{s.title}</div>
                    <div className="mc-step-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mc-modal-foot">
              <button className="mc-btn" onClick={() => setShowClaimModal(false)}>
                닫기
              </button>
              <button className="mc-btn mc-btn-primary">
                <Ic d={P.check} size={12}/> 청구 접수
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalRecords;
