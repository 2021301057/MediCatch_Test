import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthAPI, insuranceAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  calendar: (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  arrow:    (<><path d="M3 8h10M9 4l4 4-4 4"/></>),
  shield:   (<path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4z"/>),
  search:   (<><circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/></>),
  check:    (<path d="M3 8.5 6.5 12 13 4"/>),
  chev:     (<path d="M4 6l4 4 4-4"/>),
};

const RISK_COLOR = { '나쁨': '#9A6060', '보통': '#8A7040', '좋음': '#2F6FE8', '-': 'var(--text-2)' };
const DISEASE_KR = { STROKE: '뇌졸중', DIABETES: '당뇨', CARDIO: '심뇌혈관' };
const OVERALL_RISK_LABEL = {
  '나쁨': '전체 위험도 높음',
  '보통': '전체 위험도 보통',
  '좋음': '전체 위험도 낮음',
  '-': '전체 위험도 확인 필요',
};
const FACTOR_STATUS_LABEL = {
  '나쁨': '관리 필요',
  '보통': '주의',
  '좋음': '양호',
  '-': '요인',
};
const FACTOR_STATUS_COLOR = {
  '관리 필요': '#9A6060',
  '주의': '#8A7040',
  '양호': '#2F6FE8',
  '요인': 'var(--text-2)',
};

const parseNumber = (value) => {
  if (value == null || value === '') return null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const normalizeGrade = (value) => {
  if (!value) return null;
  const text = String(value).trim().toUpperCase();
  if (['나쁨', '높음', '위험', 'HIGH', 'BAD', '5', '4'].includes(text)) return '나쁨';
  if (['보통', '중간', 'MEDIUM', 'MID', 'NORMAL', '3'].includes(text)) return '보통';
  if (['좋음', '낮음', 'LOW', 'GOOD', '1', '2'].includes(text)) return '좋음';
  return null;
};

const gradeFromValue = (value) => {
  const n = parseNumber(value);
  if (n == null || Number.isNaN(n)) return '-';
  if (n >= 67) return '나쁨';
  if (n >= 34) return '보통';
  return '좋음';
};

const gradeFromPrediction = (prediction) => (
  normalizeGrade(prediction?.riskGrade)
  || normalizeGrade(prediction?.grade)
  || gradeFromValue(prediction?.riskRatio ?? prediction?.averageRatio)
);

const isPharmacyRecord = (record) => {
  const hospital = record.hospitalName || record.hospital || '';
  const department = record.department || '';
  return record.treatmentType === '약국'
    || record.diseaseCode === '$'
    || hospital.includes('약국')
    || department.includes('약국');
};

const isCoverageGap = (row) => {
  const self = Number(row.selfCoverageAmount || 0);
  const avg = Number(row.avgGroupCoverageAmount || 0);
  if (avg <= 0) return false;
  if (self <= 0) return true;
  return self < avg * 0.8;
};

const fmtYM = (ym) => {
  const [year, month] = ym.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
};

const compactList = (items, emptyText = '-') => (
  items.length > 0 ? items.join(' · ') : emptyText
);

const firstText = (...values) => (
  values.find((value) => value != null && String(value).trim() !== '') || ''
);

const factorName = (factor) => firstText(
  factor.riskFactor,
  factor.factorName,
  factor.name,
  factor.title,
  factor.itemName,
  factor.resRiskFactor,
  factor.resName,
  factor.resTitle,
  factor.resItem
);

const factorCurrent = (factor) => firstText(
  factor.currentState,
  factor.currentValue,
  factor.myAmount,
  factor.value,
  factor.resState,
  factor.resCurrent,
  factor.resValue,
  factor.resAmount
);

const factorAverage = (factor) => firstText(
  factor.averageValue,
  factor.averageAmount,
  factor.avgValue,
  factor.resAverage,
  factor.resAvg
);

const factorSeverity = (factor) => (
  normalizeGrade(factor.severityType)
  || normalizeGrade(factor.severity)
  || normalizeGrade(factor.resType)
  || '-'
);

const factorStatusLabel = (factor) => FACTOR_STATUS_LABEL[factorSeverity(factor)] || '요인';

const RiskBadge = ({ grade }) => {
  const label = OVERALL_RISK_LABEL[grade] || OVERALL_RISK_LABEL['-'];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      borderRadius: 9999,
      padding: '4px 9px',
      background: grade === '나쁨' ? '#F2ECEC' : grade === '보통' ? '#F4EFDE' : 'var(--blue-soft)',
      color: RISK_COLOR[grade] || 'var(--text-2)',
      fontSize: 11.5,
      fontWeight: 800,
      lineHeight: 1,
    }}>
      {label}
    </span>
  );
};

