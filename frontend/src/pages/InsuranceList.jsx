import React, { useState, useEffect } from 'react';
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

const MOCK_POLICIES = [
  { id: 1, companyName: '삼성생명', productName: '삼성생명 실손보험 (3세대)', policyType: 'SUPPLEMENTARY',
    monthlyPremium: 85000, endDate: '2045-03-15', contractStatus: 'ACTIVE',
    hasSupplementaryCoverage: false,
    coverageItems: [
      { name: '실손의료비', amount: 50000000, isCovered: true },
      { name: '입원의료비', amount: 30000000, isCovered: true },
    ] },
  { id: 2, companyName: '한화생명', productName: '한화생명 종신보험', policyType: 'LIFE',
    monthlyPremium: 180000, endDate: '2060-07-01', contractStatus: 'ACTIVE',
    hasSupplementaryCoverage: false,
    coverageItems: [
      { name: '사망보험금', amount: 100000000, isCovered: true },
      { name: '암진단금',   amount: 30000000,  isCovered: true },
    ] },
  { id: 3, companyName: '현대해상', productName: '현대해상 치아보험', policyType: 'NON_LIFE',
    monthlyPremium: 32000, endDate: '2030-12-31', contractStatus: 'ACTIVE',
    hasSupplementaryCoverage: false,
    coverageItems: [
      { name: '치과치료비', amount: 2000000, isCovered: true },
    ] },
];

const COVERAGE_PIE_DATA = [
  { name: '실손의료비', value: 80 },
  { name: '종신보험',   value: 130 },
  { name: '치아보험',   value: 2 },
];
const PIE_COLORS = ['#2F6FE8', '#8A7040', '#70AE98'];

const FILTERS = ['전체', '실손', '생명', '손해'];
const TYPE_MAP = { SUPPLEMENTARY: '실손', LIFE: '생명', NON_LIFE: '손해' };

const formatKRW = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';

const supplementaryBadgeStyle = {
  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
  background: '#EBF0FC', color: '#2F6FE8', border: '1px solid #C4D4F7',
  marginLeft: 6, whiteSpace: 'nowrap',
};

const InsuranceList = () => {
  const { user } = useAuthStore();
  const [policies, setPolicies] = useState(MOCK_POLICIES);
  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const [filterType, setFilterType] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    const fetchPolicies = async () => {
      setLoading(true);
      try {
        const data = await insuranceAPI.getPolicies();
        if (Array.isArray(data) && data.length) setPolicies(data);
      } catch (error) {
        console.error('Failed to fetch policies:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  const filteredPolicies = filterType === '전체'
    ? policies
    : policies.filter((p) => {
        if (filterType === '실손') return p.policyType === 'SUPPLEMENTARY' || p.hasSupplementaryCoverage;
        if (filterType === '생명') return p.policyType === 'LIFE';
        if (filterType === '손해') return p.policyType === 'NON_LIFE';
        return false;
      });

  const totalPremium = policies.reduce((sum, p) => sum + (p.monthlyPremium || 0), 0);
  const totalCoverage = policies.reduce(
    (sum, p) => sum + (p.coverageItems || []).reduce((s, item) => s + (item.amount || 0), 0), 0,
  );

  const handleSyncSuccess = () => {
    insuranceAPI.getPolicies()
      .then((data) => { if (Array.isArray(data) && data.length) setPolicies(data); })
      .catch(() => {});
  };

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">내 보험 조회</div>
          <div className="mc-page-subtitle">가입된 보험 상품과 보장 내역을 한 곳에서 관리하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn" onClick={() => setShowSyncModal(true)}>
            <Ic d={P.sync} size={12}/>
            {' '}CODEF 동기화
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">총 월 보험료</div>
          <div className="mc-stat-value">{formatKRW(totalPremium)}</div>
          <div className="mc-stat-sub">매월 납입</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">보험 건수</div>
          <div className="mc-stat-value">{policies.length}개</div>
          <div className="mc-stat-sub">활성 계약</div>
        </div>
        <div className="mc-stat mc-stat-pill mc-stat-pill-blue">
          <div className="mc-stat-label">총 보장금액</div>
          <div className="mc-stat-value">{formatKRW(totalCoverage)}</div>
          <div className="mc-stat-sub">보장 한도 합계</div>
        </div>
      </div>

      {/* 보장 구성 + 필터 2열 */}
      <div className="mc-two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">보장 범주 구성</span>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={COVERAGE_PIE_DATA}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {PIE_COLORS.map((c, i) => (
                      <Cell key={i} fill={c} stroke="#fff" strokeWidth={2}/>
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `${v}%`}
                    contentStyle={{
                      background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mc-stack-xs" style={{ marginTop: 8 }}>
              {COVERAGE_PIE_DATA.map((item, i) => (
                <div key={item.name} className="mc-kv">
                  <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                      background: PIE_COLORS[i],
                    }}/>
                    {item.name}
                  </span>
                  <span className="mc-kv-val">{item.value}%</span>
                </div>
              ))}
            </div>
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
            <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
              <div>
                <div className="mc-alert-title">총 {filteredPolicies.length}건 · 월 {formatKRW(
                  filteredPolicies.reduce((s, p) => s + (p.monthlyPremium || 0), 0),
                )}</div>
                <div className="mc-alert-body">현재 필터 기준 금액</div>
              </div>
              <span className="mc-tag mc-tag-blue">
                <Ic d={P.shield} size={10}/> {filterType}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 보험 상품 리스트 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">가입 보험 · {filteredPolicies.length}건</span>
        <button className="mc-sec-link">
          <Ic d={P.plus} size={10}/> 새 보험 추가
        </button>
      </div>
      <div className="mc-stack-sm">
        {filteredPolicies.map((policy) => {
          const open = expandedPolicy === policy.id;
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
                    {policy.companyName.charAt(0)}
                  </div>
                  <div>
                    <div className="mc-card-title" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {policy.productName}
                      {policy.hasSupplementaryCoverage && policy.policyType !== 'SUPPLEMENTARY' && (
                        <span style={supplementaryBadgeStyle}>실손보장 포함</span>
                      )}
                    </div>
                    <div className="mc-card-sub">
                      {policy.companyName} · {TYPE_MAP[policy.policyType] || '기타'}
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
                  <div className="mc-kv">
                    <span className="mc-kv-key">월 보험료</span>
                    <span className="mc-kv-val">{formatKRW(policy.monthlyPremium)}</span>
                  </div>
                  <div className="mc-kv">
                    <span className="mc-kv-key">만료일</span>
                    <span className="mc-kv-val">{policy.endDate}</span>
                  </div>
                </div>

                {open && (
                  <div style={{ marginTop: 14 }}>
                    <div className="mc-field-label" style={{ marginBottom: 8 }}>보장 내역</div>
                    <table className="mc-tbl">
                      <thead>
                        <tr>
                          <th>보장 항목</th>
                          <th style={{ textAlign: 'right' }}>보장금액</th>
                          <th style={{ textAlign: 'right' }}>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(policy.coverageItems || []).map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                            <td style={{ textAlign: 'right', color: 'var(--blue)', fontWeight: 700 }}>
                              {formatKRW(item.amount)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className={`mc-tag ${item.isCovered ? 'mc-tag-success' : 'mc-tag-neutral'}`}>
                                {item.isCovered ? '보장중' : '해지'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredPolicies.length === 0 && (
          <div className="mc-card mc-card-body" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
            조건에 맞는 보험이 없어요.
          </div>
        )}
      </div>

      {loading && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">보험 정보 불러오는 중…</div>
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
