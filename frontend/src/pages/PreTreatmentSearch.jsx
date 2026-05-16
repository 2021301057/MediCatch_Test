import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}
  >
    {d}
  </svg>
);

const P = {
  search: (<><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></>),
  chat: (<><path d="M2 2h12v9H9l-3 3v-3H2V2z" /><path d="M5 6h6M5 8.5h4" /></>),
  close: (<path d="M4 4l8 8M12 4l-8 8" />),
};

const QUICK_SEARCHES = ['암', '골절', '입원', '수술', '도수치료', 'MRI', '치과', '한방', '한약'];

const CARE_TYPE_LABELS = {
  DIAGNOSIS: '진단',
  OUTPATIENT: '통원',
  INPATIENT: '입원',
  SURGERY: '수술',
  TEST: '검사',
  MEDICATION: '약제',
  UNKNOWN: '확인 필요',
};

const BENEFIT_TYPE_LABELS = {
  COVERED: '급여',
  NON_COVERED: '비급여',
  MIXED: '급여/비급여 확인',
  UNKNOWN: '확인 필요',
};

const INJURY_DISEASE_LABELS = {
  INJURY: '상해',
  DISEASE: '질병',
  UNKNOWN: '확인 필요',
};

const DEDUCTIBLE_LABELS = {
  FIXED_ONLY: '정액 공제',
  MAX_FIXED_OR_RATE: '정액/비율 중 큰 금액 공제',
  EXCLUDED: '보상 제외',
};

