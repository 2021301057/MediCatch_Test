import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { analysisAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  download: (<><path d="M8 2v8M4 7l4 4 4-4"/><path d="M2 13h12"/></>),
  calendar: (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  hospital: (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  up:       (<path d="M3 10l5-5 5 5"/>),
  syringe:  (<><path d="M10 2l4 4M8 4l4 4-6 6H2v-4z"/></>),
  check:    (<path d="M3 8l3 3 7-7"/>),
  x:        (<path d="M4 4l8 8M12 4l-8 8"/>),
  chart:    (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
};

const MOCK_MONTHLY = [
  { month: '3월',  medicalCost: 65000,  claimed: 45000,  unclaimed: 20000 },
  { month: '2월',  medicalCost: 328000, claimed: 250000, unclaimed: 78000 },
  { month: '1월',  medicalCost: 8500,   claimed: 0,      unclaimed: 8500 },
  { month: '12월', medicalCost: 28000,  claimed: 0,      unclaimed: 28000 },
  { month: '11월', medicalCost: 145000, claimed: 120000, unclaimed: 25000 },
  { month: '10월', medicalCost: 0,      claimed: 0,      unclaimed: 0 },
  { month: '9월',  medicalCost: 52000,  claimed: 40000,  unclaimed: 12000 },
  { month: '8월',  medicalCost: 88000,  claimed: 65000,  unclaimed: 23000 },
];

const MOCK_RISK_TREND = [
  { year: '2023', stroke: 8,  diabetes: 20, cardio: 10 },
  { year: '2024', stroke: 10, diabetes: 25, cardio: 12 },
  { year: '2025', stroke: 12, diabetes: 28, cardio: 15 },
];

const PIE_DATA = [
  { name: '급여',   value: 520000 },
  { name: '비급여', value: 194500 },
];
const PIE_COLORS = ['#2F6FE8', '#C0A870'];

const MOCK_STATS = {
  totalSpending: 714500,
  totalClaimed: 520000,
  unclaimedAmount: 194500,
  visitCount: 8,
  topHospital: '서울성모병원',
  topDepartment: '내과',
};

const VACCINATION_DATA = [
  { name: '독감',       status: true,  date: '2025-10-15' },
  { name: '폐렴구균',   status: true,  date: '2025-09-20' },
  { name: '코로나',     status: true,  date: '2025-04-10' },
  { name: 'B형간염',    status: false, date: null },
];

const formatKRW = (n) => new Intl.NumberFormat('ko-KR').format(n || 0) + '원';

const HealthReport = () => {
  const [monthlyData, setMonthlyData] = useState(MOCK_MONTHLY);
  const [riskTrend, setRiskTrend] = useState(MOCK_RISK_TREND);
  const [stats, setStats] = useState(MOCK_STATS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await analysisAPI.getHealthReport();
        if (data?.monthly)   setMonthlyData(data.monthly);
        if (data?.riskTrend) setRiskTrend(data.riskTrend);
        if (data?.stats)     setStats(data.stats);
      } catch (error) {
        console.error('Failed to fetch report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  const handlePDFDownload = () => {
    alert('PDF 다운로드 기능은 준비 중입니다.');
  };

  const claimedRate = stats.totalSpending
    ? ((stats.totalClaimed / stats.totalSpending) * 100).toFixed(1)
    : 0;
  const unclaimedRate = stats.totalSpending
    ? ((stats.unclaimedAmount / stats.totalSpending) * 100).toFixed(1)
    : 0;
  const avgPerVisit = stats.visitCount
    ? Math.floor(stats.totalSpending / stats.visitCount)
    : 0;

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">12개월 건강 리포트</div>
          <div className="mc-page-subtitle">최근 1년간의 진료·청구·위험도 데이터를 한눈에 확인하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn mc-btn-primary" onClick={handlePDFDownload}>
            <Ic d={P.download} size={12}/> PDF 다운로드
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">총 의료비</div>
          <div className="mc-stat-value">{formatKRW(stats.totalSpending)}</div>
          <div className="mc-stat-sub">{stats.visitCount}회 방문</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">청구 완료</div>
          <div className="mc-stat-value" style={{ color: 'var(--success-dark, #3A7A62)' }}>
            {formatKRW(stats.totalClaimed)}
          </div>
          <div className="mc-stat-sub">{claimedRate}%</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">미청구</div>
          <div className="mc-stat-value" style={{ color: '#8A7040' }}>
            {formatKRW(stats.unclaimedAmount)}
          </div>
          <div className="mc-stat-sub">{unclaimedRate}%</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">병원 방문</div>
          <div className="mc-stat-value">{stats.visitCount}회</div>
          <div className="mc-stat-sub">평균 {formatKRW(avgPerVisit)}</div>
        </div>
      </div>

      {/* 월별 의료비 */}
      <div className="mc-sec-head">
        <span className="mc-sec-title">월별 의료비 추이</span>
      </div>
      <div className="mc-card mc-card-body">
        <div className="mc-chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
              <XAxis dataKey="month" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
              <YAxis tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
              <Tooltip
                formatter={(value) => formatKRW(value)}
                contentStyle={{
                  background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                  fontSize: 12, color: '#0D1520',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}/>
              <Bar dataKey="claimed"   fill="#2F6FE8" name="청구 완료"/>
              <Bar dataKey="unclaimed" fill="#C0A870" name="미청구"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 위험도 + 급여/비급여 파이 2열 */}
      <div className="mc-two-col" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: 18 }}>
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">질병 위험도 추이</span>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={riskTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
                  <XAxis dataKey="year" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
                  <YAxis tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
                  <Tooltip
                    contentStyle={{
                      background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                      fontSize: 12, color: '#0D1520',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}/>
                  <Line type="monotone" dataKey="stroke"   stroke="#9A6060" name="뇌졸중"   strokeWidth={2} dot={{ r: 3 }}/>
                  <Line type="monotone" dataKey="diabetes" stroke="#8A7040" name="당뇨"     strokeWidth={2} dot={{ r: 3 }}/>
                  <Line type="monotone" dataKey="cardio"   stroke="#2F6FE8" name="심뇌혈관" strokeWidth={2} dot={{ r: 3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">급여 vs 비급여</span>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-chart-wrap">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={PIE_DATA}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {PIE_COLORS.map((color, i) => (
                      <Cell key={i} fill={color} stroke="#fff" strokeWidth={2}/>
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatKRW(value)}
                    contentStyle={{
                      background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mc-stack-xs" style={{ marginTop: 8 }}>
              {PIE_DATA.map((p, i) => (
                <div key={p.name} className="mc-kv">
                  <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                      background: PIE_COLORS[i],
                    }}/>
                    {p.name}
                  </span>
                  <span className="mc-kv-val">{formatKRW(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 병원 방문 현황 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">병원 방문 현황</span>
      </div>
      <div className="mc-grid-2">
        <div className="mc-card mc-card-body">
          <div className="mc-kv">
            <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Ic d={P.hospital} size={14}/> 가장 많이 방문한 병원
            </span>
            <span className="mc-kv-val" style={{ fontWeight: 700 }}>{stats.topHospital}</span>
          </div>
        </div>
        <div className="mc-card mc-card-body">
          <div className="mc-kv">
            <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Ic d={P.chart} size={14}/> 가장 많이 방문한 진료과
            </span>
            <span className="mc-kv-val" style={{ fontWeight: 700 }}>{stats.topDepartment}</span>
          </div>
        </div>
      </div>

      {/* 예방접종 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">예방접종 현황</span>
      </div>
      <div className="mc-card">
        <table className="mc-tbl">
          <thead>
            <tr>
              <th>백신명</th>
              <th>접종 상태</th>
              <th>접종일</th>
            </tr>
          </thead>
          <tbody>
            {VACCINATION_DATA.map((vacc, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-1)' }}>
                    <Ic d={P.syringe} size={12}/> {vacc.name}
                  </span>
                </td>
                <td>
                  <span className={`mc-tag ${vacc.status ? 'mc-tag-success' : 'mc-tag-warning'}`}>
                    <Ic d={vacc.status ? P.check : P.x} size={10}/>
                    {vacc.status ? ' 접종 완료' : ' 미접종'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-2)' }}>{vacc.date || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">데이터 불러오는 중…</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthReport;
