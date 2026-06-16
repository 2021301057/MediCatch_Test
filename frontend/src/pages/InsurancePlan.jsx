import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthAPI, insuranceAPI } from '../api/services';
import MobileNavMenu from '../components/common/MobileNavMenu';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  chat:   (<><path d="M2 2h12v9H9l-3 3v-3H2V2z"/><path d="M5 6h6M5 8.5h4"/></>),
  shield: (<path d="M8 1.5l5.5 2v4.5C13.5 11.5 8 14.5 8 14.5S2.5 11.5 2.5 8V3.5L8 1.5z"/>),
  sync:   (<><path d="M13 5a5 5 0 0 0-8.5-2.8L3 3.7"/><path d="M3 1.5v2.2h2.2"/><path d="M3 11a5 5 0 0 0 8.5 2.8L13 12.3"/><path d="M13 14.5v-2.2h-2.2"/></>),
};

const POLICY_TYPE_LABEL = {
  SUPPLEMENTARY: '실손',
  HEALTH: '건강',
  SAVINGS: '저축',
  CAR: '자동차',
  PROPERTY: '재물',
  LIFE: '건강',
  NON_LIFE: '건강',
};

const ACTIVE_STATUS = new Set(['정상', '계약부활', 'ACTIVE']);

const GAP_STATUS = {
  GOOD: { label: '평균 이상', tag: 'mc-tag-success', bar: 'success' },
  LOW: { label: '평균보다 낮음', tag: 'mc-tag-warning', bar: 'warning' },
  MISSING: { label: '확인되지 않음', tag: 'mc-tag-danger', bar: 'danger' },
  UNKNOWN: { label: '평균 데이터 없음', tag: 'mc-tag-neutral', bar: 'blue' },
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatWon = (amount) => `${new Intl.NumberFormat('ko-KR').format(amount || 0)}원`;

const formatCompactWon = (amount) => {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}천만원`;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}백만원`;
  return formatWon(amount);
};

const getCoverageItems = (policy) => (
  Array.isArray(policy?.coverageItems)
    ? policy.coverageItems
    : Array.isArray(policy?.coverage_items)
      ? policy.coverage_items
      : []
);

const isActivePolicy = (policy) => {
  if (policy?.isActive === true || policy?.is_active === true) return true;
  return ACTIVE_STATUS.has(policy?.status || policy?.contractStatus || '');
};

const normalizeComparison = (row) => {
  const current = toNumber(row.selfCoverageAmount ?? row.self_coverage_amount);
  const average = toNumber(row.avgGroupCoverageAmount ?? row.avg_group_coverage_amount);
  const diff = current - average;
  const hasAverage = average > 0;
  const status = current <= 0
    ? 'MISSING'
    : !hasAverage
      ? 'UNKNOWN'
      : diff >= 0 ? 'GOOD' : 'LOW';
  const percent = hasAverage
    ? Math.min((current / average) * 100, 100)
    : current > 0 ? 100 : 0;

  return {
    id: row.id,
    coverageName: row.coverageName || row.coverage_name || '보장명 정보 없음',
    coverageCode: row.coverageCode || row.coverage_code,
    current,
    average,
    diff,
    status,
    percent,
    hasAverage,
  };
};

const calculateComparisonScore = (items) => {
  const comparable = items.filter((item) => item.hasAverage);
  if (!comparable.length) return 0;
  const total = comparable.reduce((sum, item) => sum + item.percent, 0);
  return Math.round(total / comparable.length);
};

