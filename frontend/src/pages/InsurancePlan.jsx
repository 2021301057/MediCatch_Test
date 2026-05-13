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

const COVERAGE_STANDARDS = [
  {
    key: 'actualLoss',
    label: '실손의료비',
    group: 'core',
    type: 'presence',
    aggregation: 'presence',
    weight: 25,
    fallbackComparison: 1,
    description: '실손형 계약 또는 실손의료비 담보 보유 여부를 확인합니다.',
  },
  {
    key: 'generalCancerDiagnosis',
    label: '일반암 진단비',
    group: 'core',
    type: 'amount',
    aggregation: 'sum',
    weight: 20,
    description: '일반 암진단 담보를 중심으로 집계하고 평균그룹 보장금액과 비교합니다. 유사암/고액암/특정암은 참고 항목으로 분리합니다.',
  },
  {
    key: 'cerebrovascular',
    label: '뇌혈관질환 진단비',
    group: 'core',
    type: 'amount',
    aggregation: 'sum',
    weight: 15,
    description: '뇌혈관질환 진단 관련 담보를 평균그룹 보장금액과 비교합니다.',
  },
  {
    key: 'ischemicHeart',
    label: '허혈성심장질환 진단비',
    group: 'core',
    type: 'amount',
    aggregation: 'sum',
    weight: 15,
    description: '허혈성심장질환 진단 관련 담보를 평균그룹 보장금액과 비교합니다.',
  },
  {
    key: 'diseaseHospitalDaily',
    label: '질병입원일당',
    group: 'core',
    type: 'amount',
    aggregation: 'sum',
    weight: 10,
    description: '일반 질병입원일당 담보만 집계하고 평균그룹 보장금액과 비교합니다. 암/상해/중환자실 입원일당은 참고 항목입니다.',
  },
  {
    key: 'diseaseSurgery',
    label: '질병수술비',
    group: 'core',
    type: 'amount',
    aggregation: 'sum',
    weight: 15,
    description: '일반 질병수술비 담보를 중심으로 평균그룹 보장금액과 비교합니다. 암/상해/특정질병/기타수술은 참고 항목입니다.',
  },
  {
    key: 'specialCancerDiagnosis',
    label: '암 특화 진단비',
    group: 'reference',
    type: 'amount',
    aggregation: 'sum',
    description: '유사암, 고액암, 특정암처럼 일반암과 성격이 다른 진단 담보입니다.',
  },
  {
    key: 'specialHospitalDaily',
    label: '특수 입원일당',
    group: 'reference',
    type: 'amount',
    aggregation: 'sum',
    description: '암/상해/중환자실/특정질병 입원일당처럼 조건이 다른 입원 담보입니다.',
  },
  {
    key: 'specialSurgery',
    label: '특수 수술비',
    group: 'reference',
    type: 'amount',
    aggregation: 'sum',
    description: '암/상해/특정질병/기타수술처럼 조건이 다른 수술 담보입니다.',
  },
  {
    key: 'deathDisability',
    label: '사망·후유장해',
    group: 'reference',
    type: 'amount',
    aggregation: 'sum',
    description: '사망 및 후유장해 담보입니다. 건강 보장 점수에는 반영하지 않고 참고로만 표시합니다.',
  },
];

const COVERAGE_RULES = [
  {
    key: 'actualLoss',
    include: ['실손', '의료비'],
    exclude: ['가족생활배상책임', '배상책임'],
  },
  {
    key: 'cerebrovascular',
    include: ['뇌혈관'],
  },
  {
    key: 'ischemicHeart',
    include: ['허혈성심장', '급성심근경색', '심혈관'],
  },
  {
    key: 'specialCancerDiagnosis',
    include: ['고액암진단', '유사암진단', '소액암진단', '특정암진단', '고액암 진단', '유사암 진단'],
    exclude: ['수술', '입원', '통원', '항암', '방사선', '치료'],
  },
  {
    key: 'generalCancerDiagnosis',
    include: ['암진단', '암 진단'],
    exclude: ['수술', '입원', '통원', '항암', '방사선', '치료'],
  },
  {
    key: 'specialHospitalDaily',
    include: ['암입원일당', '상해입원일당', '중환자실입원일당', '특정질병입원일당', '암 입원일당', '상해 입원일당', '중환자실 입원일당'],
    exclude: ['수술'],
  },
  {
    key: 'diseaseHospitalDaily',
    include: ['질병입원일당', '질병 입원일당', '질병입원비'],
    exclude: ['수술', '중환자실', '특정질병', '암', '상해'],
  },
  {
    key: 'specialSurgery',
    include: ['암수술', '상해수술', '특정질병수술', '기타수술', '특정암수술', '질병종수술', '암 수술', '상해 수술'],
  },
  {
    key: 'diseaseSurgery',
    include: ['질병수술', '질병 수술', '질병입원수술', '질병 입원 수술'],
    exclude: ['특정질병', '종수술', '암', '상해', '기타'],
  },
  {
    key: 'deathDisability',
    include: ['사망', '후유장해', '후유 장애'],
  },
];