const FactorStatus = ({ status }) => (
  <span style={{
    display: 'inline-flex',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    color: FACTOR_STATUS_COLOR[status] || 'var(--text-2)',
    fontSize: 12,
    fontWeight: 700,
  }}>
    {status}
  </span>
);

const factorLine = (factor) => {
  const name = factorName(factor);
  const current = factorCurrent(factor);
  const average = factorAverage(factor);
  if (!name) return '';
  if (current && average) return `${name} (${current} / 평균 ${average})`;
  if (current) return `${name} (${current})`;
  return name;
};

const healthAgeFactorLine = (factor) => (
  firstText(
    factorLine(factor),
    factor.message,
    factor.contents,
    factor.description,
    factor.resContents,
    factor.resMessage
  )
);

const LinkBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--blue)',
    fontWeight: 600,
  }}>
    {children}
  </button>
);

const Metric = ({ label, value, sub, tone }) => (
  <div style={{
    minWidth: 0,
    padding: '12px 14px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: '#FAFBFD',
  }}>
    <div className="mc-field-label">{label}</div>
    <div style={{
      marginTop: 5,
      fontSize: 20,
      fontWeight: 800,
      color: tone || 'var(--text-1)',
      letterSpacing: '-0.3px',
    }}>
      {value}
    </div>
    {sub && <div className="mc-card-sub" style={{ marginTop: 2 }}>{sub}</div>}
  </div>
);

const HealthReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    visits: 0,
    checkups: 0,
    prescriptions: 0,
    gaps: 0,
    topDepartment: '-',
    topDiagnosis: '-',
    lastCheckupHeadline: '',
  });
  const [timeline, setTimeline] = useState([]);
  const [deptPattern, setDeptPattern] = useState([]);
  const [diagKeywords, setDiagKeywords] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [healthAge, setHealthAge] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loadWarning, setLoadWarning] = useState('');
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [healthAgeOpen, setHealthAgeOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadWarning('');
      try {
        const [records, checkups, preds, hAge, comparisons] = await Promise.all([
          healthAPI.getMedicalRecords().catch(() => {
            setLoadWarning('일부 건강 데이터를 불러오지 못했습니다.');
            return [];
          }),
          healthAPI.getCheckupResults().catch(() => []),
          healthAPI.getDiseasePredictions().catch(() => []),
          healthAPI.getHealthAge().catch(() => null),
          insuranceAPI.getCoverageComparison().catch(() => []),
        ]);

        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const recentRecords = records.filter((record) => (
          record.visitDate && new Date(record.visitDate) >= cutoff
        ));
        const recentCheckups = checkups.filter((checkup) => (
          checkup.checkupDate && new Date(checkup.checkupDate) >= cutoff
        ));

        const prescriptions = recentRecords.filter(isPharmacyRecord).length;
        const gaps = Array.isArray(comparisons) ? comparisons.filter(isCoverageGap) : [];

        const deptCount = {};
        recentRecords.forEach((record) => {
          if (isPharmacyRecord(record)) return;
          const department = record.department || '기타';
          deptCount[department] = (deptCount[department] || 0) + 1;
        });
        const departments = Object.entries(deptCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([dept, count]) => ({ dept, count }));

        const diagnosisCount = {};
        recentRecords.forEach((record) => {
          if (isPharmacyRecord(record)) return;
          if (!record.diagnosis || record.diagnosis === '해당없음') return;
          diagnosisCount[record.diagnosis] = (diagnosisCount[record.diagnosis] || 0) + 1;
        });
        const diagnoses = Object.entries(diagnosisCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([diagnosis, count]) => ({ diagnosis, count }));

        const latestCheckup = [...checkups].sort((a, b) => (
          (b.checkupDate || '').localeCompare(a.checkupDate || '')
        ))[0];
        const lastCheckupHeadline = firstText(
          latestCheckup?.abnormalFindings,
          latestCheckup?.recommendations
        );

        setStats({
          visits: recentRecords.length,
          checkups: recentCheckups.length,
          prescriptions,
          gaps: gaps.length,
          topDepartment: departments[0]?.dept || '-',
          topDiagnosis: diagnoses[0]?.diagnosis || '-',
          lastCheckupHeadline,
        });
        setDeptPattern(departments);
        setDiagKeywords(diagnoses);

        const monthMap = {};
        recentRecords.forEach((record) => {
          const ym = record.visitDate?.substring(0, 7);
          if (!ym) return;
          if (!monthMap[ym]) monthMap[ym] = { visits: 0, prescriptions: 0, checkups: 0, departments: {} };
          if (isPharmacyRecord(record)) {
            monthMap[ym].prescriptions += 1;
          } else {
            monthMap[ym].visits += 1;
            const department = record.department || '기타';
            monthMap[ym].departments[department] = (monthMap[ym].departments[department] || 0) + 1;
          }
        });
        recentCheckups.forEach((checkup) => {
          const ym = checkup.checkupDate?.substring(0, 7);
          if (!ym) return;
          if (!monthMap[ym]) monthMap[ym] = { visits: 0, prescriptions: 0, checkups: 0, departments: {} };
          monthMap[ym].checkups += 1;
        });
        setTimeline(
          Object.entries(monthMap)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([ym, value]) => ({
              ym,
              ...value,
              total: value.visits + value.prescriptions + value.checkups,
            }))
        );

        const latestPredictions = {};
        preds.forEach((prediction) => {
          const key = prediction.predictionType;
          if (!key) return;
          if (!latestPredictions[key] || prediction.checkupDate > latestPredictions[key].checkupDate) {
            latestPredictions[key] = prediction;
          }
        });
        setPredictions(Object.values(latestPredictions));
        setHealthAge(hAge);

        const next = [];
        if (departments.some((item) => item.dept === '정형외과')) {
          next.push({
            icon: P.search,
            title: '정형외과 치료 전 보장 확인',
            text: '도수치료, MRI, 주사치료처럼 실손 조건이 달라지는 항목을 먼저 확인해보세요.',
            path: '/pre-treatment',
          });
        }
        if (gaps.length > 0) {
          next.push({
            icon: P.shield,
            title: '보험 공백 확인',
            text: `평균 대비 부족하거나 미가입으로 보이는 보장 ${gaps.length}개를 확인해보세요.`,
            path: '/insurance-plan',
          });
        }
        if (!latestCheckup?.checkupDate || (Date.now() - new Date(latestCheckup.checkupDate)) / 86400000 > 365) {
          next.push({
            icon: P.calendar,
            title: '건강검진 기록 확인',
            text: '최근 검진 데이터가 부족하거나 1년 이상 지난 상태일 수 있습니다.',
            path: '/checkup',
          });
        }
        if (next.length === 0) {
          next.push({
            icon: P.check,
            title: '현재는 큰 확인 항목이 없어요',
            text: '진료나 검진 데이터가 새로 동기화되면 리포트가 자동으로 더 풍부해집니다.',
            path: '/checkup',
          });
        }
        setInsights(next);
      } catch (error) {
        console.error('HealthReport error:', error);
        setLoadWarning('건강 리포트를 불러오는 중 문제가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasAnyData = stats.visits > 0
    || stats.checkups > 0
    || stats.prescriptions > 0
    || predictions.length > 0
    || healthAge
    || stats.gaps > 0;

  const summaryText = (() => {
    if (!hasAnyData) return '아직 최근 12개월 건강 데이터가 충분하지 않습니다.';
    const parts = [];
    if (stats.topDepartment !== '-') parts.push(`${stats.topDepartment} 방문이 가장 많았고`);
    if (stats.topDiagnosis !== '-') parts.push(`${stats.topDiagnosis} 기록이 반복해서 보입니다`);
    if (stats.lastCheckupHeadline) parts.push(`최근 검진 소견은 "${stats.lastCheckupHeadline}"입니다`);
    if (stats.gaps > 0) parts.push(`보험 보장 ${stats.gaps}개는 추가 확인이 필요합니다`);
    return parts.length > 0 ? `${parts.join(', ')}.` : '최근 12개월 건강 활동을 한눈에 정리했습니다.';
  })();

  const healthAgeDiff = healthAge && healthAge.biologicalAge != null && healthAge.chronologicalAge != null
    ? Number(healthAge.biologicalAge) - Number(healthAge.chronologicalAge)
    : null;

  const healthAgeFactors = Array.isArray(healthAge?.factors) ? healthAge.factors : [];
  const maxMonthTotal = Math.max(1, ...timeline.map((month) => month.total || 0));

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">12개월 건강 리포트</div>
          <div className="mc-page-subtitle">최근 1년간의 진료, 검진, 보험 점검 흐름을 한 곳에서 확인하세요.</div>
        </div>
      </div>

      {loading ? (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 8 }}>
          <div>
            <div className="mc-alert-title">데이터 불러오는 중...</div>
            <div className="mc-alert-body">최근 건강 활동을 정리하고 있습니다.</div>
          </div>
        </div>
      ) : (
        <div className="mc-stack-md">
          {loadWarning && (
            <div className="mc-alert mc-alert-warning">
              <div>
                <div className="mc-alert-title">일부 데이터 확인 필요</div>
                <div className="mc-alert-body">{loadWarning}</div>
              </div>
            </div>
          )}

          {!hasAnyData && (
            <div className="mc-alert mc-alert-blue">
              <div>
                <div className="mc-alert-title">최근 건강 데이터가 아직 없어요</div>
                <div className="mc-alert-body">
                  내 건강 불러오기를 실행하거나 건강검진/진료 기록을 동기화하면 이 화면이 채워집니다.
                </div>
              </div>
            </div>
          )}

          <section>
            <div className="mc-sec-head">
              <span className="mc-sec-title">최근 12개월 요약</span>
            </div>
            <div className="mc-card mc-card-body-lg">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <Metric label="진료" value={`${stats.visits}회`} sub="병원 방문" />
                <Metric label="검진" value={`${stats.checkups}건`} sub="건강검진" />
                <Metric label="처방" value={`${stats.prescriptions}건`} sub="약국 기록" />
                <Metric
                  label="보험 공백"
                  value={`${stats.gaps}건`}
                  sub="평균 대비 부족"
                  tone={stats.gaps > 0 ? '#9A6060' : '#2F6FE8'}
                />
              </div>
              <div style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid var(--border-soft)',
                fontSize: 14,
                lineHeight: 1.65,
                color: 'var(--text-1)',
              }}>
                {summaryText}
              </div>
            </div>
          </section>

          <section>
            <div className="mc-two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <div className="mc-sec-head">
                  <span className="mc-sec-title">검진 기반 건강 지표</span>
                  <LinkBtn onClick={() => navigate('/checkup')}>검진 기록 보기 →</LinkBtn>
                </div>
                <div className="mc-card mc-card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 18 }}>
                    <div>
                      <div className="mc-field-label">건강나이</div>
                      {healthAge && healthAge.biologicalAge != null ? (
                        <>
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)' }}>
                              {healthAge.biologicalAge}세
                            </span>
                            {healthAgeDiff != null && (
                              <span style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: healthAgeDiff > 0 ? '#9A6060' : '#2F6FE8',
                              }}>
                                {healthAgeDiff > 0 ? `+${healthAgeDiff}세` : healthAgeDiff < 0 ? `${healthAgeDiff}세` : '실제 나이와 동일'}
                              </span>
                            )}
                          </div>
                          {healthAge.summaryNote && (
                            <div className="mc-card-sub" style={{ marginTop: 8, lineHeight: 1.5 }}>
                              {healthAge.summaryNote}
                            </div>
                          )}
                          {(healthAge.detailMessage || healthAge.changeAfterMessage || healthAgeFactors.length > 0) && (
                            <button
                              type="button"
                              onClick={() => setHealthAgeOpen((open) => !open)}
                              className="mc-sec-link"
                              style={{ marginTop: 10 }}
                            >
                              건강나이 이유 보기
                              <span style={{ transform: healthAgeOpen ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}>
                                <Ic d={P.chev} size={11}/>
                              </span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="mc-card-sub" style={{ marginTop: 12 }}>건강나이 데이터가 없어요.</div>
                      )}

                      {healthAgeOpen && (
                        <div className="mc-stack-xs" style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: '1px solid var(--border-soft)',
                        }}>
                          {healthAge.detailMessage && (
                            <div className="mc-card-sub" style={{ lineHeight: 1.55 }}>{healthAge.detailMessage}</div>
                          )}
                          {healthAgeFactors.slice(0, 5).map((factor, index) => {
                            const line = healthAgeFactorLine(factor);
                            if (!line) return null;
                            return (
                              <div key={`${line}-${index}`} className="mc-kv" style={{ alignItems: 'flex-start' }}>
                                <span className="mc-kv-key">요인 {index + 1}</span>
                                <span className="mc-kv-val" style={{ textAlign: 'right', lineHeight: 1.45 }}>{line}</span>
                              </div>
                            );
                          })}
                          {healthAge.changeAfterMessage && (
                            <div className="mc-alert mc-alert-blue" style={{ marginTop: 4 }}>
                              <div>
                                <div className="mc-alert-title">개선 시 변화</div>
                                <div className="mc-alert-body">{healthAge.changeAfterMessage}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mc-field-label">질병 위험도</div>
                      {predictions.length === 0 ? (
                        <div className="mc-card-sub" style={{ marginTop: 12 }}>질병 예측 데이터가 없어요.</div>
                      ) : (
                        <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                          {predictions.map((prediction) => {
                            const grade = gradeFromPrediction(prediction);
                            const factors = Array.isArray(prediction.factors) ? prediction.factors : [];
                            const compares = Array.isArray(prediction.compares) ? prediction.compares : [];
                            const key = prediction.predictionType;
                            const preview = factors.map(factorLine).filter(Boolean).slice(0, 2);
                            const isOpen = expandedRisk === key;
                            const needsCareCount = factors.filter((factor) => factorSeverity(factor) === '나쁨').length;

                            return (
                              <div key={key} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedRisk(isOpen ? null : key)}
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    textAlign: 'left',
                                  }}
                                >
                                  <span style={{ minWidth: 0 }}>
                                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                                      {DISEASE_KR[key] || key}
                                    </span>
                                    {preview.length > 0 && (
                                      <span className="mc-card-sub" style={{ marginTop: 2, display: 'block' }}>
                                        관리 요인: {compactList(preview)}
                                      </span>
                                    )}
                                  </span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                                    <RiskBadge grade={grade} />
                                    <span style={{ color: 'var(--text-3)', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}>
                                      <Ic d={P.chev} size={12}/>
                                    </span>
                                  </span>
                                </button>

                                {isOpen && (
                                  <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                                    <div className="mc-card-sub" style={{ lineHeight: 1.5 }}>
                                      전체 예측 위험도는 현재 수치 기준으로 판단하고, 아래 항목은 위험도에 영향을 주는 개별 관리 요인입니다.
                                      {needsCareCount > 0 ? ` 관리 필요 요인 ${needsCareCount}개가 확인됐습니다.` : ''}
                                    </div>
                                    {factors.length > 0 ? (
                                      factors.slice(0, 5).map((factor, index) => {
                                        const line = factorLine(factor);
                                        if (!line) return null;
                                        const status = factorStatusLabel(factor);
                                        return (
                                          <div
                                            key={`${line}-${index}`}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '74px minmax(0, 1fr)',
                                              gap: 12,
                                              alignItems: 'start',
                                            }}
                                          >
                                            <FactorStatus status={status !== '요인' ? status : `요인 ${index + 1}`} />
                                            <span style={{
                                              minWidth: 0,
                                              fontSize: 13,
                                              fontWeight: 700,
                                              color: 'var(--text-1)',
                                              lineHeight: 1.45,
                                              wordBreak: 'keep-all',
                                            }}>
                                              {line}
                                            </span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="mc-card-sub">상세 위험요인 데이터가 없어요.</div>
                                    )}
                                    {compares.length > 0 && (
                                      <div style={{
                                        marginTop: 6,
                                        padding: '10px 12px',
                                        borderRadius: 6,
                                        background: '#FAFBFD',
                                        border: '1px solid var(--border-soft)',
                                      }}>
                                        <div className="mc-field-label" style={{ marginBottom: 6 }}>향후 예측 참고</div>
                                        <div className="mc-card-sub" style={{ lineHeight: 1.5 }}>
                                          {compares.map((item) => `${item.year}년 ${item.predictedState}`).join(' → ')}
                                        </div>
                                        <div className="mc-card-sub" style={{ lineHeight: 1.5, marginTop: 4 }}>
                                          현재 검진 데이터를 바탕으로 한 참고용 변화입니다.
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mc-sec-head">
                  <span className="mc-sec-title">건강 활동 패턴</span>
                  <LinkBtn onClick={() => navigate('/medical-records')}>진료 기록 보기 →</LinkBtn>
                </div>
                <div className="mc-card mc-card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    <div>
                      <div className="mc-field-label">자주 방문한 진료과</div>
                      {deptPattern.length === 0 ? (
                        <div className="mc-card-sub" style={{ marginTop: 10 }}>진료과 패턴이 없어요.</div>
                      ) : (
                        <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                          {deptPattern.slice(0, 4).map(({ dept, count }) => (
                            <div key={dept} className="mc-kv">
                              <span className="mc-kv-key">{dept}</span>
                              <span className="mc-tag">{count}회</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mc-field-label">반복된 진단</div>
                      {diagKeywords.length === 0 ? (
                        <div className="mc-card-sub" style={{ marginTop: 10 }}>반복 진단이 없어요.</div>
                      ) : (
                        <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                          {diagKeywords.slice(0, 4).map(({ diagnosis, count }) => (
                            <div key={diagnosis} className="mc-kv">
                              <span className="mc-kv-key" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {diagnosis}
                              </span>
                              <span className="mc-tag">{count}회</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mc-sec-head">
              <span className="mc-sec-title">월별 활동 흐름</span>
              <span className="mc-card-sub">활동이 있는 달만 표시합니다.</span>
            </div>
            <div className="mc-card mc-card-body">
              {timeline.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '28px 0', fontSize: 13 }}>
                  최근 12개월 활동 내역이 없어요.
                </div>
              ) : (
                <div className="mc-stack-xs">
                  {timeline.map((month) => {
                    const topDepartments = Object.entries(month.departments)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([department, count]) => `${department} ${count}건`);
                    const width = `${Math.max(8, Math.round((month.total / maxMonthTotal) * 100))}%`;
                    return (
                      <div key={month.ym} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 14, alignItems: 'center' }}>
                        <span className="mc-kv-key">{fmtYM(month.ym)}</span>
                        <div>
                          <div style={{ height: 7, background: 'var(--border-soft)', borderRadius: 9999, overflow: 'hidden', marginBottom: 5 }}>
                            <div style={{ width, height: '100%', background: 'var(--blue)', borderRadius: 9999 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <span className="mc-card-sub">
                              진료 {month.visits}건
                              {month.prescriptions > 0 ? ` · 처방 ${month.prescriptions}건` : ''}
                              {month.checkups > 0 ? ` · 검진 ${month.checkups}건` : ''}
                            </span>
                            <span className="mc-card-sub" style={{ textAlign: 'right' }}>
                              {compactList(topDepartments)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mc-sec-head">
              <span className="mc-sec-title">다음 확인할 것</span>
            </div>
            <div className="mc-grid-auto-md">
              {insights.map((item, index) => (
                <button
                  key={`${item.title}-${index}`}
                  className="mc-card mc-card-head"
                  style={{ padding: '16px', cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start' }}
                  onClick={() => navigate(item.path)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      background: 'var(--blue-soft)',
                      color: 'var(--blue)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Ic d={item.icon} size={14}/>
                    </div>
                    <div>
                      <div className="mc-card-title" style={{ fontSize: 13.5 }}>{item.title}</div>
                      <div className="mc-card-sub" style={{ marginTop: 4, lineHeight: 1.5 }}>{item.text}</div>
                    </div>
                  </div>
                  <Ic d={P.arrow} size={13}/>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default HealthReport;
