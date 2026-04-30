import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { healthAPI } from '../api/services';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  heart:  (<path d="M8 14s-5-3.3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 3.7-5 7-5 7z"/>),
  warn:   (<><path d="M8 3l6 10H2z"/><path d="M8 7v3M8 12v.01"/></>),
  check:  (<path d="M3 8l3 3 7-7"/>),
  cal:    (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  chart:  (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
};

const MOCK_CHECKUPS = [
  { year: 2025, healthAge: 38, actualAge: 42, height: 172, weight: 78, bmi: 26.4,
    bloodPressure: '128/82', bloodSugar: 98, cholesterol: 215,
    riskFactors: ['복부비만', '경계성 혈압'],
    results: [
      { category: '혈압',       value: '128/82',    status: 'WARNING', normal: '120/80 미만' },
      { category: '혈당',       value: '98 mg/dL',  status: 'NORMAL',  normal: '100 미만' },
      { category: '콜레스테롤', value: '215 mg/dL', status: 'WARNING', normal: '200 미만' },
      { category: 'BMI',        value: '26.4',      status: 'WARNING', normal: '18.5~24.9' },
    ],
  },
  { year: 2024, healthAge: 40, actualAge: 41, height: 172, weight: 80, bmi: 27.0,
    bloodPressure: '132/85', bloodSugar: 102, cholesterol: 228,
    riskFactors: ['복부비만', '경계성 혈압', '경계성 혈당'],
    results: [],
  },
];

const MOCK_DISEASES = [
  { type: '뇌졸중',   riskGrade: 'LOW',    avgProbability: 18.5, riskFactors: ['고혈압 경계', '흡연력'] },
  { type: '당뇨',     riskGrade: 'MEDIUM', avgProbability: 28.5, riskFactors: ['복부비만', '경계성 혈당', '가족력'] },
  { type: '심뇌혈관', riskGrade: 'LOW',    avgProbability: 20.3, riskFactors: ['고혈압 경계'] },
];

const MOCK_TARGETS = [
  { name: '위암검진',   dueDate: '2026-06', status: 'DUE' },
  { name: '대장암검진', dueDate: '2026-06', status: 'DUE' },
  { name: '구강검진',   dueDate: '2026-06', status: 'OVERDUE' },
];

const CHART_DATA = [
  { year: '2023', bloodPressure: 135, bloodSugar: 105, cholesterol: 220 },
  { year: '2024', bloodPressure: 132, bloodSugar: 102, cholesterol: 228 },
  { year: '2025', bloodPressure: 128, bloodSugar: 98,  cholesterol: 215 },
];

const STATUS_LABEL = { NORMAL: '정상', WARNING: '주의', DANGER: '경고' };
const STATUS_CLASS = { NORMAL: 'mc-tag-success', WARNING: 'mc-tag-warning', DANGER: 'mc-tag-danger' };
const GRADE_LABEL  = { LOW: '낮음', MEDIUM: '중간', HIGH: '높음' };
const GRADE_CLASS  = { LOW: 'mc-tag-success', MEDIUM: 'mc-tag-warning', HIGH: 'mc-tag-danger' };
const PBAR_CLASS = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

const CheckupRecords = () => {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [checkups, setCheckups] = useState(MOCK_CHECKUPS);
  const [diseases] = useState(MOCK_DISEASES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCheckups = async () => {
      setLoading(true);
      try {
        const data = await healthAPI.getCheckupResults();
        if (Array.isArray(data) && data.length) setCheckups(data);
      } catch (error) {
        console.error('Failed to fetch checkups:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCheckups();
  }, []);

  const currentCheckup = checkups.find((c) => c.year === selectedYear) || checkups[0];
  const ageDelta = currentCheckup.healthAge - currentCheckup.actualAge;
  const isYounger = ageDelta < 0;

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">건강검진 기록</div>
          <div className="mc-page-subtitle">연도별 검진 결과와 3년 추이, 질병 위험도를 확인하세요.</div>
        </div>
      </div>

      {/* 건강나이 카드 + 주요 지표 요약 */}
      <div className="mc-two-col" style={{ gridTemplateColumns: '360px 1fr' }}>
        <div className={`mc-card mc-card-body ${isYounger ? 'mc-card-accent-success' : 'mc-card-accent-warning'}`}>
          <div className="mc-field-label">건강나이</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <div style={{
              fontSize: 36, fontWeight: 800, letterSpacing: '-0.5px',
              color: isYounger ? '#3A7A62' : '#8A7040',
            }}>
              {currentCheckup.healthAge}세
            </div>
            <span className={`mc-tag ${isYounger ? 'mc-tag-success' : 'mc-tag-warning'}`}>
              {ageDelta > 0 ? `+${ageDelta}세` : `${ageDelta}세`}
            </span>
          </div>
          <div className="mc-card-sub" style={{ marginTop: 8 }}>
            실제나이 {currentCheckup.actualAge}세 · {selectedYear}년 기준
          </div>
          {currentCheckup.riskFactors?.length > 0 && (
            <div className="mc-row-wrap" style={{ marginTop: 14 }}>
              {currentCheckup.riskFactors.map((r) => (
                <span key={r} className="mc-tag mc-tag-warning">
                  <Ic d={P.warn} size={10}/> {r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mc-grid-2">
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">혈압</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup.bloodPressure}</div>
            <div className="mc-stat-sub">mmHg</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">혈당</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup.bloodSugar}</div>
            <div className="mc-stat-sub">mg/dL</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">콜레스테롤</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup.cholesterol}</div>
            <div className="mc-stat-sub">mg/dL</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">BMI</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup.bmi}</div>
            <div className="mc-stat-sub">{currentCheckup.height}cm · {currentCheckup.weight}kg</div>
          </div>
        </div>
      </div>

      {/* 연도 탭 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">검사 연도</span>
      </div>
      <div className="mc-row-wrap">
        {checkups.map((c) => (
          <button
            key={c.year}
            className={`mc-chip ${selectedYear === c.year ? 'active' : ''}`}
            onClick={() => setSelectedYear(c.year)}
          >
            <Ic d={P.cal} size={10}/> {c.year}년
          </button>
        ))}
      </div>

      {/* 검사 결과 테이블 */}
      {currentCheckup.results.length > 0 && (
        <>
          <div className="mc-sec-head" style={{ marginTop: 18 }}>
            <span className="mc-sec-title">검사 결과</span>
          </div>
          <div className="mc-card">
            <table className="mc-tbl">
              <thead>
                <tr>
                  <th>검사항목</th>
                  <th>측정값</th>
                  <th>정상범위</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {currentCheckup.results.map((result, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{result.category}</td>
                    <td><strong>{result.value}</strong></td>
                    <td style={{ color: 'var(--text-2)' }}>{result.normal}</td>
                    <td>
                      <span className={`mc-tag ${STATUS_CLASS[result.status]}`}>
                        {STATUS_LABEL[result.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 3년 추이 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">3년 추이 분석</span>
      </div>
      <div className="mc-card mc-card-body">
        <div className="mc-chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={CHART_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Bar dataKey="bloodPressure" fill="#9A6060" name="혈압"/>
              <Bar dataKey="bloodSugar"    fill="#8A7040" name="혈당"/>
              <Bar dataKey="cholesterol"   fill="#2F6FE8" name="콜레스테롤"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 질병 위험도 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">질병 위험도</span>
      </div>
      <div className="mc-grid-auto-sm">
        {diseases.map((d, idx) => (
          <div key={idx} className="mc-card mc-card-body">
            <div className="mc-card-head" style={{ padding: 0, border: 'none' }}>
              <div className="mc-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Ic d={P.heart} size={14}/> {d.type}
              </div>
              <span className={`mc-tag ${GRADE_CLASS[d.riskGrade]}`}>
                {GRADE_LABEL[d.riskGrade]}
              </span>
            </div>
            <div className="mc-kv" style={{ marginTop: 10 }}>
              <span className="mc-kv-key">평균 위험률</span>
              <span className="mc-kv-val" style={{ fontWeight: 700 }}>{d.avgProbability}%</span>
            </div>
            <div className="mc-pbar" style={{ marginTop: 8 }}>
              <div
                className={`mc-pbar-fill ${PBAR_CLASS[d.riskGrade]}`}
                style={{ width: `${Math.min(d.avgProbability * 2, 100)}%` }}
              />
            </div>
            <div className="mc-card-sub" style={{ marginTop: 10 }}>
              위험요인: {d.riskFactors.join(', ')}
            </div>
          </div>
        ))}
      </div>

      {/* 필수 검진 대상 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">필수 검진 대상</span>
      </div>
      <div className="mc-grid-auto-sm">
        {MOCK_TARGETS.map((t, idx) => (
          <div key={idx} className={`mc-card mc-card-body ${t.status === 'OVERDUE' ? 'mc-card-accent-danger' : 'mc-card-accent-warning'}`}>
            <div className="mc-row-between">
              <div>
                <div className="mc-card-title" style={{ fontSize: 14 }}>{t.name}</div>
                <div className="mc-card-sub" style={{ marginTop: 4 }}>
                  <Ic d={P.cal} size={10}/> {t.dueDate}
                </div>
              </div>
              <span className={`mc-tag ${t.status === 'OVERDUE' ? 'mc-tag-danger' : 'mc-tag-warning'}`}>
                {t.status === 'OVERDUE' ? '기한 경과' : '예정'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 16 }}>
          <div>
            <div className="mc-alert-title">검진 기록 불러오는 중…</div>
            <div className="mc-alert-body">잠시만 기다려주세요.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckupRecords;