const InsurancePlan = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [coverageComparisons, setCoverageComparisons] = useState([]);
  const [userAge, setUserAge] = useState(null);
  const [peerPremium, setPeerPremium] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlanData = async () => {
      setLoading(true);
      setError('');
      try {
        const [policyRows, comparisonRows, healthAge] = await Promise.all([
          insuranceAPI.getPolicies(),
          insuranceAPI.getCoverageComparison(),
          healthAPI.getHealthAge().catch(() => null),
        ]);
        const resolvedAge = healthAge?.chronologicalAge ?? healthAge?.age ?? null;
        setPolicies(Array.isArray(policyRows) ? policyRows : []);
        setCoverageComparisons(Array.isArray(comparisonRows) ? comparisonRows : []);
        setUserAge(resolvedAge);
        try {
          setPeerPremium(await insuranceAPI.getPeerPremiumBenchmark({ age: resolvedAge }));
        } catch (benchmarkError) {
          console.warn('Peer premium benchmark not available:', benchmarkError?.message);
          setPeerPremium(null);
        }
      } catch (err) {
        console.error('Failed to fetch insurance plan data:', err);
        setPolicies([]);
        setCoverageComparisons([]);
        setPeerPremium(null);
        setError('보험 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchPlanData();
  }, []);

  const activePolicies = policies.filter(isActivePolicy);
  const coverageItems = activePolicies.flatMap(getCoverageItems);
  const comparisonItems = coverageComparisons
    .map(normalizeComparison)
    .sort((a, b) => {
      if (a.status !== b.status) {
        const order = { MISSING: 0, LOW: 1, UNKNOWN: 2, GOOD: 3 };
        return order[a.status] - order[b.status];
      }
      return Math.abs(b.diff) - Math.abs(a.diff);
    });
  const coverageScore = calculateComparisonScore(comparisonItems);
  const gapCount = comparisonItems.filter((item) => item.status === 'MISSING' || item.status === 'LOW').length;
  const missingCount = comparisonItems.filter((item) => item.status === 'MISSING').length;
  const monthlyPremium = activePolicies.reduce((sum, policy) => (
    sum + toNumber(policy.monthlyPremium ?? policy.monthly_premium)
  ), 0);
  const peerAverage = toNumber(peerPremium?.averageMonthlyPremium ?? peerPremium?.average_monthly_premium);
  const peerDiff = toNumber(peerPremium?.difference);
  const peerPercent = peerPremium?.percentage != null
    ? Number(peerPremium.percentage)
    : peerAverage > 0 && monthlyPremium > 0
      ? Math.round((monthlyPremium / peerAverage) * 100)
      : 0;
  const peerBarWidth = Math.min(peerPercent || 0, 135);
  const peerStatus = peerPremium?.status || (monthlyPremium <= 0 || peerAverage <= 0
    ? '확인 필요'
    : monthlyPremium - peerAverage > 0
      ? '또래보다 높음'
      : '또래보다 낮음');
  const peerLabel = peerPremium?.ageGroupLabel || peerPremium?.age_group_label || '-';
  const peerAgeLabel = userAge
    ? `만 ${userAge}세 · ${peerLabel}`
    : peerLabel !== '-' ? `${peerLabel} 기준` : '연령 정보 없음';
  const peerStatusClass = peerStatus === '또래보다 높음'
    ? 'mc-tag-warning'
    : peerStatus === '또래보다 낮음'
      ? 'mc-tag-success'
      : 'mc-tag-neutral';

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">보장 공백 점검</div>
          <div className="mc-page-subtitle">
            현재 조회된 보험 내역을 평균그룹 보장금액과 비교해 핵심 보장 공백을 점검합니다.
          </div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn" onClick={() => navigate('/chat?query=내 보험 보장 점검')}>
            <Ic d={P.chat} size={12}/> AI에게 물어보기
          </button>
        </div>
      </div>

      <MobileNavMenu />

      <div className="mc-insurance-overview-grid">
        <div className="mc-card mc-card-body mc-insurance-score-card">
          <div>
            <div className="mc-insurance-score-label">
              <Ic d={P.shield} size={12}/> 핵심 보장 점수
            </div>
            <div className="mc-insurance-score-value">
              {coverageScore}
              <span>/ 100</span>
            </div>
            <div className="mc-insurance-score-sub">
              평균그룹 비교 항목 기준
            </div>
          </div>
          <div>
            <div className="mc-pbar mc-insurance-score-bar">
              <div className="mc-pbar-fill" style={{ width: `${coverageScore}%` }}/>
            </div>
            <div className="mc-insurance-score-foot">
              <span>확인 필요</span>
              <strong>{gapCount}개</strong>
            </div>
          </div>
        </div>

        <div className="mc-card mc-card-body mc-insurance-metric-card">
          <div className="mc-field-label">분석 대상 보장</div>
          <div className="mc-stat-value">
            {coverageItems.length}건
          </div>
          <div className="mc-stat-sub">활성 보험 {activePolicies.length}건 기준</div>
        </div>
        <div className="mc-card mc-card-body mc-insurance-metric-card">
          <div className="mc-field-label">미확인 공백</div>
          <div className="mc-stat-value">
            {missingCount}개
          </div>
          <div className="mc-stat-sub">통계 비교 항목 중 미확인</div>
        </div>
        <div className="mc-card mc-card-body mc-insurance-metric-card mc-insurance-premium-card">
          <div className="mc-field-label">월 보험료 합계</div>
          <div className="mc-stat-value mc-insurance-premium-value">
            {monthlyPremium > 0 ? formatWon(monthlyPremium) : '정보 없음'}
          </div>
          <div className="mc-stat-sub">일시납/보험료 미제공 계약은 합계에서 제외</div>
        </div>
        <div className="mc-card mc-card-body mc-peer-premium-card">
          <div className="mc-row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div className="mc-field-label">또래 평균 보험료</div>
              <div className="mc-peer-premium-age">
                {peerAgeLabel}
              </div>
            </div>
            <span className={`mc-tag ${peerStatusClass}`}>
              {peerStatus}
            </span>
          </div>
          <div className="mc-peer-premium-main">
            <span>{peerAverage > 0 ? formatWon(peerAverage) : '정보 없음'}</span>
            {peerAverage > 0 && monthlyPremium > 0 && (
              <small>
                내 보험료 {peerDiff >= 0 ? '+' : '-'}{formatWon(Math.abs(peerDiff))}
              </small>
            )}
          </div>
          <div className="mc-peer-premium-scale" aria-hidden="true">
            <div className="mc-peer-premium-fill" style={{ width: `${peerBarWidth}%` }} />
            <i style={{ left: '100%' }} />
          </div>
        </div>
      </div>

      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">보장 평균그룹 비교 · {comparisonItems.length}건</span>
      </div>

      {!loading && !error && activePolicies.length > 0 && (
        <div className="mc-stack-sm">
          {comparisonItems.map((item) => {
            const statusInfo = GAP_STATUS[item.status];
            return (
              <div key={item.id || item.coverageCode || item.coverageName} className="mc-card mc-card-body mc-gap-compare-card">
                <div className="mc-row-between" style={{ marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
                      {item.coverageName}
                    </div>
                    {item.coverageCode && (
                      <div className="mc-card-sub" style={{ marginTop: 3 }}>
                        보장코드 {item.coverageCode}
                      </div>
                    )}
                  </div>
                  <span className={`mc-tag ${statusInfo.tag}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="mc-pbar" style={{ height: 10 }}>
                  <div
                    className={`mc-pbar-fill ${statusInfo.bar}`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <div className="mc-row-between" style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <div className="mc-card-sub">
                    내 보장 <strong style={{ color: 'var(--text-1)' }}>{formatWon(item.current)}</strong>
                    <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>→</span>
                    평균그룹{' '}
                    <strong style={{ color: 'var(--blue)' }}>
                      {item.hasAverage ? formatWon(item.average) : '데이터 없음'}
                    </strong>
                  </div>
                  {item.hasAverage && (
                    <div style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: item.diff >= 0 ? '#2E7D32' : '#8A7040',
                      whiteSpace: 'nowrap',
                    }}>
                      {Math.round((item.current / item.average) * 100)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && activePolicies.length > 0 && comparisonItems.length === 0 && (
        <div className="mc-card mc-card-body" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>
            보장 비교 통계가 없습니다.
          </div>
          <div className="mc-card-sub" style={{ marginTop: 8 }}>
            보험을 다시 동기화하면 평균그룹 통계를 불러와 비교할 수 있습니다.
          </div>
        </div>
      )}

      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">분석 대상 보험 · {activePolicies.length}건</span>
      </div>

      {loading && (
        <div className="mc-alert mc-alert-blue">
          <Ic d={P.sync} size={15}/>
          <div>
            <div className="mc-alert-title">보험 정보를 불러오는 중입니다</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="mc-alert mc-alert-warning">
          <div>
            <div className="mc-alert-title">보험 정보 조회 실패</div>
            <div className="mc-alert-body">{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && activePolicies.length === 0 && (
        <div className="mc-card mc-card-body" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>
            분석할 수 있는 활성 보험이 없습니다.
          </div>
          <div className="mc-card-sub" style={{ marginTop: 8 }}>
            보험 조회에서 계약을 먼저 동기화하면 보장 공백을 점검할 수 있습니다.
          </div>
        </div>
      )}

      {!loading && !error && activePolicies.length > 0 && (
        <div className="mc-stack-sm">
          {activePolicies.map((policy) => {
            const items = getCoverageItems(policy);
            const typeLabel = POLICY_TYPE_LABEL[policy.policyType] || policy.policyType || '보험';
            const premium = toNumber(policy.monthlyPremium ?? policy.monthly_premium);
            return (
              <div key={policy.id || policy.policyNumber} className="mc-card">
                <div className="mc-card-head">
                  <div>
                    <div className="mc-card-title">{policy.productName || policy.policy_details || '보험명 정보 없음'}</div>
                    <div className="mc-card-sub">
                      {policy.companyName || policy.insurer_name || '보험사 정보 없음'} · {typeLabel}
                    </div>
                  </div>
                  <span className="mc-tag mc-tag-success">분석 대상</span>
                </div>
                <div className="mc-card-body">
                  <div className="mc-grid-3">
                    <div>
                      <div className="mc-field-label">보장 항목</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{items.length}건</div>
                    </div>
                    <div>
                      <div className="mc-field-label">월 보험료</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                        {premium > 0 ? formatWon(premium) : '정보 없음'}
                      </div>
                    </div>
                    <div>
                      <div className="mc-field-label">최대 보장금액</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                        {formatCompactWon(Math.max(0, ...items.map((item) => toNumber(item.amount ?? item.max_benefit_amount))))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && activePolicies.length > 0 && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">분석 기준</div>
            <div className="mc-alert-body">
              이 결과는 현재 조회된 보험 데이터와 평균그룹 보장금액을 비교한 참고용 점검입니다. 평균 데이터가 없는 항목은 별도로 표시하며, 실제 가입 권유나 상품 추천은 포함하지 않습니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsurancePlan;
