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

// Mock 데이터 형태는 백엔드 필드명 그대로 유지
// (checkup_results 테이블 컬럼명 = CheckupResult 엔티티 = API 응답 키)
const MOCK_CHECKUPS = [
  {
    checkupDate: '2025-09-11',
    checkupType: 'REGULAR',
    height: 161.2,
    weight: 61.0,
    waist: 73.5,
    bmi: 23.5,
    sight: '1.0/1.2',
    hearing: '정상/정상',
    bloodPressureSystolic: 135,
    bloodPressureDiastolic: 96,
    glucose: 98,
    totalCholesterol: 280,
    hdlCholesterol: 71,
    ldlCholesterol: 171,
    triglycerides: 186,
    urinaryProtein: '음성',
    hemoglobin: 15.5,
    serumCreatinine: 0.9,
    gfr: 71,
    ast: 23,
    alt: 20,
    gammaGtp: 22,
    organizationName: '성애의료재단 성애병원',
    recommendations: '의심',
    abnormalFindings: '',
  },
  {
    checkupDate: '2024-07-20',
    checkupType: 'REGULAR',
    height: 161.6,
    weight: 61.8,
    waist: 80.3,
    bmi: 23.7,
    sight: '0.4/1.0',
    hearing: '정상/정상',
    bloodPressureSystolic: 122,
    bloodPressureDiastolic: 86,
    glucose: 107,
    totalCholesterol: null,
    hdlCholesterol: null,
    ldlCholesterol: null,
    triglycerides: null,
    urinaryProtein: '음성',
    hemoglobin: 14.6,
    serumCreatinine: 0.9,
    gfr: 72,
    ast: 19,
    alt: 11,
    gammaGtp: 23,
    organizationName: '속편한내과의원',
    recommendations: '정B',
    abnormalFindings: '',
  },
];

// 건강나이 Mock (HealthAgeResult 엔티티 = /health/health-age 응답 키)
const MOCK_HEALTH_AGE = {
  checkupDate: '2025-09-11',
  biologicalAge: 47,
  chronologicalAge: 50,
  summaryNote: '당신의 건강나이는 실제 나이보다 3살 적습니다.',
  detailMessage: '와우! 건강나이가 실제 나이보다 더 젊어요!',
  changeAfterMessage: '위험요인 조절 시 건강나이 45세 실제나이 50세',
  gender: '여성',
  height: 161.2,
  weight: 61.0,
  factors: [],
};

const MOCK_TARGETS = [
  { name: '위암검진',   dueDate: '2026-06', status: 'DUE' },
  { name: '대장암검진', dueDate: '2026-06', status: 'DUE' },
  { name: '구강검진',   dueDate: '2026-06', status: 'OVERDUE' },
];

const STATUS_LABEL = { NORMAL: '정상', WARNING: '주의', DANGER: '경고' };
const STATUS_CLASS = { NORMAL: 'mc-tag-success', WARNING: 'mc-tag-warning', DANGER: 'mc-tag-danger' };
const GRADE_LABEL  = { LOW: '낮음', MEDIUM: '중간', HIGH: '높음' };
const GRADE_CLASS  = { LOW: 'mc-tag-success', MEDIUM: 'mc-tag-warning', HIGH: 'mc-tag-danger' };
const PBAR_CLASS = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

// 항목별 단순 임계값 (성별 구분 없는 fixed thresholds)
const judgeStatus = (value, warn, danger) => {
  if (value == null) return 'NORMAL';
  if (value >= danger) return 'DANGER';
  if (value >= warn)   return 'WARNING';
  return 'NORMAL';
};
const judgeBmi = (v) => {
  if (v == null) return 'NORMAL';
  if (v >= 30 || v < 18.5) return 'DANGER';
  if (v >= 25) return 'WARNING';
  return 'NORMAL';
};
const judgeBloodPressure = (sys, dia) => {
  if (sys == null && dia == null) return 'NORMAL';
  if ((sys ?? 0) >= 140 || (dia ?? 0) >= 90) return 'DANGER';
  if ((sys ?? 0) >= 120 || (dia ?? 0) >= 80) return 'WARNING';
  return 'NORMAL';
};

