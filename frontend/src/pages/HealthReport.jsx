import React, { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { healthAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  download: (<><path d="M8 2v8M4 7l4 4 4-4"/><path d="M2 13h12"/></>),
  hospital: (<><path d="M2 14V6l6-3 6 3v8"/><path d="M6 14V9h4v5"/></>),
  chart:    (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
  calendar: (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  heart:    (<path d="M8 14s-5-3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 4-5 7-5 7z"/>),
};

const DISEASE_KEY = { STROKE: 'stroke', DIABETES: 'diabetes', CARDIO: 'cardio' };
const DISEASE_NAME = { STROKE: '뇌졸중', DIABETES: '당뇨', CARDIO: '심뇌혈관' };

const RISK_COLOR = { '나쁨': '#9A6060', '보통': '#8A7040', '좋음': '#2F6FE8', '-': 'var(--text-2)' };

const gradeFromRank = (rank) => {
  if (rank == null || rank === '') return '-';
  const n = parseFloat(rank);
  if (isNaN(n)) return '-';
  if (n >= 67) return '나쁨';
  if (n >= 34) return '보통';
  return '좋음';
};

const HealthReport = () => {
  const [riskTrend, setRiskTrend] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [records, checkups, predictions] = await Promise.all([
          healthAPI.getMedicalRecords().catch(() => []),
          healthAPI.getCheckupResults().catch(() => []),
          healthAPI.getDiseasePredictions().catch(() => []),
        ]);

        // 최근 12개월 진료 방문
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const recentRecords = records.filter((r) => r.visitDate && new Date(r.visitDate) >= cutoff);

        const visitCount = recentRecords.length;

        // 주요 병원·진료과
        const hospCount = {}, deptCount = {};
        recentRecords.forEach((r) => {
          if (r.hospitalName) hospCount[r.hospitalName] = (hospCount[r.hospitalName] || 0) + 1;
          if (r.department)   deptCount[r.department]   = (deptCount[r.department]   || 0) + 1;
        });
        const topHospital   = Object.entries(hospCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const topDepartment = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        // 건강검진
        const recentCheckups = checkups.filter((c) => c.checkupDate && new Date(c.checkupDate) >= cutoff);
        const checkupCount = recentCheckups.length;
        const sortedCheckups = [...checkups].sort((a, b) =>
          (b.checkupDate || '').localeCompare(a.checkupDate || ''));
        const lastCheckup = sortedCheckups[0]?.checkupDate || '-';

        // 위험도 상태 (가장 높은 averageRatio 기준)
        const maxRank = predictions.reduce((max, p) => {
          const n = parseFloat(p.averageRatio);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const riskStatus = gradeFromRank(maxRank || null);

        setStats({ visitCount, checkupCount, lastCheckup, topHospital, topDepartment, riskStatus });

        // 위험도 추이 차트 (checkupDate 연도별로 그룹핑)
        const trendMap = {};
        predictions.forEach((p) => {
          const key = DISEASE_KEY[p.predictionType];
          if (!key || !p.checkupDate) return;
          const year = String(p.checkupDate).substring(0, 4);
          if (!trendMap[year]) trendMap[year] = { year };
          trendMap[year][key] = parseFloat(p.riskRatio) || 0;
        });
        const trend = Object.values(trendMap).sort((a, b) => a.year.localeCompare(b.year));
        if (trend.length > 0) setRiskTrend(trend);
      } catch (e) {
        console.error('HealthReport fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handlePDFDownload = () => {
    alert('PDF 다운로드 기능은 준비 중입니다.');
  };

  const riskColor = RISK_COLOR[stats?.riskStatus] || 'var(--text-2)';

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

      {loading ? (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 8 }}>
          <div>
            <div className="mc-alert-title">데이터 불러오는 중...</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="mc-stats-strip">
            <div className="mc-stat">
              <div className="mc-stat-label">진료 방문</div>
              <div className="mc-stat-value">{stats?.visitCount ?? 0}회</div>
              <div className="mc-stat-sub">최근 12개월</div>
            </div>
            <div className="mc-stat">
              <div className="mc-stat-label">건강검진</div>
              <div className="mc-stat-value">{stats?.checkupCount ?? 0}건</div>
              <div className="mc-stat-sub">최근 검진 {stats?.lastCheckup ?? '-'}</div>
            </div>
            <div className="mc-stat">
              <div className="mc-stat-label">위험도 상태</div>
              <div className="mc-stat-value" style={{ color: riskColor }}>{stats?.riskStatus ?? '-'}</div>
              <div className="mc-stat-sub">주요 지표 추적 중</div>
            </div>
          </div>

          <div className="mc-two-col" style={{ gridTemplateColumns: '1.35fr 1fr', marginTop: 18 }}>
            <div>
              <div className="mc-sec-head">
                <span className="mc-sec-title">질병 위험도 추이</span>
              </div>
              <div className="mc-card mc-card-body">
                {riskTrend.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '48px 0', fontSize: 13 }}>
                    위험도 추이 데이터가 없어요.
                  </div>
                ) : (
                  <div className="mc-chart-wrap">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={riskTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
                        <XAxis dataKey="year" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
                        <YAxis tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }} unit="%"/>
                        <Tooltip
                          contentStyle={{
                            background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                            fontSize: 12, color: '#0D1520',
                          }}
                          formatter={(v, name) => [`${v}%`, DISEASE_NAME[name.toUpperCase()] || name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}
                          formatter={(v) => DISEASE_NAME[v.toUpperCase()] || v}/>
                        <Line type="monotone" dataKey="stroke"   stroke="#9A6060" name="stroke"   strokeWidth={2} dot={{ r: 3 }}/>
                        <Line type="monotone" dataKey="diabetes" stroke="#8A7040" name="diabetes" strokeWidth={2} dot={{ r: 3 }}/>
                        <Line type="monotone" dataKey="cardio"   stroke="#2F6FE8" name="cardio"   strokeWidth={2} dot={{ r: 3 }}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
                    <span className="mc-kv-val">{stats?.topHospital ?? '-'}</span>
                  </div>
                  <div className="mc-kv">
                    <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Ic d={P.chart} size={14}/> 주요 진료과
                    </span>
                    <span className="mc-kv-val">{stats?.topDepartment ?? '-'}</span>
                  </div>
                  <div className="mc-kv">
                    <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Ic d={P.calendar} size={14}/> 최근 건강검진
                    </span>
                    <span className="mc-kv-val">{stats?.lastCheckup ?? '-'}</span>
                  </div>
                  <div className="mc-kv">
                    <span className="mc-kv-key" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Ic d={P.heart} size={14}/> 종합 상태
                    </span>
                    <span className="mc-kv-val" style={{ color: riskColor }}>{stats?.riskStatus ?? '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HealthReport;
