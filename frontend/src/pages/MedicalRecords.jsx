import React, { useState, useEffect, useMemo } from 'react';
import { analysisAPI } from '../api/services';
import useAuthStore from '../store/authStore';
import CodefSyncModal from '../components/CodefSyncModal';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  alert:  (<><path d="M8 3l6 10H2z"/><path d="M8 7v3M8 12v.01"/></>),
  close:  (<path d="M4 4l8 8M12 4l-8 8"/>),
  hosp:   (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  cal:    (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  check:  (<path d="M3 8l3 3 7-7"/>),
  arrow:  (<path d="M3 8h10M9 4l4 4-4 4"/>),
  info:   (<><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.01"/></>),
  paid:   (<><circle cx="8" cy="8" r="6"/><path d="M5.5 8l2 2 3-3"/></>),
};

const FILTERS = ['전체', '청구가능', '확인필요', '청구완료'];
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';

// ── 세대 뱃지 ──────────────────────────────────────────────────────────────
const GEN_CONFIG = {
  '1d': { bg: '#E8F5E9', color: '#2E7D32', label: '1세대 손보 실손' },
  '1h': { bg: '#F1F8E9', color: '#33691E', label: '1세대 생보 실손' },
  '2':  { bg: '#E3F2FD', color: '#1565C0', label: '2세대 실손' },
  '3':  { bg: '#FFF3E0', color: '#E65100', label: '3세대 실손' },
  '3k': { bg: '#FBE9E7', color: '#BF360C', label: '3세대 착한실손' },
  '4':  { bg: '#FCE4EC', color: '#AD1457', label: '4세대 실손' },
};
const genLabel = (gen) => GEN_CONFIG[gen]?.label || null;

const GenBadge = ({ gen }) => {
  if (!gen) return null;
  const s = GEN_CONFIG[gen] || { bg: '#F5F5F5', color: '#616161', label: gen };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: s.bg, color: s.color, flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
};

// ── 날짜별 단일 그룹 빌더 (기존 로직) ──────────────────────────────────────
const buildDateGroup = (date, recs) => {
  const claimable   = recs.filter(r => r.hasClaimOpportunity &&
                        (r.confidenceLevel === 'CONFIRMED' || r.confidenceLevel === 'LIKELY'));
  const checkNeeded = recs.filter(r => r.confidenceLevel === 'CHECK_NEEDED');
  const claimed     = recs.filter(r => r.claimStatus === 'CLAIMED');
  const primary     = claimable[0] || checkNeeded[0] || recs[0];
  const totalNonCovered = recs.reduce((s, r) => s + (r.nonCoveredAmount || 0), 0);
  return {
    groupType:           'date',
    id:                  date,
    visitDate:           date,
    sortKey:             date,
    records:             recs,
    hospitals:           [...new Set(recs.map(r => r.hospitalName).filter(Boolean))],
    treatTypes:          [...new Set(recs.map(r => r.treatmentType).filter(Boolean))],
    coverageNotes:       [...new Set(recs.map(r => r.coverageNote).filter(Boolean))],
    totalPatientPayment: recs.reduce((s, r) => s + (r.patientPayment   || 0), 0),
    totalInsurance:      recs.reduce((s, r) => s + (r.insurancePayment || 0), 0),
    totalCost:           recs.reduce((s, r) => s + (r.totalCost        || 0), 0),
    totalClaimAmount:    claimable.reduce((s, r) => s + (r.claimAmount || 0), 0),
    totalNonCovered,
    hasNonCovered:       totalNonCovered > 0,
    alreadyPaid:         recs[0]?.alreadyPaidAmount || 0,
    paidCompany:         recs[0]?.paidByCompany,
    isFullyClaimed:      recs.length > 0 && recs.every(r => r.claimStatus === 'CLAIMED'),
    isAnyClaimed:        claimed.length > 0,
    hasClaimable:        claimable.length > 0,
    hasCheckNeeded:      checkNeeded.length > 0,
    claimableRecs:       claimable,
    checkNeededRecs:     checkNeeded,
    gen:                 primary?.supplementaryGeneration || null,
    claimInsurance:      primary?.claimInsurance,
  };
};

// ── 진료 기록 → 그룹 변환 ────────────────────────────────────────────────────
// 동일 claimGroupKey를 가진 "청구 완료" 레코드는 하나의 청구 그룹으로 묶음
const buildGroups = (records) => {
  const claimMap = new Map(); // claimGroupKey → records[]
  const dateMap  = new Map(); // visitDate     → records[]

  for (const r of records) {
    if (r.claimGroupKey) {
      if (!claimMap.has(r.claimGroupKey)) claimMap.set(r.claimGroupKey, []);
      claimMap.get(r.claimGroupKey).push(r);
    } else {
      const key = r.visitDate || 'unknown';
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key).push(r);
    }
  }

  const groups = [];

  // 청구 완료 그룹 (동일 보험 청구 건으로 묶인 여러 방문)
  for (const [key, recs] of claimMap) {
    const sorted    = [...recs].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
    const dates     = [...new Set(sorted.map(r => r.visitDate))].sort();
    const earliest  = dates[0];
    const latest    = dates[dates.length - 1];
    const totalNonCovered = recs.reduce((s, r) => s + (r.nonCoveredAmount || 0), 0);

    // 날짜별 소그룹 (펼쳤을 때 각 날짜 행 표시용)
    const subDateMap = new Map();
    for (const r of sorted) {
      if (!subDateMap.has(r.visitDate)) subDateMap.set(r.visitDate, []);
      subDateMap.get(r.visitDate).push(r);
    }
    const subGroups = [...subDateMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([d, rs]) => buildDateGroup(d, rs));

    groups.push({
      groupType:           'claim',
      id:                  key,
      sortKey:             latest,
      dateRange:           earliest === latest ? earliest : `${earliest} ~ ${latest}`,
      visitCount:          dates.length,
      records:             sorted,
      subGroups,
      hospitals:           [...new Set(sorted.map(r => r.hospitalName).filter(Boolean))],
      treatTypes:          [...new Set(sorted.map(r => r.treatmentType).filter(Boolean))],
      totalPatientPayment: recs.reduce((s, r) => s + (r.patientPayment   || 0), 0),
      totalInsurance:      recs.reduce((s, r) => s + (r.insurancePayment || 0), 0),
      totalCost:           recs.reduce((s, r) => s + (r.totalCost        || 0), 0),
      totalNonCovered,
      hasNonCovered:       totalNonCovered > 0,
      alreadyPaid:         recs[0]?.alreadyPaidAmount || 0,
      paidCompany:         recs[0]?.paidByCompany,
      isFullyClaimed:      true,
      isAnyClaimed:        true,
      hasClaimable:        false,
      hasCheckNeeded:      false,
      coverageNotes:       [],
      gen:                 null,
    });
  }

  // 일반 날짜 그룹
  for (const [date, recs] of dateMap)
    groups.push({ ...buildDateGroup(date, recs), sortKey: date });

  return groups.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
};

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const MedicalRecords = () => {
  const { user } = useAuthStore();
  const [records,       setRecords]       = useState([]);
  const [filterStatus,  setFilterStatus]  = useState('전체');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showSyncModal,  setShowSyncModal]  = useState(false);
  const [selectedGroup,  setSelectedGroup]  = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [expandedClaims, setExpandedClaims] = useState(new Set());

  const toggleExpand = (id) => setExpandedClaims(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await analysisAPI.getClaimOpportunities();
        if (Array.isArray(data)) setRecords(data);
      } catch (e) { console.error('claim-opportunities 실패:', e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const groups = useMemo(() => buildGroups(records), [records]);

  const claimGroups     = groups.filter(g => g.hasClaimable);
  const checkGroups     = groups.filter(g => !g.hasClaimable && g.hasCheckNeeded);
  const totalUnclaimed  = claimGroups.reduce((s, g) => s + g.totalClaimAmount, 0);
  const totalPaid       = groups.reduce((s, g) => s + (g.alreadyPaid || 0), 0);

  const filtered =
    filterStatus === '청구가능' ? groups.filter(g => g.hasClaimable) :
    filterStatus === '확인필요' ? groups.filter(g => !g.hasClaimable && g.hasCheckNeeded) :
    filterStatus === '청구완료' ? groups.filter(g => g.isFullyClaimed) :
    groups;

  const openModal = (group) => { setSelectedGroup(group); setShowClaimModal(true); };

  const handleSyncSuccess = async () => {
    try { const d = await analysisAPI.getClaimOpportunities(); if (Array.isArray(d)) setRecords(d); }
    catch {}
  };

  const cardAccent = (g) => {
    if (g.isFullyClaimed || g.isAnyClaimed) return 'mc-card-accent-success';
    if (g.hasClaimable)   return 'mc-card-accent-warning';
    if (g.hasCheckNeeded) return 'mc-card-accent-blue';
    return '';
  };

  const cardTag = (g) => {
    if (g.isFullyClaimed) return { text: '청구 완료', cls: 'mc-tag-success' };
    if (g.isAnyClaimed)   return { text: '일부 완료', cls: 'mc-tag-success' };
    if (g.hasClaimable)   return { text: '청구 가능', cls: 'mc-tag-warning' };
    if (g.hasCheckNeeded) return { text: '확인 필요', cls: 'mc-tag-blue' };
    return { text: '처리 완료', cls: 'mc-tag-success' };
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
      {claimGroups.length > 0 && (
        <div className="mc-alert mc-alert-warning" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ic d={P.alert} size={18}/>
            <div>
              <div className="mc-alert-title">청구 가능한 의료비가 있어요</div>
              <div className="mc-alert-body">{claimGroups.length}건의 진료일 · 지금 바로 청구하세요</div>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8A7040', letterSpacing: '-0.4px' }}>
            +{fmt(totalUnclaimed)}
          </div>
        </div>
      )}

      {/* 확인 필요 알림 */}
      {checkGroups.length > 0 && (
        <div className="mc-alert mc-alert-blue" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ic d={P.info} size={18}/>
            <div>
              <div className="mc-alert-title">보험사 확인이 필요한 진료가 있어요</div>
              <div className="mc-alert-body">
                세대별 약관 차이로 보장 여부가 불확실합니다 · {checkGroups.length}건
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
        </div>
      )}

      {/* 요약 통계 */}
      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">전체 진료일</div>
          <div className="mc-stat-value">{groups.length}건</div>
          <div className="mc-stat-sub">기간 내 방문</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">청구 가능</div>
          <div className="mc-stat-value" style={{ color: '#8A7040' }}>{claimGroups.length}건</div>
          <div className="mc-stat-sub">{fmt(totalUnclaimed)}</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">확인 필요</div>
          <div className="mc-stat-value" style={{ color: 'var(--blue)' }}>{checkGroups.length}건</div>
          <div className="mc-stat-sub">보험사 문의</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">이미 수령</div>
          <div className="mc-stat-value" style={{ color: '#3A7A62' }}>{fmt(totalPaid)}</div>
          <div className="mc-stat-sub">지급 확인</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="mc-sec-head"><span className="mc-sec-title">필터</span></div>
      <div className="mc-row-wrap" style={{ marginBottom: 18 }}>
        {FILTERS.map((s) => (
          <button key={s}
            className={`mc-chip ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s)}>{s}</button>
        ))}
      </div>

      {/* 진료 그룹 리스트 */}
      <div className="mc-sec-head">
        <span className="mc-sec-title">진료 기록 · {filtered.length}건</span>
      </div>
      <div className="mc-stack-sm">
        {filtered.map((g) => {
          const tag = cardTag(g);

          // ── 청구 그룹 카드 (동일 보험 청구 건으로 묶인 여러 방문) ──────────
          if (g.groupType === 'claim') {
            const expanded = expandedClaims.has(g.id);
            return (
              <div key={g.id} className="mc-card mc-card-accent-success">
                <div className="mc-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                      background: '#E8F5E9', color: '#2E7D32',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ic d={P.paid} size={16}/>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="mc-card-title">
                        {g.hospitals.join(' · ')}
                      </div>
                      <div className="mc-card-sub">
                        <Ic d={P.cal} size={10}/> {g.dateRange} · {g.visitCount}건
                        {g.treatTypes.length > 0 && <> · {g.treatTypes[0]}</>}
                      </div>
                    </div>
                  </div>
                  <span className="mc-tag mc-tag-success">청구 완료</span>
                </div>

                <div className="mc-card-body">
                  {/* 합산 비용 */}
                  <div className="mc-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div>
                      <div className="mc-field-label">급여 자기부담 합계</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }}>
                        {fmt(g.totalPatientPayment)}
                      </div>
                    </div>
                    <div>
                      <div className="mc-field-label">비급여 합계</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: g.hasNonCovered ? '#E65100' : 'var(--text-3)', marginTop: 4 }}>
                        {g.hasNonCovered ? fmt(g.totalNonCovered) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="mc-field-label">총금액 합계</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                        {fmt(g.totalPatientPayment + (g.totalNonCovered || 0))}
                      </div>
                    </div>
                  </div>

                  {/* 수령 내역 */}
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 8,
                    background: '#E8F5E9', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Ic d={P.paid} size={14}/>
                    <span style={{ fontSize: 13, color: '#2E7D32', fontWeight: 600 }}>
                      이미 수령 {fmt(g.alreadyPaid)}{g.paidCompany && <> ({g.paidCompany})</>}
                    </span>
                  </div>

                  {/* 펼치기 버튼 */}
                  <button
                    onClick={() => toggleExpand(g.id)}
                    style={{
                      marginTop: 12, width: '100%', padding: '7px 0',
                      background: 'var(--bg-2)', border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: 12, color: 'var(--text-3)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                    }}>
                    {expanded ? '▲ 방문 내역 접기' : `▼ 방문 내역 보기 (${g.visitCount}건)`}
                  </button>

                  {/* 펼쳐진 방문 내역 */}
                  {expanded && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {g.subGroups.map((sg) => (
                        <div key={sg.visitDate} style={{
                          padding: '10px 12px', borderRadius: 8,
                          background: 'var(--bg-2)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                                {sg.hospitals.join(' · ')}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                                <Ic d={P.cal} size={10}/> {sg.visitDate}
                                {sg.treatTypes.length > 0 && <> · {sg.treatTypes.join(' + ')}</>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              급여 <strong style={{ color: 'var(--text-1)' }}>{fmt(sg.totalPatientPayment)}</strong>
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              비급여 <strong style={{ color: sg.hasNonCovered ? '#E65100' : 'var(--text-3)' }}>
                                {sg.hasNonCovered ? fmt(sg.totalNonCovered) : '-'}
                              </strong>
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              총 <strong style={{ color: 'var(--blue)' }}>
                                {fmt(sg.totalPatientPayment + (sg.totalNonCovered || 0))}
                              </strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ── 일반 날짜 카드 ────────────────────────────────────────────────
          return (
            <div key={g.visitDate} className={`mc-card ${cardAccent(g)}`}>
              <div className="mc-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                    background: 'var(--blue-soft)', color: 'var(--blue)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ic d={P.hosp} size={16}/>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="mc-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {g.hospitals.join(' · ')}
                      <GenBadge gen={g.gen}/>
                    </div>
                    <div className="mc-card-sub">
                      <Ic d={P.cal} size={10}/> {g.visitDate}
                      {g.treatTypes.length > 0 && <> · {g.treatTypes.join(' + ')}</>}
                      {g.claimInsurance && <> · {g.claimInsurance}</>}
                    </div>
                  </div>
                </div>
                <span className={`mc-tag ${tag.cls}`}>{tag.text}</span>
              </div>

              <div className="mc-card-body">
                <div className="mc-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div>
                    <div className="mc-field-label">급여 자기부담</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 4 }}>
                      {fmt(g.totalPatientPayment)}
                    </div>
                  </div>
                  <div>
                    <div className="mc-field-label">비급여</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: g.hasNonCovered ? '#E65100' : 'var(--text-3)', marginTop: 4 }}>
                      {g.hasNonCovered ? fmt(g.totalNonCovered) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="mc-field-label">총금액</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                      {fmt(g.totalPatientPayment + (g.totalNonCovered || 0))}
                    </div>
                  </div>
                </div>

                {g.alreadyPaid > 0 && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px', borderRadius: 8,
                    background: 'var(--green-soft, #E8F5E9)', display: 'flex',
                    alignItems: 'center', gap: 8,
                  }}>
                    <Ic d={P.paid} size={14}/>
                    <span style={{ fontSize: 13, color: '#2E7D32', fontWeight: 600 }}>
                      이미 수령 {fmt(g.alreadyPaid)}
                      {g.paidCompany && <> ({g.paidCompany})</>}
                    </span>
                  </div>
                )}

                {g.coverageNotes.length > 0 && !g.isFullyClaimed && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.coverageNotes.map((note, i) => (
                      <span key={i} style={{
                        fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-2)',
                        padding: '3px 8px', borderRadius: 4,
                      }}>{note}</span>
                    ))}
                  </div>
                )}

                {g.hasClaimable && !g.isFullyClaimed && (
                  <button className="mc-btn mc-btn-primary" style={{ marginTop: 14 }}
                    onClick={() => openModal(g)}>
                    <Ic d={P.arrow} size={12}/>
                    예상 금액 {fmt(g.totalClaimAmount)} 청구하기
                  </button>
                )}
                {!g.hasClaimable && g.hasCheckNeeded && !g.isFullyClaimed && (
                  <button className="mc-btn" style={{ marginTop: 14, borderColor: 'var(--blue)', color: 'var(--blue)' }}
                    onClick={() => openModal(g)}>
                    <Ic d={P.info} size={12}/> 보장 여부 확인
                  </button>
                )}
              </div>
              <button className="mc-modal-close" onClick={() => setShowClaimModal(false)}>
                <Ic d={P.close} size={12}/>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
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

      {/* 동기화 모달 */}
      {showSyncModal && (
        <CodefSyncModal userId={user?.userId}
          onClose={() => setShowSyncModal(false)} onSuccess={handleSyncSuccess}/>
      )}

      {/* 청구 / 확인 안내 모달 */}
      {showClaimModal && selectedGroup && (
        <div className="mc-modal-backdrop" onClick={() => setShowClaimModal(false)}>
          <div className="mc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-modal-head">
              <div>
                <div className="mc-card-title" style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedGroup.hasClaimable ? '청구 절차 안내' : '보장 여부 확인 안내'}
                  <GenBadge gen={selectedGroup.gen}/>
                </div>
                <div className="mc-card-sub" style={{ marginTop: 2 }}>
                  {selectedGroup.hospitals.join(' · ')} · {selectedGroup.visitDate}
                </div>
              </div>
              <button className="mc-modal-close" onClick={() => setShowClaimModal(false)}>
                <Ic d={P.close} size={12}/>
              </button>
            </div>

            <div className="mc-modal-body">
              {/* 세대별 보장 메모 */}
              {selectedGroup.coverageNotes.length > 0 && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                }}>
                  {selectedGroup.coverageNotes.map((note, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      <Ic d={P.info} size={12}/> {note}
                    </div>
                  ))}
                </div>
              )}

              {selectedGroup.hasClaimable ? (
                // 청구 가능 → 4단계 안내
                [
                  { n: 1, title: '서류 준비',
                    desc: '영수증, 진료비 명세서, 처방전을 준비합니다.' },
                  { n: 2, title: '보험사 접수',
                    desc: `${selectedGroup.claimInsurance || '보험사'}에 서류를 제출합니다.` },
                  { n: 3, title: '심사 및 승인',
                    desc: '보험사에서 청구 내용을 심사합니다 (약 7~10일).' },
                  { n: 4, title: '보험금 지급',
                    desc: `승인 후 약 ${fmt(selectedGroup.totalClaimAmount)} 지급 예정${selectedGroup.gen ? ` (${genLabel(selectedGroup.gen)} 기준)` : ''}.` },
                ].map((s) => (
                  <div key={s.n} className="mc-step">
                    <div className="mc-step-num">{s.n}</div>
                    <div>
                      <div className="mc-step-title">{s.title}</div>
                      <div className="mc-step-desc">{s.desc}</div>
                    </div>
                  </div>
                ))
              ) : (
                // CHECK_NEEDED → 확인 안내
                <div style={{ color: 'var(--text-2)', lineHeight: 1.8, fontSize: 14 }}>
                  <p style={{ marginBottom: 10 }}>
                    가입하신 실손보험의 세대 및 약관에 따라 보장 여부가 달라질 수 있습니다.
                    {selectedGroup.gen && genLabel(selectedGroup.gen) && (
                      <> 현재 <strong>{genLabel(selectedGroup.gen)}</strong>으로 확인됩니다.</>
                    )}
                  </p>
                  <p>
                    가입하신 보험사({selectedGroup.claimInsurance || '해당 보험사'})에 직접 문의하여
                    보장 가능 여부를 확인하세요.
                  </p>
                </div>
              )}
            </div>

            <div className="mc-modal-foot">
              <button className="mc-btn" onClick={() => setShowClaimModal(false)}>닫기</button>
              {selectedGroup.hasClaimable && (
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
