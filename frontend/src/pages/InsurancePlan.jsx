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

const ACTIVE_STATUS = new Set(['정상', '계약부활']);

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

const isActivePolicy = (policy) => ACTIVE_STATUS.has(policy?.status || policy?.contractStatus || '');

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
  const supplementaryCount = activePolicies.filter((policy) => (
    policy.policyType === 'SUPPLEMENTARY' || policy.hasSupplementaryCoverage
  )).length;
  const monthlyPremium = activePolicies.reduce((sum, policy) => (
    sum + toNumber(policy.monthlyPremium ?? policy.monthly_premium)
  ), 0);

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">보장 공백 점검</div>
          <div className="mc-page-subtitle">
            현재 조회된 보험 내역을 기준으로 보장 공백 분석을 준비합니다.
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
            <Ic d={P.shield} size={12}/> Coverage Check
          </div>
          <div style={{
            fontSize: 44, fontWeight: 800,
            marginTop: 8, lineHeight: 1,
          }}>
            {coverageItems.length}
            <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 6 }}>개</span>
          </div>
          <div style={{ fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>
            분석 대상 보장 항목
          </div>
        </div>

        <div className="mc-grid-2">
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">활성 보험</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>
              {activePolicies.length}건
            </div>
            <div className="mc-stat-sub">정상/계약부활 계약 기준</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">실손 포함 보험</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>
              {supplementaryCount}건
            </div>
            <div className="mc-stat-sub">실손 또는 실손 포함 계약</div>
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
            <div className="mc-alert-title">다음 단계</div>
            <div className="mc-alert-body">
              현재는 실제 보험 데이터를 불러오는 단계까지 정리되었습니다. 다음 단계에서 주요 보장 기준표와 공백 판정 로직을 연결합니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsurancePlan;
