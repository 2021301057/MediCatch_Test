import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { insuranceAPI } from '../api/services';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlanData = async () => {
      setLoading(true);
      setError('');
      try {
        const [policyRows, comparisonRows] = await Promise.all([
          insuranceAPI.getPolicies(),
          insuranceAPI.getCoverageComparison(),
        ]);
        setPolicies(Array.isArray(policyRows) ? policyRows : []);
        setCoverageComparisons(Array.isArray(comparisonRows) ? comparisonRows : []);
      } catch (err) {
        console.error('Failed to fetch insurance plan data:', err);
        setPolicies([]);
        setCoverageComparisons([]);
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

      <div className="mc-two-col" style={{ gridTemplateColumns: '360px 1fr' }}>
        <div className="mc-card mc-card-body" style={{
          background: 'linear-gradient(135deg, #1E55C4 0%, #2F6FE8 100%)',
          color: '#fff', borderColor: 'transparent',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', opacity: 0.85,
          }}>
            <Ic d={P.shield} size={12}/> 핵심 보장 점수
          </div>
          <div style={{
            fontSize: 44, fontWeight: 800,
            marginTop: 8, lineHeight: 1,
          }}>
            {coverageScore}
            <span style={{ fontSize: 22, fontWeight: 600, marginLeft: 4 }}>/ 100</span>
          </div>
          <div style={{ fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>
            평균그룹 비교 항목 기준 · 확인 필요 {gapCount}개
          </div>
          <div className="mc-pbar" style={{ marginTop: 14, background: 'rgba(255,255,255,0.2)' }}>
            <div className="mc-pbar-fill" style={{ width: `${coverageScore}%`, background: '#fff' }}/>
          </div>
        </div>

        <div className="mc-grid-2">
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">분석 대상 보장</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>
              {coverageItems.length}건
            </div>
            <div className="mc-stat-sub">활성 보험 {activePolicies.length}건 기준</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">미확인 공백</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>
              {missingCount}개
            </div>
            <div className="mc-stat-sub">통계 비교 항목 중 미확인</div>
          </div>
          <div className="mc-card mc-card-body mc-card-accent-blue" style={{ gridColumn: 'span 2' }}>
            <div className="mc-field-label">월 보험료 합계</div>
            <div className="mc-stat-value" style={{ marginTop: 4, color: 'var(--blue)' }}>
              {monthlyPremium > 0 ? formatWon(monthlyPremium) : '정보 없음'}
            </div>
            <div className="mc-stat-sub">일시납/보험료 미제공 계약은 합계에서 제외</div>
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
              <div key={item.id || item.coverageCode || item.coverageName} className="mc-card mc-card-body">
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
                      {item.diff >= 0 ? '+' : '-'}{formatWon(Math.abs(item.diff))}
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
            보험을 다시 동기화하면 CODEF 평균그룹 통계를 불러와 비교할 수 있습니다.
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
              이 결과는 현재 조회된 보험 데이터와 CODEF 평균그룹 보장금액을 비교한 참고용 점검입니다. 평균 데이터가 없는 항목은 별도로 표시하며, 실제 가입 권유나 상품 추천은 포함하지 않습니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsurancePlan;
