import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthAPI, insuranceAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  hospital: (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  calendar: (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  heart:    (<path d="M8 14s-5-3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 4-5 7-5 7z"/>),
  arrow:    (<><path d="M3 8h10M9 4l4 4-4 4"/></>),
  shield:   (<path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4z"/>),
  search:   (<><circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/></>),
  pill:     (<><path d="M5 11l6-6M3.5 9.5A3.5 3.5 0 0 0 9.5 3.5"/><path d="M6.5 12.5A3.5 3.5 0 0 0 12.5 6.5"/></>),
  chart:    (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
};

const RISK_COLOR  = { '나쁨': '#9A6060', '보통': '#8A7040', '좋음': '#2F6FE8', '-': 'var(--text-2)' };
const DISEASE_KR  = { STROKE: '뇌졸중', DIABETES: '당뇨', CARDIO: '심뇌혈관' };

const gradeFromRank = (rank) => {
  if (rank == null || rank === '') return '-';
  const n = parseFloat(rank);
  if (isNaN(n)) return '-';
  if (n >= 67) return '나쁨';
  if (n >= 34) return '보통';
  return '좋음';
};

const fmtYM = (ym) => {
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m)}월`;
};

const LinkBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    fontSize: 12, color: 'var(--blue)', fontWeight: 600,
  }}>
    {children}
  </button>
);

const HealthReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading]         = useState(true);
  const [stats, setStats]             = useState({ visits: 0, checkups: 0, prescriptions: 0, gaps: 0 });
  const [timeline, setTimeline]       = useState([]);
  const [deptPattern, setDeptPattern] = useState([]);
  const [diagKeywords, setDiagKeywords] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [healthAge, setHealthAge]     = useState(null);
  const [insights, setInsights]       = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [records, checkups, preds, hAge, gaps] = await Promise.all([
          healthAPI.getMedicalRecords().catch(() => []),
          healthAPI.getCheckupResults().catch(() => []),
          healthAPI.getDiseasePredictions().catch(() => []),
          healthAPI.getHealthAge().catch(() => null),
          insuranceAPI.getCoverageComparison().catch(() => []),
        ]);

        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const recent = records.filter((r) => r.visitDate && new Date(r.visitDate) >= cutoff);
        const recentCk = checkups.filter((c) => c.checkupDate && new Date(c.checkupDate) >= cutoff);

        // ── 요약 통계 ──────────────────────────────────────────────────────
        const prescriptions = recent.filter((r) => r.treatmentType === '약국').length;
        const gapCount = Array.isArray(gaps)
          ? gaps.filter((g) => (g.selfCoverageAmount || 0) < (g.avgGroupCoverageAmount || 0)).length
          : 0;
        setStats({ visits: recent.length, checkups: recentCk.length, prescriptions, gaps: gapCount });

        // ── 월별 타임라인 ──────────────────────────────────────────────────
        const monthMap = {};
        recent.forEach((r) => {
          const ym = r.visitDate.substring(0, 7);
          if (!monthMap[ym]) monthMap[ym] = { visits: [], checkups: 0 };
          monthMap[ym].visits.push(r);
        });
        recentCk.forEach((c) => {
          const ym = c.checkupDate.substring(0, 7);
          if (!monthMap[ym]) monthMap[ym] = { visits: [], checkups: 0 };
          monthMap[ym].checkups += 1;
        });
        const tl = Object.entries(monthMap)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([ym, data]) => {
            const depts = {};
            data.visits.forEach((r) => {
              const key = r.treatmentType === '약국' ? '약국 처방' : (r.department || '기타');
              depts[key] = (depts[key] || 0) + 1;
            });
            return { ym, depts, checkupCount: data.checkups };
          });
        setTimeline(tl);

        // ── 진료과 패턴 ────────────────────────────────────────────────────
        const deptCount = {};
        recent.forEach((r) => {
          if (r.treatmentType === '약국') return;
          const d = r.department || '기타';
          deptCount[d] = (deptCount[d] || 0) + 1;
        });
        setDeptPattern(
          Object.entries(deptCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([dept, cnt]) => ({ dept, cnt }))
        );

        // ── 반복 진단 키워드 ───────────────────────────────────────────────
        const diagCount = {};
        recent.forEach((r) => {
          if (!r.diagnosis || r.diagnosis === '해당없음' || r.treatmentType === '약국') return;
          diagCount[r.diagnosis] = (diagCount[r.diagnosis] || 0) + 1;
        });
        setDiagKeywords(
          Object.entries(diagCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([diag, cnt]) => ({ diag, cnt }))
        );

        // ── 질병 예측 (최신 1건/질환) ──────────────────────────────────────
        const predMap = {};
        preds.forEach((p) => {
          if (!predMap[p.predictionType] || p.checkupDate > predMap[p.predictionType].checkupDate) {
            predMap[p.predictionType] = p;
          }
        });
        setPredictions(Object.values(predMap));

        // ── 건강나이 ───────────────────────────────────────────────────────
        setHealthAge(hAge);

        // ── 인사이트 ───────────────────────────────────────────────────────
        const ins = [];
        const deptNames = Object.keys(deptCount);
        if (deptNames.includes('정형외과')) {
          ins.push({ icon: P.search, text: '최근 정형외과 진료가 있어요. 도수치료·MRI 보장 여부를 진료 전 검색에서 확인해보세요.', path: '/pre-treatment' });
        }
        if (gapCount > 0) {
          ins.push({ icon: P.shield, text: `보험 공백 ${gapCount}개 항목이 평균보다 낮아요. 보장 공백 점검을 확인해보세요.`, path: '/insurance-plan' });
        }
        const lastCkDate = [...checkups].sort((a, b) =>
          (b.checkupDate || '').localeCompare(a.checkupDate || ''))[0]?.checkupDate;
        if (lastCkDate) {
          const daysSince = (Date.now() - new Date(lastCkDate)) / 86400000;
          if (daysSince > 365) {
            ins.push({ icon: P.calendar, text: '마지막 건강검진이 1년 이상 지났어요. 건강검진 기록에서 확인해보세요.', path: '/checkup' });
          }
        }
        setInsights(ins);
      } catch (e) {
        console.error('HealthReport error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">12개월 건강 리포트</div>
          <div className="mc-page-subtitle">최근 1년간의 건강 활동 패턴을 요약한 화면이에요.</div>
        </div>
      </div>

      {loading ? (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 8 }}>
          <div>
            <div className="mc-alert-title">데이터 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      ) : (
        <>
          {/* ① 요약 카드 */}
          <div className="mc-stats-strip">
            <div className="mc-stat">
              <div className="mc-stat-label">진료 방문</div>
              <div className="mc-stat-value">{stats.visits}회</div>
              <div className="mc-stat-sub">최근 12개월</div>
            </div>
            <div className="mc-stat">
              <div className="mc-stat-label">건강검진</div>
              <div className="mc-stat-value">{stats.checkups}건</div>
              <div className="mc-stat-sub">최근 12개월</div>
            </div>
            <div className="mc-stat">
              <div className="mc-stat-label">약국 처방</div>
              <div className="mc-stat-value">{stats.prescriptions}건</div>
              <div className="mc-stat-sub">최근 12개월</div>
            </div>
            <div className="mc-stat">
              <div className="mc-stat-label">보험 공백</div>
              <div className="mc-stat-value" style={{ color: stats.gaps > 0 ? '#9A6060' : 'inherit' }}>
                {stats.gaps}건
              </div>
              <div className="mc-stat-sub">확인 필요</div>
            </div>
          </div>

          <div className="mc-two-col" style={{ marginTop: 18 }}>
            {/* ② 월별 건강 활동 타임라인 */}
            <div>
              <div className="mc-sec-head">
                <span className="mc-sec-title">월별 건강 활동</span>
              </div>
              <div className="mc-card mc-card-body">
                {timeline.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0', fontSize: 13 }}>
                    최근 12개월 활동 내역이 없어요.
                  </div>
                ) : (
                  <div className="mc-stack-sm">
                    {timeline.map(({ ym, depts, checkupCount }) => (
                      <div key={ym} style={{ display: 'flex', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-soft)' }}>
                        <div style={{ minWidth: 68, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', paddingTop: 2 }}>
                          {fmtYM(ym)}
                        </div>
                        <div style={{ flex: 1 }}>
                          {checkupCount > 0 && (
                            <div style={{ fontSize: 12, color: '#2F6FE8', marginBottom: 3 }}>
                              · 건강검진 {checkupCount}건
                            </div>
                          )}
                          {Object.entries(depts).map(([dept, cnt]) => (
                            <div key={dept} style={{ fontSize: 12, color: 'var(--text-1)', marginBottom: 3 }}>
                              · {dept} {cnt}건
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* ③ 위험도 요약 */}
              <div>
                <div className="mc-sec-head">
                  <span className="mc-sec-title">질병 위험도 요약</span>
                  <LinkBtn onClick={() => navigate('/checkup')}>상세 보기 →</LinkBtn>
                </div>
                <div className="mc-card mc-card-body">
                  {predictions.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
                      질병 예측 데이터가 없어요.
                    </div>
                  ) : (
                    <div className="mc-stack-sm">
                      {predictions.map((p) => {
                        const grade = gradeFromRank(p.averageRatio);
                        return (
                          <div key={p.predictionType} className="mc-kv">
                            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>
                              {DISEASE_KR[p.predictionType] || p.predictionType}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: RISK_COLOR[grade] }}>
                              {grade}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ④ 건강나이 요약 */}
              {healthAge && healthAge.biologicalAge && (
                <div>
                  <div className="mc-sec-head">
                    <span className="mc-sec-title">건강나이</span>
                    <LinkBtn onClick={() => navigate('/checkup')}>상세 보기 →</LinkBtn>
                  </div>
                  <div className="mc-card mc-card-body">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)' }}>
                        {healthAge.biologicalAge}세
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        실제 나이 {healthAge.chronologicalAge}세 대비&nbsp;
                        <span style={{
                          fontWeight: 700,
                          color: healthAge.biologicalAge > healthAge.chronologicalAge ? '#9A6060' : '#2F6FE8',
                        }}>
                          {healthAge.biologicalAge > healthAge.chronologicalAge
                            ? `+${healthAge.biologicalAge - healthAge.chronologicalAge}세`
                            : healthAge.biologicalAge < healthAge.chronologicalAge
                              ? `-${healthAge.chronologicalAge - healthAge.biologicalAge}세`
                              : '동일'}
                        </span>
                      </span>
                    </div>
                    {healthAge.summaryNote && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
                        {healthAge.summaryNote}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ⑤ 진료 패턴 */}
          {(deptPattern.length > 0 || diagKeywords.length > 0) && (
            <div className="mc-two-col" style={{ marginTop: 16 }}>
              {deptPattern.length > 0 && (
                <div>
                  <div className="mc-sec-head">
                    <span className="mc-sec-title">자주 방문한 진료과</span>
                  </div>
                  <div className="mc-card mc-card-body">
                    <div className="mc-stack-sm">
                      {deptPattern.map(({ dept, cnt }) => (
                        <div key={dept} className="mc-kv">
                          <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{dept}</span>
                          <span className="mc-tag">{cnt}회</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {diagKeywords.length > 0 && (
                <div>
                  <div className="mc-sec-head">
                    <span className="mc-sec-title">반복되는 진단</span>
                  </div>
                  <div className="mc-card mc-card-body">
                    <div className="mc-stack-sm">
                      {diagKeywords.map(({ diag, cnt }) => (
                        <div key={diag} className="mc-kv">
                          <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{diag}</span>
                          <span className="mc-tag">{cnt}회</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ⑥ 다음 확인할 것 */}
          {insights.length > 0 && (
            <>
              <div className="mc-sec-head" style={{ marginTop: 16 }}>
                <span className="mc-sec-title">다음 확인할 것</span>
              </div>
              <div className="mc-stack-sm">
                {insights.map((ins, i) => (
                  <div key={i} className="mc-card mc-card-head"
                    style={{ padding: '14px 16px', cursor: 'pointer' }}
                    onClick={() => navigate(ins.path)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 6,
                        background: 'var(--blue-soft)', color: 'var(--blue)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Ic d={ins.icon} size={14}/>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{ins.text}</span>
                    </div>
                    <Ic d={P.arrow} size={14}/>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default HealthReport;
