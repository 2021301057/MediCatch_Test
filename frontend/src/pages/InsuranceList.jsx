import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { insuranceAPI } from '../api/services';
import useAuthStore from '../store/authStore';
import CodefSyncModal from '../components/CodefSyncModal';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  chev:    (<path d="M4 6l4 4 4-4"/>),
  sync:    (<><path d="M3 8a5 5 0 0 1 8.5-3.5L13 6"/><path d="M13 2v4h-4"/><path d="M13 8a5 5 0 0 1-8.5 3.5L3 10"/><path d="M3 14v-4h4"/></>),
  plus:    (<path d="M8 3v10M3 8h10"/>),
  won:     (<><path d="M2 4h12M2 7h12"/><path d="M4 4l2 8h1l1-5 1 5h1l2-8"/></>),
  shield:  (<path d="M8 1.5l5.5 2v4.5C13.5 11.5 8 14.5 8 14.5S2.5 11.5 2.5 8V3.5L8 1.5z"/>),
};

const PIE_COLORS = ['#7EA6F2', '#B69A62', '#9BCDB8', '#E8B86D', '#8EC5D6'];
const FILTERS = ['전체', '실손', '건강', '저축', '자동차', '재물'];
const TYPE_MAP = {
  SUPPLEMENTARY: '실손',
  HEALTH: '건강',
  SAVINGS: '저축',
  CAR: '자동차',
  PROPERTY: '재물',
  LIFE: '건강',
  NON_LIFE: '건강',
};

const formatKRW = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';
const hasPremium = (policy) => Number(policy.monthlyPremium || 0) > 0;
const isOneTimePayment = (policy) => (policy.paymentCycle || '').includes('일시');
const formatPremium = (policy) => {
  if (isOneTimePayment(policy) && Number(policy.premiumAmount || 0) > 0) {
    return `일시납 ${formatKRW(policy.premiumAmount)}`;
  }
  return hasPremium(policy) ? formatKRW(policy.monthlyPremium) : '정보 없음';
};

const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, value }) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      className="mc-pie-label"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      <tspan x={x} dy="-0.35em">{name}</tspan>
      <tspan x={x} dy="1.2em">{value}건</tspan>
    </text>
  );
};

const supplementaryBadgeStyle = {
  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
  background: '#EBF0FC', color: '#2F6FE8', border: '1px solid #C4D4F7',
  marginLeft: 6, whiteSpace: 'nowrap',
};

const emptyCardStyle = {
  textAlign: 'center',
  color: 'var(--text-3)',
  padding: '34px 18px',
};

const COVERAGE_CATEGORY_ORDER = ['실손', '진단', '수술', '입원', '통원', '항암·치료', '사망·후유장해', '위로금', '기타'];

const getPrimaryTypeLabel = (policy) => TYPE_MAP[policy.policyType] || '기타';
const getPolicyTypeLabel = (policy) => {
  const primary = getPrimaryTypeLabel(policy);
  if (policy.hasSupplementaryCoverage && policy.policyType !== 'SUPPLEMENTARY') {
    return `${primary} · 실손 포함`;
  }
  return primary;
};

const matchesFilter = (policy, filterType) => {
  if (filterType === '전체') return true;
  if (filterType === '실손') return policy.policyType === 'SUPPLEMENTARY' || policy.hasSupplementaryCoverage;
  return getPrimaryTypeLabel(policy) === filterType;
};

const getCoverageText = (item) => `${item.name || item.itemName || ''} ${item.agreementType || ''}`.toLowerCase();
const getCoverageCategory = (item) => {
  const text = getCoverageText(item);
  if (text.includes('실손') || text.includes('의료비')) return '실손';
  if (text.includes('진단')) return '진단';
  if (text.includes('수술')) return '수술';
  if (text.includes('입원')) return '입원';
  if (text.includes('통원')) return '통원';
  if (text.includes('위로금') || text.includes('보상금')) return '위로금';
  if (text.includes('항암') || text.includes('방사선') || text.includes('양성자') || text.includes('치료비')) return '항암·치료';
  if (text.includes('사망') || text.includes('후유장해') || text.includes('후유 장애')) return '사망·후유장해';
  return '기타';
};

const getCoverageAmount = (item) => item.amount ?? item.maxBenefitAmount;
const formatCoverageAmount = (item) => {
  const amount = Number(getCoverageAmount(item) || 0);
  return amount > 0 ? formatKRW(amount) : '정보 없음';
};