const GAP_STATUS = {
  GOOD: { label: '기준 이상 확인', tag: 'mc-tag-success', bar: 'success' },
  LOW: { label: '평균보다 낮음', tag: 'mc-tag-warning', bar: 'warning' },
  MISSING: { label: '확인되지 않음', tag: 'mc-tag-danger', bar: 'danger' },
  UNKNOWN: { label: '평균 데이터 없음', tag: 'mc-tag-neutral', bar: 'blue' },
  REFERENCE: { label: '참고', tag: 'mc-tag-blue', bar: 'blue' },
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

const normalizeText = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();

const getCoverageText = (item) => normalizeText([
  item?.name,
  item?.itemName,
  item?.agreementType,
  item?.conditions,
  item?.category,
].filter(Boolean).join(' '));

const matchesRule = (text, rule) => {
  const hasIncludedWord = rule.include.some((word) => text.includes(normalizeText(word)));
  const hasExcludedWord = (rule.exclude || []).some((word) => text.includes(normalizeText(word)));
  return hasIncludedWord && !hasExcludedWord;
};

const getCoverageKey = (item) => {
  const text = getCoverageText(item);
  const rule = COVERAGE_RULES.find((candidate) => matchesRule(text, candidate));
  return rule?.key || null;
};

const getAvgGroupCoverageAmount = (item) => toNumber(
  item?.avgGroupCoverageAmount ?? item?.avg_group_coverage_amount
);

const analyzeCoverageGaps = (policies) => {
  const activePolicies = policies.filter(isActivePolicy);
  const totals = COVERAGE_STANDARDS.reduce((acc, standard) => ({
    ...acc,
    [standard.key]: {
      current: 0,
      comparison: 0,
      matchedItems: [],
      hasCoverage: false,
      hasAverageData: standard.type === 'presence',
    },
  }), {});

  activePolicies.forEach((policy) => {
    const items = getCoverageItems(policy);
    const hasSupplementaryPolicy = policy.policyType === 'SUPPLEMENTARY' || policy.hasSupplementaryCoverage;

    if (hasSupplementaryPolicy) {
      totals.actualLoss.hasCoverage = true;
    }

    items.forEach((item) => {
      const key = getCoverageKey(item);
      if (!key || !totals[key]) return;

      const amount = toNumber(item.amount ?? item.max_benefit_amount);
      const avgGroupAmount = getAvgGroupCoverageAmount(item);
      totals[key].current += amount;
      if (avgGroupAmount > 0) {
        totals[key].comparison += avgGroupAmount;
        totals[key].hasAverageData = true;
      }
      totals[key].hasCoverage = true;
      totals[key].matchedItems.push({
        name: item.name || item.itemName || '보장명 정보 없음',
        amount,
        avgGroupAmount,
        policyName: policy.productName || policy.policy_details || '보험명 정보 없음',
      });
    });
  });

  return COVERAGE_STANDARDS.map((standard) => {
    const current = standard.type === 'presence'
      ? (totals[standard.key].hasCoverage ? 1 : 0)
      : totals[standard.key].current;
    const comparison = standard.type === 'presence'
      ? (standard.fallbackComparison || 1)
      : totals[standard.key].comparison;
    const hasComparison = standard.type === 'presence' || totals[standard.key].hasAverageData;
    const gap = hasComparison ? Math.max(comparison - current, 0) : 0;
    const status = standard.group === 'reference'
      ? 'REFERENCE'
      : current <= 0
        ? 'MISSING'
        : !hasComparison
          ? 'UNKNOWN'
          : gap > 0
            ? 'LOW'
            : 'GOOD';
    const percent = standard.type === 'presence'
      ? (current ? 100 : 0)
      : hasComparison && comparison > 0
        ? Math.min((current / comparison) * 100, 100)
        : current > 0 ? 100 : 0;

    return {
      ...standard,
      current,
      comparison,
      gap,
      status,
      percent,
      matchedItems: totals[standard.key].matchedItems,
      hasCoverage: totals[standard.key].hasCoverage,
      hasComparison,
    };
  });
};

const calculateCoverageScore = (gaps) => {
  const coreGaps = gaps.filter((gap) => (
    gap.group === 'core' && (gap.type === 'presence' || gap.hasComparison || gap.status === 'MISSING')
  ));
  const totalWeight = coreGaps.reduce((sum, gap) => sum + (gap.weight || 0), 0);
  if (!totalWeight) return 0;

  const weightedScore = coreGaps.reduce((sum, gap) => (
    sum + (gap.percent * (gap.weight || 0))
  ), 0);

  return Math.round(weightedScore / totalWeight);
};

const InsurancePlan = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPolicies = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await insuranceAPI.getPolicies();
        setPolicies(Array.isArray(rows) ? rows : []);
      } catch (err) {
        console.error('Failed to fetch policies:', err);
        setPolicies([]);
        setError('보험 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  const activePolicies = policies.filter(isActivePolicy);
  const coverageItems = activePolicies.flatMap(getCoverageItems);
  const coverageGaps = analyzeCoverageGaps(policies);
  const coreGaps = coverageGaps.filter((gap) => gap.group === 'core');
  const referenceGaps = coverageGaps.filter((gap) => gap.group === 'reference' && gap.hasCoverage);
  const coverageScore = calculateCoverageScore(coverageGaps);
  const gapCount = coreGaps.filter((gap) => gap.status !== 'GOOD').length;
  const missingCount = coreGaps.filter((gap) => gap.status === 'MISSING').length;
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
            평균 비교 가능 항목 기준 · 확인 필요 {gapCount}개
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
            <div className="mc-stat-sub">핵심 비교 항목 중 미확인</div>
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
        <span className="mc-sec-title">핵심 보장 공백 상세</span>
      </div>

      {!loading && !error && activePolicies.length > 0 && (
        <div className="mc-stack-sm">
          {coreGaps.map((gap) => {
            const statusInfo = GAP_STATUS[gap.status];
            const isPresence = gap.type === 'presence';
            return (
              <div key={gap.key} className="mc-card mc-card-body">
                <div className="mc-row-between" style={{ marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
                      {gap.label}
                    </div>
                    <div className="mc-card-sub" style={{ marginTop: 3 }}>
                      {gap.description}
                    </div>
                  </div>
                  <span className={`mc-tag ${statusInfo.tag}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="mc-pbar" style={{ height: 10 }}>
                  <div
                    className={`mc-pbar-fill ${statusInfo.bar}`}
                    style={{ width: `${gap.percent}%` }}
                  />
                </div>
                <div className="mc-row-between" style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <div className="mc-card-sub">
                    현재{' '}
                    <strong style={{ color: 'var(--text-1)' }}>
                      {isPresence ? (gap.hasCoverage ? '가입 확인' : '확인되지 않음') : formatWon(gap.current)}
                    </strong>
                    <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>→</span>
                    평균그룹{' '}
                    <strong style={{ color: 'var(--blue)' }}>
                      {isPresence
                        ? '가입 여부'
                        : gap.hasComparison ? formatWon(gap.comparison) : '데이터 없음'}
                    </strong>
                  </div>
                  {!isPresence && gap.gap > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#8A7040', whiteSpace: 'nowrap' }}>
                      평균 대비 차이 {formatWon(gap.gap)}
                    </div>
                  )}
                </div>
                {gap.matchedItems.length > 0 && (
                  <div className="mc-card-sub" style={{ marginTop: 8 }}>
                    확인된 담보: {gap.matchedItems.slice(0, 3).map((item) => item.name).join(', ')}
                    {gap.matchedItems.length > 3 ? ` 외 ${gap.matchedItems.length - 3}건` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && activePolicies.length > 0 && referenceGaps.length > 0 && (
        <>
          <div className="mc-sec-head" style={{ marginTop: 18 }}>
            <span className="mc-sec-title">참고 보장 항목</span>
          </div>
          <div className="mc-stack-sm">
            {referenceGaps.map((gap) => {
              const statusInfo = GAP_STATUS[gap.status];
              return (
                <div key={gap.key} className="mc-card mc-card-body">
                  <div className="mc-row-between" style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
                        {gap.label}
                      </div>
                      <div className="mc-card-sub" style={{ marginTop: 3 }}>
                        {gap.description}
                      </div>
                    </div>
                    <span className={`mc-tag ${statusInfo.tag}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="mc-card-sub">
                    확인 금액 <strong style={{ color: 'var(--text-1)' }}>{formatWon(gap.current)}</strong>
                    {gap.hasComparison && gap.comparison > 0 && (
                      <>
                        <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>·</span>
                        평균그룹 <strong style={{ color: 'var(--blue)' }}>{formatWon(gap.comparison)}</strong>
                      </>
                    )}
                  </div>
                  {gap.matchedItems.length > 0 && (
                    <div className="mc-card-sub" style={{ marginTop: 8 }}>
                      확인된 담보: {gap.matchedItems.slice(0, 3).map((item) => item.name).join(', ')}
                      {gap.matchedItems.length > 3 ? ` 외 ${gap.matchedItems.length - 3}건` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
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
