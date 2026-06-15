import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  hosp:   (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  cal:    (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  search: (<><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></>),
  chev:   (<path d="M4 6l4 4 4-4"/>),
  x:      (<path d="M4 4l8 8M12 4l-8 8"/>),
  arrow:  (<><path d="M3 8h10M9 4l4 4-4 4"/></>),
};

const TYPE_FILTERS = ['전체', '외래', '입원', '약국'];
const PERIOD_FILTERS = [
  { key: '3m',  label: '최근 3개월', months: 3 },
  { key: '6m',  label: '최근 6개월', months: 6 },
  { key: '1y',  label: '최근 1년',   months: 12 },
  { key: 'all', label: '전체',       months: null },
];
const DEFAULT_PERIOD = '1y';

const fmtYM = (ym) => {
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
};

const MedicalRecords = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery]   = useState('');
  const [typeFilter, setTypeFilter]     = useState('전체');
  const [periodFilter, setPeriodFilter] = useState(DEFAULT_PERIOD);
  const [expandedId, setExpandedId]     = useState(null);

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

  // ── 가장 많은 유형 (통계 카드) ────────────────────────────────────────
  const topType = useMemo(() => {
    const counts = {};
    records.forEach((r) => {
      if (r.treatmentType) counts[r.treatmentType] = (counts[r.treatmentType] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ['-', 0];
  }, [records]);

  // ── 필터링 ────────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let list = records;

    const periodCfg = PERIOD_FILTERS.find((p) => p.key === periodFilter);
    if (periodCfg?.months) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - periodCfg.months);
      list = list.filter((r) => r.visitDate && new Date(r.visitDate) >= cutoff);
    }

    if (typeFilter !== '전체') {
      list = list.filter((r) => r.treatmentType === typeFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.hospitalName || '').toLowerCase().includes(q) ||
        (r.diagnosis    || '').toLowerCase().includes(q) ||
        (r.department   || '').toLowerCase().includes(q) ||
        (r.diseaseCode  || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [records, searchQuery, typeFilter, periodFilter]);

  // ── 월별 그룹핑 ───────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {};
    filteredRecords.forEach((r) => {
      const ym = (r.visitDate || '').substring(0, 7);
      if (!ym) return;
      if (!map[ym]) map[ym] = [];
      map[ym].push(r);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || '')));
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([ym, items]) => ({ ym, items }));
  }, [filteredRecords]);

  // ── 통계 ────────────────────────────────────────────────────────────
  const hospitalCount = new Set(records.map((r) => r.hospitalName).filter(Boolean)).size;
  const pharmacyCount = records.filter((r) => r.treatmentType === '약국').length;

  const isFiltered =
    searchQuery.trim() !== '' ||
    typeFilter !== '전체' ||
    periodFilter !== DEFAULT_PERIOD;

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('전체');
    setPeriodFilter(DEFAULT_PERIOD);
  };

  const goPreTreatment = (diagnosis) => {
    navigate(`/pre-treatment?q=${encodeURIComponent(diagnosis)}`);
  };

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">진료 기록</div>
          <div className="mc-page-subtitle">병원 방문 내역과 진료 구분을 한 곳에서 확인하세요.</div>
        </div>
      </div>

      {/* 통계: 전체 데이터 기준 */}
      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">전체 진료</div>
          <div className="mc-stat-value">{records.length}건</div>
          <div className="mc-stat-sub">누적 기록</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">방문 병원</div>
          <div className="mc-stat-value">{hospitalCount}곳</div>
          <div className="mc-stat-sub">중복 제외</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">{topType[0]} 진료</div>
          <div className="mc-stat-value">{topType[1]}건</div>
          <div className="mc-stat-sub">가장 많은 유형</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">약국 기록</div>
          <div className="mc-stat-value">{pharmacyCount}건</div>
          <div className="mc-stat-sub">처방·조제 기록</div>
        </div>
      </div>

      {/* 검색 */}
      <div className="mc-card mc-card-body mc-section-tight" style={{ marginTop: 18 }}>
        <div className="mc-input-with-icon">
          <span className="mc-input-icon"><Ic d={P.search} size={14}/></span>
          <input
            className="mc-input"
            placeholder="병원, 병명, 진료과, 질병 코드 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 유형 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, minWidth: 32 }}>유형</span>
        <div className="mc-row-wrap">
          {TYPE_FILTERS.map((t) => (
            <button key={t}
              className={`mc-chip ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 기간 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, minWidth: 32 }}>기간</span>
        <div className="mc-row-wrap">
          {PERIOD_FILTERS.map((p) => (
            <button key={p.key}
              className={`mc-chip ${periodFilter === p.key ? 'active' : ''}`}
              onClick={() => setPeriodFilter(p.key)}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* 섹션 헤더 + 결과 카운트 + 초기화 */}
      <div className="mc-sec-head">
        <span className="mc-sec-title">진료 기록 · {filteredRecords.length}건</span>
        {isFiltered && (
          <button onClick={resetFilters} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--blue)', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Ic d={P.x} size={10}/> 필터 초기화
          </button>
        )}
      </div>

      {loading ? (
        <div className="mc-alert mc-alert-blue">
          <div>
            <div className="mc-alert-title">진료 기록 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      ) : grouped.length === 0 ? (
        <div className="mc-card mc-card-body" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          {records.length === 0
            ? '아직 연동된 진료 기록이 없어요.'
            : '조건에 맞는 진료 기록이 없어요. 필터를 조정해보세요.'}
        </div>
      ) : (
        <div className="mc-stack-md">
          {grouped.map(({ ym, items }) => (
            <div key={ym}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-2)',
                marginBottom: 8, paddingLeft: 4,
              }}>
                {fmtYM(ym)} · {items.length}건
              </div>
              <div className="mc-stack-sm">
                {items.map((r) => {
                  const isExpanded   = expandedId === r.id;
                  const hasDiagnosis = r.diagnosis && r.diagnosis !== '해당없음';
                  const showCode     = r.diseaseCode && r.diseaseCode !== '$';

                  return (
                    <div key={r.id} className="mc-card"
                      style={{ overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}>

                      {/* 카드 본체 - 세로형 레이아웃 */}
                      <div style={{ display: 'flex', gap: 12, padding: '14px 16px' }}>
                        {/* 아이콘 */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 6,
                          background: 'var(--blue-soft)', color: 'var(--blue)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Ic d={P.hosp} size={16}/>
                        </div>

                        {/* 본문 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 상단: 병원명 + 우측 태그/chevron */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="mc-card-title" style={{ marginBottom: 2 }}>
                                {r.hospitalName}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {r.department && <>{r.department}<span style={{ color: 'var(--text-3)' }}>·</span></>}
                                <Ic d={P.cal} size={10}/> {r.visitDate}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              <span className="mc-tag">{r.treatmentType}</span>
                              <div style={{
                                color: 'var(--text-3)',
                                transform: isExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.15s',
                                display: 'inline-flex',
                              }}>
                                <Ic d={P.chev} size={14}/>
                              </div>
                            </div>
                          </div>

                          {/* 하단: 진단명 + 질병 코드 */}
                          {(hasDiagnosis || showCode) && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-soft)' }}>
                              {hasDiagnosis && (
                                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>
                                  {r.diagnosis}
                                </div>
                              )}
                              {showCode && (
                                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                                  질병 코드 {r.diseaseCode}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 펼침 영역: 액션 버튼 */}
                      {isExpanded && (
                        <div style={{ padding: '12px 16px', background: '#FAFBFD', borderTop: '1px solid var(--border-soft)' }}>
                          {hasDiagnosis ? (
                            <button
                              className="mc-btn mc-btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                goPreTreatment(r.diagnosis);
                              }}
                              style={{ fontSize: 12 }}>
                              <Ic d={P.search} size={12}/>
                              진료 전 검색으로 보장 확인
                              <Ic d={P.arrow} size={12}/>
                            </button>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              진단명 정보가 없어 보장 확인이 어려워요.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicalRecords;
