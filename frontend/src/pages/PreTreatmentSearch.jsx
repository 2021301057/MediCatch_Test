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
      <span style={tagStyle('info')}>{result.confidence === 'HIGH' ? '높은 일치도' : '확인 필요'}</span>
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
        {rule.generationCode} · {labelOf(DEDUCTIBLE_LABELS, rule.deductibleMethod)}
      </span>
      <span className="mc-kv-val" style={{ textAlign: 'right' }}>
        <span>
          {excluded ? '보상 제외' : `보장 ${rule.reimbursementRate || 0}% · 자기부담 ${rule.patientCopayRate || 0}%`}
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

  return (
    <div className="mc-card mc-section-tight">
      <div className="mc-card-head">
        <div>
          <div className="mc-card-title">실손 확인</div>
          <div className="mc-card-sub">{actualLoss?.reason || '실손 담보 기준을 확인합니다.'}</div>
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

        {actualLoss?.selectedRules?.length > 0 && (
          <div className="mc-stack-xs" style={{ marginTop: 14 }}>
            {actualLoss.selectedRules.map((rule, index) => (
              <ActualLossRuleRow key={`${rule.generationCode}-${rule.actualLossCategory}-${index}`} rule={rule} />
            ))}
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
                  <div className="mc-card-sub">{result.message}</div>
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

            <FixedBenefitSection fixedBenefits={result.fixedBenefits} />
            <ActualLossSection actualLoss={result.actualLoss} />
          </div>

          <div className="mc-stack-sm">
            <div className="mc-card">
              <div className="mc-card-head">
                <div>
                  <div className="mc-card-title">분류 결과</div>
                  <div className="mc-card-sub">DB 룰 기준</div>
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
                    <span className="mc-kv-val">{result.matchSource}</span>
                  </div>
                </div>
              </div>
            </div>

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
                      <div key={question} className="mc-kv">
                        <span className="mc-kv-key">확인</span>
                        <span className="mc-kv-val">{question}</span>
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