const groupCoverageItems = (items = []) => {
  const grouped = items.reduce((acc, item) => {
    const category = getCoverageCategory(item);
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return COVERAGE_CATEGORY_ORDER
    .filter((category) => grouped[category]?.length)
    .map((category) => ({
      category,
      items: grouped[category].sort((a, b) => {
        const amountDiff = Number(getCoverageAmount(b) || 0) - Number(getCoverageAmount(a) || 0);
        if (amountDiff !== 0) return amountDiff;
        return (a.name || a.itemName || '').localeCompare(b.name || b.itemName || '', 'ko-KR');
      }),
    }));
};

const InsuranceList = () => {
  const { user } = useAuthStore();
  const [policies, setPolicies] = useState([]);
  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const [filterType, setFilterType] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSyncModal, setShowSyncModal] = useState(false);

  const loadPolicies = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await insuranceAPI.getPolicies();
      setPolicies(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      console.error('Failed to fetch policies:', fetchError);
      setPolicies([]);
      setError('보험 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const filteredPolicies = policies.filter((policy) => matchesFilter(policy, filterType));

  const coveragePieData = useMemo(() => {
    const counts = policies.reduce((acc, policy) => {
      const label = getPrimaryTypeLabel(policy);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    return ['실손', '건강', '저축', '자동차', '재물', '기타']
      .map((name) => ({ name, value: counts[name] || 0 }))
      .filter((item) => item.value > 0);
  }, [policies]);

  const totalPremium = policies.reduce((sum, p) => sum + (p.monthlyPremium || 0), 0);
  const totalCoverage = policies.reduce(
    (sum, p) => sum + (p.coverageItems || []).reduce((s, item) => s + (item.amount || 0), 0), 0,
  );
  const filteredPremium = filteredPolicies.reduce((sum, p) => sum + (p.monthlyPremium || 0), 0);

  const handleSyncSuccess = () => {
    setShowSyncModal(false);
    loadPolicies();
  };

  const hasPolicies = policies.length > 0;
  const showInitialLoading = loading && !hasPolicies;
  const showEmptyPolicies = !loading && !error && !hasPolicies;
  const showEmptyFilter = !loading && !error && hasPolicies && filteredPolicies.length === 0;

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">내 보험 조회</div>
          <div className="mc-page-subtitle">가입된 보험 상품과 보장 내역을 한곳에서 관리하세요.</div>
        </div>
      </div>

      <div className="mc-stats-strip mc-stats-strip-3">
        <div className="mc-stat">
          <div className="mc-stat-label">총 월 보험료</div>
          <div className="mc-stat-value">{formatKRW(totalPremium)}</div>
          <div className="mc-stat-sub">매월 납입</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">보험 건수</div>
          <div className="mc-stat-value">{policies.length}건</div>
          <div className="mc-stat-sub">활성 계약</div>
        </div>
        <div className="mc-stat mc-stat-pill-blue">
          <div className="mc-stat-label">총 보장금액</div>
          <div className="mc-stat-value">{formatKRW(totalCoverage)}</div>
          <div className="mc-stat-sub">보장 한도 합계</div>
        </div>
      </div>

      <div className="mc-two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">보험 유형 구성</span>
          </div>
          <div className="mc-card mc-card-body mc-coverage-card">
            {coveragePieData.length > 0 ? (
              <div className="mc-chart-wrap mc-coverage-chart">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={coveragePieData}
                      cx="50%" cy="50%"
                      innerRadius={54} outerRadius={78}
                      paddingAngle={4}
                      cornerRadius={4}
                      dataKey="value"
                      label={renderPieLabel}
                      labelLine={{ stroke: '#B5BDCA', strokeWidth: 1 }}
                    >
                      {coveragePieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="#fff" strokeWidth={2}/>
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${value}건`}
                      contentStyle={{
                        background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={emptyCardStyle}>표시할 보험 구성이 없습니다.</div>
            )}
          </div>
        </div>

        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">유형 필터</span>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-row-wrap">
              {FILTERS.map((type) => (
                <button
                  key={type}
                  className={`mc-chip ${filterType === type ? 'active' : ''}`}
                  onClick={() => setFilterType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="mc-alert mc-alert-blue mc-filter-summary" style={{ marginTop: 16 }}>
              <div>
                <div className="mc-alert-title">총 {filteredPolicies.length}건 · 월 {formatKRW(filteredPremium)}</div>
                <div className="mc-alert-body">현재 필터 기준 금액</div>
              </div>
              <span className="mc-tag mc-tag-blue">
                <Ic d={P.shield} size={10}/> {filterType}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">가입 보험 · {filteredPolicies.length}건</span>
      </div>

      <div className="mc-stack-sm">
        {filteredPolicies.map((policy) => {
          const open = expandedPolicy === policy.id;
          const coverageGroups = groupCoverageItems(policy.coverageItems || []);
          return (
            <div key={policy.id} className="mc-card">
              <div
                className="mc-card-head clickable"
                onClick={() => setExpandedPolicy(open ? null : policy.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 6,
                    background: 'var(--blue-soft)', color: 'var(--blue)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 14, letterSpacing: '-0.4px',
                  }}>
                    {(policy.companyName || '?').charAt(0)}
                  </div>
                  <div>
                    <div className="mc-card-title mc-policy-title" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {policy.productName || '보험 상품명 없음'}
                      {policy.hasSupplementaryCoverage && policy.policyType !== 'SUPPLEMENTARY' && (
                        <span style={supplementaryBadgeStyle}>실손보장 포함</span>
                      )}
                    </div>
                    <div className="mc-card-sub">
                      {policy.companyName || '보험사 미확인'} · {getPolicyTypeLabel(policy)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`mc-tag ${policy.contractStatus === 'ACTIVE' ? 'mc-tag-blue' : 'mc-tag-neutral'}`}>
                    {policy.contractStatus === 'ACTIVE' ? '활성' : '만료'}
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    color: 'var(--text-3)',
                  }}>
                    <Ic d={P.chev} size={12}/>
                  </span>
                </div>
              </div>

              <div className="mc-card-body">
                <div className="mc-grid-2">
                  <div className="mc-kv mc-policy-kv">
                    <span className="mc-kv-key mc-policy-premium-key">보험료</span>
                    <span className="mc-kv-val mc-policy-premium-val">{formatPremium(policy)}</span>
                  </div>
                  <div className="mc-kv mc-policy-kv">
                    <span className="mc-kv-key mc-policy-expiry-key">만료일</span>
                    <span className="mc-kv-val mc-policy-date-val">{policy.endDate || '-'}</span>
                  </div>
                </div>

                {open && (
                  <div style={{ marginTop: 14 }}>
                    <div className="mc-field-label" style={{ marginBottom: 8 }}>
                      보장 내역 · {(policy.coverageItems || []).length}건
                    </div>
                    {coverageGroups.length > 0 ? (
                      <table className="mc-tbl">
                        <thead>
                          <tr>
                            <th>보장 항목</th>
                            <th style={{ textAlign: 'right' }}>보장금액</th>
                            <th style={{ textAlign: 'right' }}>상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coverageGroups.flatMap((group) => [
                            <tr key={`group-${group.category}`}>
                              <td colSpan={3} style={{
                                background: '#F6F8FC',
                                color: 'var(--text-2)',
                                fontWeight: 800,
                                fontSize: 12,
                              }}>
                                {group.category} · {group.items.length}건
                              </td>
                            </tr>,
                            ...group.items.map((item, idx) => (
                              <tr key={`${group.category}-${idx}`}>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{item.name || item.itemName || '-'}</div>
                                  {item.agreementType && (
                                    <div style={{ marginTop: 3, color: 'var(--text-3)', fontSize: 12 }}>
                                      {item.agreementType}
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--blue)', fontWeight: 700 }}>
                                  {formatCoverageAmount(item)}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span className={`mc-tag ${item.isCovered !== false ? 'mc-tag-success' : 'mc-tag-neutral'}`}>
                                    {item.isCovered !== false ? '보장중' : '예외'}
                                  </span>
                                </td>
                              </tr>
                            )),
                          ])}
                        </tbody>
                      </table>
                    ) : (
                      <div className="mc-card mc-card-body" style={{ color: 'var(--text-3)' }}>
                        등록된 보장 내역이 없습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {showInitialLoading && (
          <div className="mc-card mc-card-body" style={emptyCardStyle}>
            보험 정보를 불러오는 중입니다.
          </div>
        )}

        {error && (
          <div className="mc-alert mc-alert-red" style={{ marginTop: 8 }}>
            <div>
              <div className="mc-alert-title">보험 정보를 불러오지 못했습니다.</div>
              <div className="mc-alert-body">{error}</div>
            </div>
          </div>
        )}

        {showEmptyPolicies && (
          <div className="mc-card mc-card-body" style={emptyCardStyle}>
            아직 조회된 보험 정보가 없습니다. 내 건강 불러오기를 통해 보험 정보를 동기화해주세요.
          </div>
        )}

        {showEmptyFilter && (
          <div className="mc-card mc-card-body" style={emptyCardStyle}>
            현재 필터에 해당하는 보험이 없습니다.
          </div>
        )}
      </div>

      {loading && hasPolicies && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">보험 정보 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}

      {showSyncModal && (
        <CodefSyncModal
          userId={user?.userId}
          onClose={() => setShowSyncModal(false)}
          onSuccess={handleSyncSuccess}
        />
      )}
    </div>
  );
};

export default InsuranceList;