// 최신 검진 1건에서 표시용 results 테이블 행 구성
const buildResultsTable = (c) => {
  if (!c) return [];
  const rows = [];
  if (c.bloodPressureSystolic != null || c.bloodPressureDiastolic != null) {
    rows.push({
      category: '혈압',
      value: `${c.bloodPressureSystolic ?? '-'}/${c.bloodPressureDiastolic ?? '-'} mmHg`,
      normal: '120/80 미만',
      status: judgeBloodPressure(c.bloodPressureSystolic, c.bloodPressureDiastolic),
    });
  }
  if (c.glucose != null) {
    rows.push({
      category: '공복혈당',
      value: `${c.glucose} mg/dL`,
      normal: '100 미만',
      status: judgeStatus(c.glucose, 100, 126),
    });
  }
  if (c.totalCholesterol != null) {
    rows.push({
      category: '총콜레스테롤',
      value: `${c.totalCholesterol} mg/dL`,
      normal: '200 미만',
      status: judgeStatus(c.totalCholesterol, 200, 240),
    });
  }
  if (c.bmi != null) {
    rows.push({
      category: 'BMI',
      value: `${c.bmi}`,
      normal: '18.5 ~ 24.9',
      status: judgeBmi(c.bmi),
    });
  }
  if (c.waist != null) {
    rows.push({
      category: '허리둘레',
      value: `${c.waist} cm`,
      normal: '남 90 / 여 85 미만',
      status: judgeStatus(c.waist, 85, 90),
    });
  }
  return rows;
};

// 질병 예측 응답 → 카드용 가공 (predictionType별 최신 1건)
const PREDICTION_TYPE_LABEL = { STROKE: '뇌졸중', DIABETES: '당뇨', CARDIO: '심뇌혈관' };
const gradeToBucket = (g) => {
  const n = parseInt(g, 10);
  if (Number.isNaN(n)) return 'LOW';
  if (n <= 2) return 'LOW';
  if (n === 3) return 'MEDIUM';
  return 'HIGH';
};
const parseRatio = (s) => {
  if (s == null) return 0;
  const str = String(s);
  const num = parseFloat(str.includes('/') ? str.split('/')[0] : str);
  return Number.isNaN(num) ? 0 : num;
};
const mergeDiseases = (apiRows) => {
  if (!Array.isArray(apiRows) || apiRows.length === 0) return [];
  const latest = {};
  for (const r of apiRows) {
    if (!latest[r.predictionType]) latest[r.predictionType] = r;
  }
  return ['STROKE', 'DIABETES', 'CARDIO']
    .filter((t) => latest[t])
    .map((t) => ({
      predictionType: t,
      typeLabel: PREDICTION_TYPE_LABEL[t],
      riskGradeBucket: gradeToBucket(latest[t].riskGrade),
      riskRatio: parseRatio(latest[t].riskRatio),
      averageRatio: parseRatio(latest[t].averageRatio),
    }));
};

const yearOf = (isoDate) => {
  if (!isoDate) return null;
  const m = String(isoDate).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
};

