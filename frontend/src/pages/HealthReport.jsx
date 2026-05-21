import React, { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { analysisAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  download: (<><path d="M8 2v8M4 7l4 4 4-4"/><path d="M2 13h12"/></>),
  hospital: (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  syringe:  (<><path d="M10 2l4 4M8 4l4 4-6 6H2v-4z"/></>),
  check:    (<path d="M3 8l3 3 7-7"/>),
  x:        (<path d="M4 4l8 8M12 4l-8 8"/>),
  chart:    (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
  calendar: (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  heart:    (<path d="M8 14s-5-3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 4-5 7-5 7z"/>),
};

const MOCK_RISK_TREND = [
  { year: '2023', stroke: 8,  diabetes: 20, cardio: 10 },
  { year: '2024', stroke: 10, diabetes: 25, cardio: 12 },
  { year: '2025', stroke: 12, diabetes: 28, cardio: 15 },
];

const MOCK_STATS = {
  visitCount: 8,
  checkupCount: 2,
  riskStatus: '주의',
  completedVaccines: 3,
  topHospital: '서울성모병원',
  topDepartment: '내과',
  lastCheckup: '2026-03-15',
};

const VACCINATION_DATA = [
  { name: '독감',       status: true,  date: '2025-10-15' },
  { name: '폐렴구균',   status: true,  date: '2025-09-20' },
  { name: '코로나',     status: true,  date: '2025-04-10' },
  { name: 'B형간염',    status: false, date: null },
];

const HealthReport = () => {
  const [riskTrend, setRiskTrend] = useState(MOCK_RISK_TREND);
  const [stats, setStats] = useState(MOCK_STATS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await analysisAPI.getHealthReport();
        if (data?.riskTrend) setRiskTrend(data.riskTrend);
        if (data?.stats) {
          setStats((prev) => ({
            ...prev,
            visitCount: data.stats.visitCount ?? data.stats.visit_count ?? prev.visitCount,
            checkupCount: data.stats.checkupCount ?? data.stats.checkup_count ?? prev.checkupCount,
            riskStatus: data.stats.riskStatus ?? data.stats.risk_status ?? prev.riskStatus,
            completedVaccines: data.stats.completedVaccines ?? data.stats.completed_vaccines ?? prev.completedVaccines,
            topHospital: data.stats.topHospital ?? data.stats.top_hospital ?? prev.topHospital,
            topDepartment: data.stats.topDepartment ?? data.stats.top_department ?? prev.topDepartment,
            lastCheckup: data.stats.lastCheckup ?? data.stats.last_checkup ?? prev.lastCheckup,
          }));
        }
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

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">12개월 건강 리포트</div>
          <div className="mc-page-subtitle">최근 1년간의 건강검진, 진료 방문, 위험도 변화를 한눈에 확인하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn mc-btn-primary" onClick={handlePDFDownload}>
            <Ic d={P.download} size={12}/> PDF 다운로드
          </button>
        </div>
      </div>

      <div className="mc-stats-strip">
        <div className="mc-stat">
          <div className="mc-stat-label">진료 방문</div>
          <div className="mc-stat-value">{stats.visitCount}회</div>
          <div className="mc-stat-sub">최근 12개월</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">건강검진</div>
          <div className="mc-stat-value">{stats.checkupCount}건</div>
          <div className="mc-stat-sub">최근 검진 {stats.lastCheckup}</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">위험도 상태</div>
          <div className="mc-stat-value" style={{ color: '#8A7040' }}>{stats.riskStatus}</div>
          <div className="mc-stat-sub">주요 지표 추적 중</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-label">예방접종</div>
          <div className="mc-stat-value">{stats.completedVaccines}건</div>
          <div className="mc-stat-sub">접종 완료 기록</div>
        </div>
      </div>

      <div className="mc-two-col" style={{ gridTemplateColumns: '1.35fr 1fr', marginTop: 18 }}>
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
            <span className="mc-sec-title">건강 요약</span>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-stack-sm">
              <div className="mc-kv">
                <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Ic d={P.hospital} size={14}/> 주요 방문 병원
                </span>
                <span className="mc-kv-val">{stats.topHospital}</span>
              </div>
              <div className="mc-kv">
                <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Ic d={P.chart} size={14}/> 주요 진료과
                </span>
                <span className="mc-kv-val">{stats.topDepartment}</span>
              </div>
              <div className="mc-kv">
                <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Ic d={P.calendar} size={14}/> 최근 건강검진
                </span>
                <span className="mc-kv-val">{stats.lastCheckup}</span>
              </div>
              <div className="mc-kv">
                <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Ic d={P.heart} size={14}/> 종합 상태
                </span>
                <span className="mc-kv-val">{stats.riskStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            <div className="mc-alert-title">데이터 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthReport;