const formatWon = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0원';
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(amount))}원`;
};

const labelOf = (map, value) => map[value] || value || '확인 필요';

const actualLossConditionLabel = (rule) => {
  switch (rule.actualLossCategory) {
    case 'DENTAL_INJURY':
      return '치과 상해';
    case 'DENTAL_DISEASE':
      return '치과 질병';
    case 'KOREAN_MEDICINE_COVERED':
      return '한방 급여';
    case 'KOREAN_MEDICINE':
      return '한방 비급여';
    case 'KOREAN_MEDICINE_CHUNA':
      return '추나요법';
    case 'KOREAN_MEDICINE_HERBAL':
      return '한약';
    case 'NON_COVERED_THREE':
      return '비급여 3종';
    case 'GENERAL_OUTPATIENT':
      return labelOf(BENEFIT_TYPE_LABELS, rule.benefitType);
    default:
      return labelOf(BENEFIT_TYPE_LABELS, rule.benefitType);
  }
};

const MATCH_SOURCE_LABELS = {
  DB_RULE: 'DB 룰 기준',
  AI_CLASSIFICATION: 'AI 분류 기준',
  HEURISTIC: '휴리스틱 분류',
  NONE: '매칭 없음',
};

const userResultMessage = (result) => {
  if (!result) return '';
  if (!result.matched) return result.message || '아직 등록된 기준으로는 바로 확인하기 어려운 검색어입니다.';
  if (result.actualLoss?.applicable && result.fixedBenefits?.applicable) {
    return '실손 보장과 정액형 담보를 함께 확인했습니다.';
  }
  if (result.actualLoss?.applicable) {
    return '내 실손 세대 기준으로 적용 가능한 조건을 확인했습니다.';
  }
  if (result.fixedBenefits?.applicable) {
    return '내 보험의 정액형 담보와 비교했습니다.';
  }
  return '검색어의 보장 기준을 확인했습니다.';
};

const actualLossReasonText = (actualLoss) => {
  if (!actualLoss?.applicable) return '이 검색어는 실손보다 정액형 담보 확인이 더 중심입니다.';
  if (!actualLoss?.ownedPolicies?.length) return '현재 조회된 보험에서는 실손 담보가 확인되지 않았습니다.';
  if (!actualLoss?.selectedRules?.length) return '내 실손 세대에 바로 적용할 수 있는 세부 기준은 아직 없습니다.';
  return '조건을 선택하면 해당 경우의 실손 기준만 볼 수 있습니다.';
};

const normalizeText = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();

const actualLossCoverageMatchesRule = (item, rule) => {
  const target = normalizeText(`${item.name || ''} ${item.category || ''} ${item.agreementType || ''}`);

  if (rule.actualLossCategory === 'DENTAL_INJURY' && !target.includes('상해')) return false;
  if (rule.actualLossCategory === 'DENTAL_DISEASE' && !target.includes('질병')) return false;

  if (rule.careType === 'INPATIENT') {
    return target.includes('입원');
  }
  if (['OUTPATIENT', 'TEST', 'MEDICATION'].includes(rule.careType)) {
    return target.includes('통원') || target.includes('외래') || !target.includes('입원');
  }
  return true;
};

const calculateActualLossPayment = (cost, rule, coverageLimit) => {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  if (rule.isExcluded || rule.deductibleMethod === 'EXCLUDED') {
    return {
      excluded: true,
      deduction: cost,
      rawPayment: 0,
      finalPayment: 0,
      patientPayment: cost,
      appliedLimit: 0,
    };
  }

  const fixedDeductible = Number(rule.fixedDeductible || 0);
  const rateDeductible = cost * (Number(rule.patientCopayRate || 0) / 100);
  const deduction = rule.deductibleMethod === 'MAX_FIXED_OR_RATE'
    ? Math.max(fixedDeductible, rateDeductible)
    : fixedDeductible;
  const rawPayment = Math.max(0, cost - deduction);
  const caps = [Number(rule.limitAmount || 0), Number(coverageLimit || 0)]
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const appliedLimit = caps.length > 0 ? Math.min(...caps) : null;
  const finalPayment = appliedLimit ? Math.min(rawPayment, appliedLimit) : rawPayment;

  return {
    excluded: false,
    deduction,
    rawPayment,
    finalPayment,
    patientPayment: Math.max(0, cost - finalPayment),
    appliedLimit,
  };
};

const tagStyle = (tone) => ({
  display: 'inline-flex',
  alignItems: 'center',
  height: 24,
  padding: '0 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  background: tone === 'good' ? '#E4F0EA' : tone === 'warn' ? '#F4EFDE' : 'var(--blue-soft)',
  color: tone === 'good' ? '#3A7A62' : tone === 'warn' ? '#8A7040' : 'var(--blue)',
  border: `1px solid ${tone === 'good' ? '#BED4C7' : tone === 'warn' ? '#E6DCB6' : '#D8E4FB'}`,
});

function SummaryTags({ result }) {
  const classification = result?.classification;
  if (!classification) return null;

  return (
    <div className="mc-row-wrap" style={{ marginTop: 12 }}>
      <span style={tagStyle('good')}>{labelOf(INJURY_DISEASE_LABELS, classification.injuryDiseaseType)}</span>
      <span style={tagStyle('info')}>{labelOf(CARE_TYPE_LABELS, classification.careType)}</span>
      <span style={tagStyle('warn')}>{labelOf(BENEFIT_TYPE_LABELS, classification.benefitType)}</span>
      <span style={tagStyle('info')}>{result.confidence === 'HIGH' ? '높은 일치도' : result.confidence === 'MEDIUM' ? '보통 일치도' : '확인 필요'}</span>
    </div>
  );
}

function FixedBenefitSection({ fixedBenefits }) {
  const groups = fixedBenefits?.ownedGroups || [];
  if (!fixedBenefits?.applicable) return null;

  return (
    <div className="mc-card mc-section-tight">
      <div className="mc-card-head">
        <div>
          <div className="mc-card-title">정액형 담보</div>
          <div className="mc-card-sub">내 보험의 보장 항목과 담보명을 기준으로 확인합니다.</div>
        </div>
      </div>
      <div className="mc-card-body">
        <div className="mc-stack-sm">
          {groups.map((group) => (
            <div key={group.category} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div className="mc-row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div className="mc-list-name">{group.displayName}</div>
                  <div className="mc-list-sub">
                    {group.owned ? `${group.matchedItemCount}건 확인` : '보유 담보 없음'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: group.owned ? 'var(--blue)' : 'var(--text-3)' }}>
                    {formatWon(group.totalCoverageAmount)}
                  </div>
                  <div className="mc-list-sub">{group.owned ? '총 보장금액' : '미확인'}</div>
                </div>
              </div>

              {group.matchedItems?.length > 0 && (
                <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                  {group.matchedItems.slice(0, 4).map((item, index) => (
                    <div key={`${group.category}-${item.policyId}-${item.itemName}-${index}`} className="mc-kv">
                      <span className="mc-kv-key">{item.itemName}</span>
                      <span className="mc-kv-val">{formatWon(item.coverageAmount)}</span>
                    </div>
                  ))}
                  {group.matchedItems.length > 4 && (
                    <div className="mc-list-sub">외 {group.matchedItems.length - 4}건</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActualLossRuleRow({ rule }) {
  const excluded = rule.isExcluded;
  return (
    <div className="mc-kv" style={{ alignItems: 'flex-start', gap: 14 }}>
      <span className="mc-kv-key" style={{ minWidth: 92 }}>
        {actualLossConditionLabel(rule)}
      </span>
      <span className="mc-kv-val" style={{ textAlign: 'right' }}>
        <span>
          {excluded
            ? '보상 제외'
            : `${labelOf(DEDUCTIBLE_LABELS, rule.deductibleMethod)} · 보장 ${rule.reimbursementRate || 0}% · 자기부담 ${rule.patientCopayRate || 0}%`}
          {rule.fixedDeductible ? ` · 공제 ${formatWon(rule.fixedDeductible)}` : ''}
          {rule.limitAmount ? ` · 한도 ${formatWon(rule.limitAmount)}` : ''}
          {rule.limitCount ? ` · ${rule.limitCount}회` : ''}
          {rule.requiresRider ? ' · 특약 확인' : ''}
        </span>
        {rule.note && (
          <span className="mc-list-sub" style={{ display: 'block', marginTop: 4 }}>
            {rule.note}
          </span>
        )}
      </span>
    </div>
  );
}

function ActualLossSection({ actualLoss }) {
  const policies = actualLoss?.ownedPolicies || [];
  const rules = actualLoss?.selectedRules || [];
  const [selectedCondition, setSelectedCondition] = useState('');
  const [treatmentCost, setTreatmentCost] = useState('');
  const conditionOptions = useMemo(() => (
    Array.from(new Set(rules.map(actualLossConditionLabel)))
  ), [rules]);
  const activeCondition = conditionOptions.includes(selectedCondition)
    ? selectedCondition
    : conditionOptions[0];
  const visibleRules = activeCondition
    ? rules.filter((rule) => actualLossConditionLabel(rule) === activeCondition)
    : rules;
  const relevantCoverageItems = useMemo(() => (
    policies.flatMap((policy) => (
      (policy.matchedCoverageItems || [])
        .filter((item) => visibleRules.some((rule) => (
          policy.estimatedGenerationCode === rule.generationCode && actualLossCoverageMatchesRule(item, rule)
        )))
        .map((item) => ({ ...item, policyId: policy.policyId, policyName: policy.policyName }))
    ))
  ), [policies, visibleRules]);
  const coverageLimit = relevantCoverageItems
    .map((item) => Number(item.amount || 0))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
    .sort((a, b) => b - a)[0] || null;
  const treatmentCostAmount = Number(String(treatmentCost).replaceAll(',', ''));
  const payableRules = visibleRules.filter((rule) => !rule.isExcluded && rule.deductibleMethod !== 'EXCLUDED');
  const calculationRule = payableRules[0];
  const calculation = calculationRule
    ? calculateActualLossPayment(treatmentCostAmount, calculationRule, coverageLimit)
    : null;

  return (
    <div className="mc-card mc-section-tight">
      <div className="mc-card-head">
        <div>
          <div className="mc-card-title">실손 확인</div>
          <div className="mc-card-sub">{actualLossReasonText(actualLoss)}</div>
        </div>
      </div>
      <div className="mc-card-body">
        {policies.length === 0 ? (
          <div className="mc-alert mc-alert-blue">
            <div>
              <div className="mc-alert-title">확인된 실손 담보 없음</div>
              <div className="mc-alert-body">현재 조회된 보험 기준으로 실손 담보가 확인되지 않았습니다.</div>
            </div>
          </div>
        ) : (
          <div className="mc-stack-sm">
            {policies.map((policy) => (
              <div key={policy.policyId} className="mc-list-row" style={{ alignItems: 'flex-start' }}>
                <div className="mc-list-info">
                  <div className="mc-list-name">{policy.policyName}</div>
                  <div className="mc-list-sub">
                    {policy.insurerName} · {policy.generationLabel || '세대 확인 필요'}
                  </div>
                  {policy.matchedCoverageNames?.length > 0 && (
                    <div className="mc-list-sub" style={{ marginTop: 4 }}>
                      확인 담보: {policy.matchedCoverageNames.slice(0, 3).join(', ')}
                      {policy.matchedCoverageNames.length > 3 ? ` 외 ${policy.matchedCoverageNames.length - 3}건` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {rules.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {conditionOptions.length > 1 && (
              <div className="mc-row-wrap" style={{ marginBottom: 10 }}>
                {conditionOptions.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    className="mc-chip"
                    onClick={() => setSelectedCondition(condition)}
                    style={activeCondition === condition ? { background: 'var(--blue-soft)', borderColor: '#D8E4FB', color: 'var(--blue)' } : undefined}
                  >
                    {condition}
                  </button>
                ))}
              </div>
            )}
            <div className="mc-stack-xs">
            {visibleRules.map((rule, index) => (
              <ActualLossRuleRow key={`${rule.generationCode}-${rule.actualLossCategory}-${index}`} rule={rule} />
            ))}
            </div>
            {payableRules.length > 0 ? (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div className="mc-field-label" style={{ marginBottom: 8 }}>예상 치료비</div>
                <input
                  className="mc-input"
                  inputMode="numeric"
                  placeholder="예: 200000"
                  value={treatmentCost}
                  onChange={(event) => setTreatmentCost(event.target.value.replace(/[^\d,]/g, ''))}
                />
                <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                  <div className="mc-kv">
                    <span className="mc-kv-key">적용 담보 한도</span>
                    <span className="mc-kv-val">{coverageLimit ? formatWon(coverageLimit) : '확인 필요'}</span>
                  </div>
                  {calculation && (
                    <>
                      <div className="mc-kv">
                        <span className="mc-kv-key">공제 예상</span>
                        <span className="mc-kv-val">{formatWon(calculation.deduction)}</span>
                      </div>
                      <div className="mc-kv">
                        <span className="mc-kv-key">예상 보험금</span>
                        <span className="mc-kv-val">{formatWon(calculation.finalPayment)}</span>
                      </div>
                      <div className="mc-kv">
                        <span className="mc-kv-key">예상 본인부담</span>
                        <span className="mc-kv-val">{formatWon(calculation.patientPayment)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="mc-list-sub" style={{ marginTop: 8 }}>
                  실제 지급액은 영수증의 급여/비급여 구분, 약관, 특약 가입 여부, 연간 한도 사용액에 따라 달라질 수 있습니다.
                </div>
              </div>
            ) : (
              <div className="mc-alert mc-alert-blue" style={{ marginTop: 14 }}>
                <div>
                  <div className="mc-alert-title">예상 보험금 계산 제외</div>
                  <div className="mc-alert-body">선택한 조건은 현재 기준에서 보상 제외로 분류되어 치료비 입력 계산을 제공하지 않습니다.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreTreatmentSearch() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resultTitle = useMemo(() => {
    if (!result) return '검색 결과';
    if (!result.matched) return '확인 필요';
    return `${result.query} 보장 확인`;
  }, [result]);

  const runSearch = async (query = searchQuery) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('검색어를 입력해주세요.');
      return;
    }

    setSearchQuery(trimmed);
    setLoading(true);
    setError('');
    try {
      const response = await analysisAPI.searchPreTreatment({ query: trimmed });
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.message || '검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">진료 전 검색</div>
          <div className="mc-page-subtitle">병원 가기 전, 내 보험의 실손과 정액형 담보를 미리 확인하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn" onClick={() => navigate('/chat')}>
            <Ic d={P.chat} size={12} /> AI에게 물어보기
          </button>
        </div>
      </div>

      <div className="mc-card mc-card-body mc-section-tight">
        <div className="mc-input-with-icon">
          <span className="mc-input-icon"><Ic d={P.search} size={14} /></span>
          <input
            className="mc-input"
            placeholder="치료명이나 질환을 검색해주세요. 예: 암, 골절, 도수치료, MRI"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch();
            }}
          />
        </div>
        <div className="mc-row-between" style={{ marginTop: 14, alignItems: 'center', gap: 12 }}>
          <div className="mc-row-wrap">
            <span className="mc-chat-quick-label">자주 찾는 항목</span>
            {QUICK_SEARCHES.map((name) => (
              <button key={name} className="mc-chip" onClick={() => runSearch(name)}>
                {name}
              </button>
            ))}
          </div>
          <button className="mc-btn mc-btn-primary" onClick={() => runSearch()} disabled={loading}>
            <Ic d={P.search} size={12} /> {loading ? '검색 중' : '검색'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mc-alert mc-alert-blue mc-section-tight">
          <div>
            <div className="mc-alert-title">검색 실패</div>
            <div className="mc-alert-body">{error}</div>
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="mc-card mc-card-body">
          <div className="mc-list-row" style={{ color: 'var(--text-3)', justifyContent: 'center' }}>
            검색어를 입력하면 보장 확인 결과가 표시됩니다.
          </div>
        </div>
      )}

      {result && (
        <div className="mc-two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 360px' }}>
          <div className="mc-stack-sm">
            <div className="mc-card">
              <div className="mc-card-head">
                <div>
                  <div className="mc-card-title">{resultTitle}</div>
                  <div className="mc-card-sub">{userResultMessage(result)}</div>
                  <SummaryTags result={result} />
                </div>
                <button className="mc-sec-link" onClick={() => setResult(null)}>
                  닫기 <Ic d={P.close} size={10} />
                </button>
              </div>
              {result.classification?.cautionMessage && (
                <div className="mc-card-body" style={{ paddingTop: 0 }}>
                  <div className="mc-alert mc-alert-blue">
                    <div>
                      <div className="mc-alert-title">확인 사항</div>
                      <div className="mc-alert-body">{result.classification.cautionMessage}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {result.matched && <FixedBenefitSection fixedBenefits={result.fixedBenefits} />}
            {result.matched && <ActualLossSection actualLoss={result.actualLoss} />}
          </div>

          <div className="mc-stack-sm">
            {result.matched && (
              <div className="mc-card">
                <div className="mc-card-head">
                  <div>
                    <div className="mc-card-title">분류 결과</div>
                    <div className="mc-card-sub">{MATCH_SOURCE_LABELS[result.matchSource] || result.matchSource}</div>
                  </div>
                </div>
                <div className="mc-card-body">
                  <div className="mc-stack-xs">
                    <div className="mc-kv">
                      <span className="mc-kv-key">상해/질병</span>
                      <span className="mc-kv-val">{labelOf(INJURY_DISEASE_LABELS, result.classification?.injuryDiseaseType)}</span>
                    </div>
                    <div className="mc-kv">
                      <span className="mc-kv-key">진료 유형</span>
                      <span className="mc-kv-val">{labelOf(CARE_TYPE_LABELS, result.classification?.careType)}</span>
                    </div>
                    <div className="mc-kv">
                      <span className="mc-kv-key">급여 여부</span>
                      <span className="mc-kv-val">{labelOf(BENEFIT_TYPE_LABELS, result.classification?.benefitType)}</span>
                    </div>
                    <div className="mc-kv">
                      <span className="mc-kv-key">매칭 출처</span>
                      <span className="mc-kv-val">{MATCH_SOURCE_LABELS[result.matchSource] || result.matchSource}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result.nextQuestions?.length > 0 && (
              <div className="mc-card">
                <div className="mc-card-head">
                  <div>
                    <div className="mc-card-title">추가 확인</div>
                    <div className="mc-card-sub">정확한 판단에 필요한 정보</div>
                  </div>
                </div>
                <div className="mc-card-body">
                  <div className="mc-stack-xs">
                    {result.nextQuestions.map((question) => (
                      <div
                        key={question}
                        style={{
                          padding: '10px 0',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                          fontWeight: 700,
                          lineHeight: 1.55,
                          color: 'var(--text-1)',
                          wordBreak: 'keep-all',
                        }}
                      >
                        {question}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              className="mc-btn mc-btn-primary mc-btn-block mc-btn-lg"
              onClick={() => navigate(`/chat?q=${encodeURIComponent(result.query)}`)}
            >
              <Ic d={P.chat} size={12} /> AI에게 보장 질문하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