const CheckupRecords = () => {
  const [checkups, setCheckups] = useState(MOCK_CHECKUPS);
  const [healthAge, setHealthAge] = useState(MOCK_HEALTH_AGE);
  const [diseases, setDiseases] = useState([]);
  const [selectedDate, setSelectedDate] = useState(MOCK_CHECKUPS[0]?.checkupDate);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCheckups = async () => {
      setLoading(true);
      try {
        const data = await healthAPI.getCheckupResults();
        if (Array.isArray(data) && data.length) {
          // checkupDate DESC 정렬 (백엔드가 이미 정렬해줘도 안전하게)
          const sorted = [...data].sort((a, b) =>
            String(b.checkupDate).localeCompare(String(a.checkupDate)));
          setCheckups(sorted);
          setSelectedDate(sorted[0]?.checkupDate);
        }
      } catch (error) {
        console.error('Failed to fetch checkups:', error);
      } finally {
        setLoading(false);
      }
    };
    const fetchHealthAge = async () => {
      try {
        const data = await healthAPI.getHealthAge();
        if (data && data.biologicalAge != null) setHealthAge(data);
      } catch (error) {
        // 204 No Content 등 데이터 없음 → Mock 유지
        console.warn('Health age not available:', error?.message);
      }
    };
    const fetchDiseases = async () => {
      try {
        const rows = await healthAPI.getDiseasePredictions();
        setDiseases(mergeDiseases(rows));
      } catch (error) {
        console.error('Failed to fetch disease predictions:', error);
      }
    };
    fetchCheckups();
    fetchHealthAge();
    fetchDiseases();
  }, []);

  const currentCheckup = checkups.find((c) => c.checkupDate === selectedDate) || checkups[0];
  const results = buildResultsTable(currentCheckup);

  const ageDelta = (healthAge?.biologicalAge ?? 0) - (healthAge?.chronologicalAge ?? 0);
  const isYounger = ageDelta < 0;

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">건강검진 기록</div>
          <div className="mc-page-subtitle">연도별 검진 결과와 최근 추이, 질병 위험도를 확인하세요.</div>
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
              {healthAge?.biologicalAge ?? '-'}세
            </div>
            {ageDelta !== 0 && (
              <span className={`mc-tag ${isYounger ? 'mc-tag-success' : 'mc-tag-warning'}`}>
                {ageDelta > 0 ? `+${ageDelta}세` : `${ageDelta}세`}
              </span>
            )}
          </div>
          <div className="mc-card-sub" style={{ marginTop: 8 }}>
            실제나이 {healthAge?.chronologicalAge ?? '-'}세
            {healthAge?.checkupDate ? ` · ${yearOf(healthAge.checkupDate)}년 기준` : ''}
          </div>
          {healthAge?.summaryNote && (
            <div className="mc-card-sub" style={{ marginTop: 10 }}>
              {healthAge.summaryNote}
            </div>
          )}
        </div>

        <div className="mc-grid-2">
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">혈압</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>
              {currentCheckup?.bloodPressureSystolic ?? '-'}/{currentCheckup?.bloodPressureDiastolic ?? '-'}
            </div>
            <div className="mc-stat-sub">mmHg</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">공복혈당</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup?.glucose ?? '-'}</div>
            <div className="mc-stat-sub">mg/dL</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">총콜레스테롤</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup?.totalCholesterol ?? '-'}</div>
            <div className="mc-stat-sub">mg/dL</div>
          </div>
          <div className="mc-card mc-card-body">
            <div className="mc-field-label">BMI</div>
            <div className="mc-stat-value" style={{ marginTop: 4 }}>{currentCheckup?.bmi ?? '-'}</div>
            <div className="mc-stat-sub">
              {currentCheckup?.height ?? '-'}cm · {currentCheckup?.weight ?? '-'}kg
            </div>
          </div>
        </div>
      </div>

      {/* 검진일자 탭 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">검진 일자</span>
      </div>
      <div className="mc-row-wrap">
        {checkups.map((c) => (
          <button
            key={c.checkupDate}
            className={`mc-chip ${selectedDate === c.checkupDate ? 'active' : ''}`}
            onClick={() => setSelectedDate(c.checkupDate)}
          >
            <Ic d={P.cal} size={10}/> {c.checkupDate}
          </button>
        ))}
      </div>

      {/* 검사 결과 테이블 */}
      {results.length > 0 && (
        <>
          <div className="mc-sec-head" style={{ marginTop: 18 }}>
            <span className="mc-sec-title">검사 결과</span>
            {currentCheckup?.organizationName && (
              <span className="mc-card-sub">{currentCheckup.organizationName}</span>
            )}
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
                {results.map((result, idx) => (
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

      {/* 최근 추이 (검진 데이터 기반은 다음 단계에서 동적화) */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">최근 추이 분석</span>
      </div>
      <div className="mc-card mc-card-body">
        <div className="mc-chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={checkups.slice(0, 3).map((c) => ({
                checkupDate: c.checkupDate,
                bloodPressureSystolic: c.bloodPressureSystolic,
                glucose: c.glucose,
                totalCholesterol: c.totalCholesterol,
              })).reverse()}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
              <XAxis dataKey="checkupDate" tick={{ fill: '#4A5568', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
              <YAxis tick={{ fill: '#9AA3B2', fontSize: 11 }} axisLine={{ stroke: '#DDE1EA' }}/>
              <Tooltip
                contentStyle={{
                  background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                  fontSize: 12, color: '#0D1520',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}/>
              <Bar dataKey="bloodPressureSystolic" fill="#9A6060" name="수축기혈압"/>
              <Bar dataKey="glucose"               fill="#8A7040" name="공복혈당"/>
              <Bar dataKey="totalCholesterol"      fill="#2F6FE8" name="총콜레스테롤"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 질병 위험도 */}
      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">질병 위험도</span>
      </div>
      {diseases.length === 0 ? (
        <div className="mc-card mc-card-body" style={{ textAlign: 'center', color: '#888' }}>
          예측 데이터가 없습니다.
        </div>
      ) : (
      <div className="mc-grid-auto-sm">
        {diseases.map((d) => (
          <div key={d.predictionType} className="mc-card mc-card-body">
            <div className="mc-card-head" style={{ padding: 0, border: 'none' }}>
              <div className="mc-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Ic d={P.heart} size={14}/> {d.typeLabel}
              </div>
              <span className={`mc-tag ${GRADE_CLASS[d.riskGradeBucket]}`}>
                {GRADE_LABEL[d.riskGradeBucket]}
              </span>
            </div>
            <div className="mc-kv" style={{ marginTop: 10 }}>
              <span className="mc-kv-key">3년 내 발병 확률</span>
              <span className="mc-kv-val" style={{ fontWeight: 700 }}>{d.riskRatio}%</span>
            </div>
            <div className="mc-pbar" style={{ marginTop: 8 }}>
              <div
                className={`mc-pbar-fill ${PBAR_CLASS[d.riskGradeBucket]}`}
                style={{ width: `${Math.min(d.riskRatio, 100)}%` }}
              />
            </div>
            {d.averageRatio > 0 && (
              <div className="mc-card-sub" style={{ marginTop: 6 }}>
                같은 성별·연령대 100명 중 <b>{d.averageRatio}</b>번째
              </div>
            )}
          </div>
        ))}
      </div>
      )}

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
