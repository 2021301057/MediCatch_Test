import React, { useState, useEffect } from 'react';
import { analysisAPI } from '../api/services';
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
  info:    (<><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.01"/></>),
};

const FILTERS = ['전체', '청구가능', '확인필요', '청구완료'];
const formatKRW = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';

const confidenceLabel = (level) => {
  switch (level) {
    case 'CONFIRMED':    return { text: '청구 가능', cls: 'mc-tag-warning' };
    case 'LIKELY':       return { text: '청구 가능', cls: 'mc-tag-warning' };
    case 'CHECK_NEEDED': return { text: '확인 필요', cls: 'mc-tag-blue' };
    case 'CLAIMED':      return { text: '청구 완료', cls: 'mc-tag-success' };
    default:             return { text: '처리 완료', cls: 'mc-tag-success' };
  }
};

const isClaimable = (r) => r.hasClaimOpportunity &&
  (r.confidenceLevel === 'CONFIRMED' || r.confidenceLevel === 'LIKELY');

const isCheckNeeded = (r) => r.confidenceLevel === 'CHECK_NEEDED';

const isClaimed = (r) => r.claimStatus === 'CLAIMED';

const MedicalRecords = () => {
  const { user } = useAuthStore();
  const [records, setRecords] = useState([]);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const data = await analysisAPI.getClaimOpportunities();
        if (Array.isArray(data)) setRecords(data);
      } catch (error) {
        console.error('Failed to fetch claim opportunities:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const claimOpportunities = records.filter(isClaimable);
  const checkNeededItems = records.filter(isCheckNeeded);
  const totalUnclaimedAmount = claimOpportunities.reduce((sum, r) => sum + (r.claimAmount || 0), 0);

  const filteredRecords =
    filterStatus === '전체'   ? records :
    filterStatus === '청구가능' ? records.filter(isClaimable) :
    filterStatus === '확인필요' ? records.filter(isCheckNeeded) :
    records.filter(isClaimed);

  const handleClaimClick = (record) => {
    setSelectedRecord(record);
    setShowClaimModal(true);
  };

  const handleSyncSuccess = async () => {
    try {
      const data = await analysisAPI.getClaimOpportunities();
      if (Array.isArray(data)) setRecords(data);
    } catch {}
  };

  const getCardAccent = (r) => {
    if (isClaimable(r)) return 'mc-card-accent-warning';
    if (isCheckNeeded(r)) return 'mc-card-accent-blue';
    return '';
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

      {/* 확인 필요 알림 */}
      {checkNeededItems.length > 0 && (
        <div className="mc-alert mc-alert-blue" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ic d={P.info} size={18}/>
            <div>
              <div className="mc-alert-title">보험사 확인이 필요한 항목이 있어요</div>
              <div className="mc-alert-body">치과 급여 진료 등 보장 여부를 직접 확인하세요. {checkNeededItems.length}건</div>
            </div>
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
          <div className="mc-stat-label">확인 필요</div>
          <div className="mc-stat-value" style={{ color: 'var(--blue)' }}>
            {checkNeededItems.length}건
          </div>
          <div className="mc-stat-sub">보험사 문의</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">총 의료비</div>
          <div className="mc-stat-value">
            {formatKRW(records.reduce((s, r) => s + (r.totalCost || 0), 0))}
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
        {filteredRecords.map((r) => {
          const tag = isClaimed(r)
            ? { text: '청구 완료', cls: 'mc-tag-success' }
            : confidenceLabel(r.confidenceLevel);

          return (
            <div key={r.id} className={`mc-card ${getCardAccent(r)}`}>
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
                      {r.claimInsurance && <> · {r.claimInsurance}</>}
                      {r.matchedCoverage && <> · {r.matchedCoverage}</>}
                    </div>
                  </div>
                </div>
                <span className={`mc-tag ${tag.cls}`}>{tag.text}</span>
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
                      {formatKRW(r.totalCost)}
                    </div>
                  </div>
                </div>

                {isClaimable(r) && (
                  <button
                    className="mc-btn mc-btn-primary"
                    style={{ marginTop: 14 }}
                    onClick={() => handleClaimClick(r)}
                  >
                    <Ic d={P.arrow} size={12}/> 청구하기 ({formatKRW(r.claimAmount)})
                  </button>
                )}

                {isCheckNeeded(r) && (
                  <button
                    className="mc-btn"
                    style={{ marginTop: 14, borderColor: 'var(--blue)', color: 'var(--blue)' }}
                    onClick={() => handleClaimClick(r)}
                  >
                    <Ic d={P.info} size={12}/> 보험사 확인 필요
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredRecords.length === 0 && !loading && (
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
                <div className="mc-card-title" style={{ fontSize: 16 }}>
                  {isCheckNeeded(selectedRecord) ? '보험사 확인 안내' : '청구 절차 안내'}
                </div>
                <div className="mc-card-sub" style={{ marginTop: 2 }}>
                  {selectedRecord.hospitalName} · {selectedRecord.visitDate}
                </div>
              </div>
              <button className="mc-modal-close" onClick={() => setShowClaimModal(false)}>
                <Ic d={P.close} size={12}/>
              </button>
            </div>

            <div className="mc-modal-body">
              {isCheckNeeded(selectedRecord) ? (
                <div style={{ color: 'var(--text-2)', lineHeight: 1.7, fontSize: 14 }}>
                  <p style={{ marginBottom: 12 }}>
                    이 항목은 <strong>치과 급여 진료</strong>로, 실손 보험 보장 여부가 가입한 상품의 세대(1~4세대) 및 약관에 따라 달라질 수 있습니다.
                  </p>
                  <p>가입하신 보험사({selectedRecord.claimInsurance || '해당 보험사'})에 직접 문의하여 보장 여부를 확인하세요.</p>
                </div>
              ) : (
                [
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
                ))
              )}
            </div>

            <div className="mc-modal-foot">
              <button className="mc-btn" onClick={() => setShowClaimModal(false)}>
                닫기
              </button>
              {!isCheckNeeded(selectedRecord) && (
                <button className="mc-btn mc-btn-primary">
                  <Ic d={P.check} size={12}/> 청구 접수
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalRecords;
