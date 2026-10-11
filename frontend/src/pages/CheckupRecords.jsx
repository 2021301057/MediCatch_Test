import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthAPI, insuranceAPI } from '../api/services';
import { openPrintPopup } from '../utils/printPage';
import MobileNavMenu from '../components/common/MobileNavMenu';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  cal:    (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  search: (<><circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/></>),
  shield: (<path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4z"/>),
  check:  (<path d="M3 8.5 6.5 12 13 4"/>),
  arrow:  (<><path d="M3 8h10M9 4l4 4-4 4"/></>),
  print:  (<><path d="M5 6V2h6v4"/><rect x="3" y="6" width="10" height="6" rx="1.5"/><path d="M5 11h6v3H5z"/><path d="M11.5 8h.01"/></>),
};


const STATUS_LABEL = { NORMAL: '정상', WARNING: '주의', DANGER: '경고' };
const STATUS_CLASS = { NORMAL: 'mc-tag-success', WARNING: 'mc-tag-warning', DANGER: 'mc-tag-danger' };
const CHECKUP_AVERAGE_INFO = {
  bloodPressure: '참고 평균 120/80 mmHg 미만 · 140/90 이상이면 고혈압 범위입니다.',
  glucose: '참고 평균 70~99 mg/dL · 100 이상이면 공복혈당 관리가 필요합니다.',
  totalCholesterol: '참고 평균 200 mg/dL 미만 · 240 이상이면 높음 범위입니다.',
  hdlCholesterol: '참고 평균 남 40 / 여 50 mg/dL 이상 · 낮을수록 주의가 필요합니다.',
  ldlCholesterol: '참고 평균 130 mg/dL 미만 · 160 이상이면 높음 범위입니다.',
  triglyceride: '참고 평균 150 mg/dL 미만 · 200 이상이면 높음 범위입니다.',
  bmi: '참고 평균 18.5~24.9 · 25 이상은 과체중, 30 이상은 비만 범위입니다.',
  waist: '참고 기준 남 90cm / 여 85cm 미만 · 기준 이상이면 복부비만 주의입니다.',
};
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

const buildCheckupAttention = (c) => {
  if (!c) return [];
  const alerts = [];
  const add = (label, tone = 'warning') => alerts.push({ label, tone });
  const sys = Number(c.bloodPressureSystolic);
  const dia = Number(c.bloodPressureDiastolic);
  if (Number.isFinite(sys) || Number.isFinite(dia)) {
    if (sys >= 140 || dia >= 90) add('고혈압 주의', 'danger');
    else if (sys < 90 || dia < 60) add('저혈압 주의');
    else if (sys >= 120 || dia >= 80) add('경계성 혈압');
  }
  const glucose = Number(c.glucose);
  if (Number.isFinite(glucose)) {
    if (glucose >= 126) add('당뇨 의심', 'danger');
    else if (glucose >= 100) add('혈당 주의');
    else if (glucose < 70) add('저혈당 주의');
  }
  const cholesterol = Number(c.totalCholesterol);
  if (Number.isFinite(cholesterol)) {
    if (cholesterol >= 240) add('고콜레스테롤 주의', 'danger');
    else if (cholesterol >= 200) add('콜레스테롤 관리');
  }
  const ldl = Number(c.ldlCholesterol);
  if (Number.isFinite(ldl)) {
    if (ldl >= 160) add('LDL 높음', 'danger');
    else if (ldl >= 130) add('LDL 경계');
  }
  const hdl = Number(c.hdlCholesterol);
  if (Number.isFinite(hdl) && hdl < 40) add('HDL 낮음');
  const triglyceride = Number(c.triglyceride);
  if (Number.isFinite(triglyceride)) {
    if (triglyceride >= 200) add('중성지방 높음', 'danger');
    else if (triglyceride >= 150) add('중성지방 주의');
  }
  const bmi = Number(c.bmi);
  if (Number.isFinite(bmi)) {
    if (bmi >= 30) add('비만 주의', 'danger');
    else if (bmi >= 25) add('과체중 경향');
    else if (bmi < 18.5) add('저체중 주의');
  }
  const waist = Number(c.waist);
  if (Number.isFinite(waist) && waist >= 85) add('복부비만 주의');
  return alerts;
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
      tooltip: CHECKUP_AVERAGE_INFO.bloodPressure,
    });
  }
  if (c.glucose != null) {
    rows.push({
      category: '공복혈당',
      value: `${c.glucose} mg/dL`,
      normal: '100 미만',
      status: judgeStatus(c.glucose, 100, 126),
      tooltip: CHECKUP_AVERAGE_INFO.glucose,
    });
  }
  if (c.totalCholesterol != null) {
    rows.push({
      category: '총콜레스테롤',
      value: `${c.totalCholesterol} mg/dL`,
      normal: '200 미만',
      status: judgeStatus(c.totalCholesterol, 200, 240),
      tooltip: CHECKUP_AVERAGE_INFO.totalCholesterol,
    });
  }
  if (c.hdlCholesterol != null) {
    rows.push({
      category: 'HDL콜레스테롤',
      value: `${c.hdlCholesterol} mg/dL`,
      normal: '40 이상',
      status: c.hdlCholesterol < 40 ? 'WARNING' : 'NORMAL',
      tooltip: CHECKUP_AVERAGE_INFO.hdlCholesterol,
    });
  }
  if (c.ldlCholesterol != null) {
    rows.push({
      category: 'LDL콜레스테롤',
      value: `${c.ldlCholesterol} mg/dL`,
      normal: '130 미만',
      status: judgeStatus(c.ldlCholesterol, 130, 160),
      tooltip: CHECKUP_AVERAGE_INFO.ldlCholesterol,
    });
  }
  if (c.triglyceride != null) {
    rows.push({
      category: '중성지방',
      value: `${c.triglyceride} mg/dL`,
      normal: '150 미만',
      status: judgeStatus(c.triglyceride, 150, 200),
      tooltip: CHECKUP_AVERAGE_INFO.triglyceride,
    });
  }
  if (c.bmi != null) {
    rows.push({
      category: 'BMI',
      value: `${c.bmi}`,
      normal: '18.5 ~ 24.9',
      status: judgeBmi(c.bmi),
      tooltip: CHECKUP_AVERAGE_INFO.bmi,
    });
  }
  if (c.waist != null) {
    rows.push({
      category: '허리둘레',
      value: `${c.waist} cm`,
      normal: '남 90 / 여 85 미만',
      status: judgeStatus(c.waist, 85, 90),
      tooltip: CHECKUP_AVERAGE_INFO.waist,
    });
  }
  return rows;
};

const yearOf = (isoDate) => {
  if (!isoDate) return null;
  const m = String(isoDate).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
};

const isPharmacyRecord = (record) => {
  const hospital = record.hospitalName || record.hospital || '';
  const department = record.department || '';
  return record.treatmentType === '약국'
    || record.diseaseCode === '$'
    || hospital.includes('약국')
    || department.includes('약국');
};

const isCoverageGap = (row) => {
  const self = Number(row.selfCoverageAmount || 0);
  const avg = Number(row.avgGroupCoverageAmount || 0);
  if (avg <= 0) return false;
  if (self <= 0) return true;
  return self < avg * 0.8;
};

const fmtYM = (ym) => {
  const [year, month] = ym.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
};

const compactList = (items, emptyText = '-') => (
  items.length > 0 ? items.join(' · ') : emptyText
);

const CheckupRecords = () => {
  const navigate = useNavigate();
  const [checkups, setCheckups] = useState([]);
  const [healthAge, setHealthAge] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

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
    fetchCheckups();
    fetchHealthAge();
  }, []);

  useEffect(() => {
    const fetchActivityFlow = async () => {
      try {
        const [records, comparisons] = await Promise.all([
          healthAPI.getMedicalRecords().catch(() => []),
          insuranceAPI.getCoverageComparison().catch(() => []),
        ]);
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const recentRecords = records.filter((record) => (
          record.visitDate && new Date(record.visitDate) >= cutoff
        ));
        const recentCheckups = checkups.filter((checkup) => (
          checkup.checkupDate && new Date(checkup.checkupDate) >= cutoff
        ));

        const monthMap = {};
        recentRecords.forEach((record) => {
          const ym = record.visitDate?.substring(0, 7);
          if (!ym) return;
          if (!monthMap[ym]) monthMap[ym] = { visits: 0, prescriptions: 0, checkups: 0, departments: {} };
          if (isPharmacyRecord(record)) {
            monthMap[ym].prescriptions += 1;
          } else {
            monthMap[ym].visits += 1;
            const department = record.department || '기타';
            monthMap[ym].departments[department] = (monthMap[ym].departments[department] || 0) + 1;
          }
        });
        recentCheckups.forEach((checkup) => {
          const ym = checkup.checkupDate?.substring(0, 7);
          if (!ym) return;
          if (!monthMap[ym]) monthMap[ym] = { visits: 0, prescriptions: 0, checkups: 0, departments: {} };
          monthMap[ym].checkups += 1;
        });
        setTimeline(
          Object.entries(monthMap)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([ym, value]) => ({
              ym,
              ...value,
              total: value.visits + value.prescriptions + value.checkups,
            }))
        );

        const deptCount = {};
        recentRecords.forEach((record) => {
          if (isPharmacyRecord(record)) return;
          const department = record.department || '기타';
          deptCount[department] = (deptCount[department] || 0) + 1;
        });
        const departments = Object.entries(deptCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([dept, count]) => ({ dept, count }));
        const gaps = Array.isArray(comparisons) ? comparisons.filter(isCoverageGap) : [];
        const latestCheckup = [...checkups].sort((a, b) => (
          (b.checkupDate || '').localeCompare(a.checkupDate || '')
        ))[0];

        const next = [];
        if (departments.some((item) => item.dept === '정형외과')) {
          next.push({
            icon: P.search,
            title: '정형외과 치료 전 보장 확인',
            text: '도수치료, MRI, 주사치료처럼 실손 조건이 달라지는 항목을 먼저 확인해보세요.',
            path: '/pre-treatment',
          });
        }
        if (gaps.length > 0) {
          next.push({
            icon: P.shield,
            title: '보험 공백 확인',
            text: `평균 대비 부족하거나 미가입으로 보이는 보장 ${gaps.length}개를 확인해보세요.`,
            path: '/insurance-plan',
          });
        }
        if (!latestCheckup?.checkupDate || (Date.now() - new Date(latestCheckup.checkupDate)) / 86400000 > 365) {
          next.push({
            icon: P.cal,
            title: '건강검진 기록 확인',
            text: '최근 검진 데이터가 부족하거나 1년 이상 지난 상태일 수 있습니다.',
            path: '/checkup',
          });
        }
        if (next.length === 0) {
          next.push({
            icon: P.check,
            title: '현재는 큰 확인 항목이 없어요',
            text: '진료나 검진 데이터가 새로 동기화되면 이 화면이 자동으로 더 풍부해집니다.',
            path: '/checkup',
          });
        }
        setInsights(next);
      } catch (error) {
        console.warn('Activity flow not available:', error?.message);
      }
    };
    fetchActivityFlow();
  }, [checkups]);

  const currentCheckup = checkups.find((c) => c.checkupDate === selectedDate) || checkups[0];
  const results = buildResultsTable(currentCheckup);
  const attentionItems = buildCheckupAttention(currentCheckup);

  const ageDelta = (healthAge?.biologicalAge ?? 0) - (healthAge?.chronologicalAge ?? 0);
  const isYounger = ageDelta < 0;
  const handlePDFDownload = () => {
    openPrintPopup('MediCatch 건강검진 기록');
  };

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">건강검진 기록</div>
          <div className="mc-page-subtitle">연도별 검진 결과와 주요 건강 지표를 확인하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn mc-btn-primary" type="button" onClick={handlePDFDownload}>
            <Ic d={P.print} size={12}/> PDF 출력하기
          </button>
        </div>
      </div>

      <MobileNavMenu />

      {/* 건강나이 카드 + 주요 지표 요약 */}
      <div className="mc-two-col" style={{ gridTemplateColumns: '360px 1fr' }}>
        {healthAge ? (
          <div className={`mc-card mc-card-body mc-checkup-health-age-card ${isYounger ? 'good' : 'warn'}`}>
            <div className="mc-field-label">건강나이</div>
            <div className="mc-checkup-health-age-main">
              <strong>{healthAge.biologicalAge}세</strong>
              {ageDelta !== 0 && (
                <span className={`mc-checkup-age-delta ${isYounger ? 'good' : 'warn'}`}>
                  {ageDelta > 0 ? `+${ageDelta}세` : `${ageDelta}세`}
                </span>
              )}
            </div>
            <div className="mc-checkup-health-age-sub">
              실제나이 {healthAge.chronologicalAge}세
              {healthAge.checkupDate ? ` · ${yearOf(healthAge.checkupDate)}년 기준` : ''}
            </div>
            <div className="mc-checkup-health-age-tags">
              {attentionItems.length > 0 ? (
                attentionItems.slice(0, 4).map((item) => (
                  <span key={item.label} className={`mc-checkup-attention-chip ${item.tone}`}>
                    {item.label}
                  </span>
                ))
              ) : (
                <span className="mc-checkup-attention-chip good">주요 지표 양호</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mc-card mc-card-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 140, color: '#9AA3B2' }}>
            <div className="mc-field-label">건강나이</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>-세</div>
            <div style={{ fontSize: 12 }}>건강나이 데이터가 없습니다</div>
          </div>
        )}

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
      {checkups.length === 0 ? (
        <div className="mc-card mc-card-body" style={{ textAlign: 'center', color: '#9AA3B2', padding: '24px 0' }}>
          검진 기록이 없습니다. 데이터 연동 후 표시됩니다.
        </div>
      ) : (
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
      )}

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
                    <td style={{ fontWeight: 600 }}>
                      {result.category}
                    </td>
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

      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">월별 활동 흐름</span>
        <span className="mc-card-sub">최근 12개월 활동이 있는 달만 표시합니다.</span>
      </div>
      <div className="mc-card mc-card-body">
        {timeline.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '28px 0', fontSize: 13 }}>
            최근 12개월 활동 내역이 없어요.
          </div>
        ) : (
          <div className="mc-stack-xs">
            {timeline.map((month) => {
              const topDepartments = Object.entries(month.departments)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([department, count]) => `${department} ${count}`);
              return (
                <div
                  key={month.ym}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px minmax(0, 1fr) minmax(160px, auto)',
                    gap: 12,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-soft)',
                  }}
                >
                  <span className="mc-kv-key" style={{ whiteSpace: 'nowrap' }}>{fmtYM(month.ym)}</span>
                  <div className="mc-row-wrap" style={{ gap: 6 }}>
                    {month.visits > 0 && (
                      <span className="mc-tag mc-tag-blue">진료 {month.visits}</span>
                    )}
                    {month.prescriptions > 0 && (
                      <span className="mc-tag mc-tag-success">처방 {month.prescriptions}</span>
                    )}
                    {month.checkups > 0 && (
                      <span className="mc-tag mc-tag-warning">검진 {month.checkups}</span>
                    )}
                    {month.total === 0 && (
                      <span className="mc-card-sub">활동 없음</span>
                    )}
                  </div>
                  <div
                    className="mc-card-sub"
                    style={{
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {compactList(topDepartments)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mc-sec-head" style={{ marginTop: 18 }}>
        <span className="mc-sec-title">다음 확인할 것</span>
      </div>
      <div className="mc-grid-auto-md">
        {insights.map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            className="mc-card mc-card-head"
            style={{ padding: '16px', cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start' }}
            onClick={() => navigate(item.path)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: 'var(--blue-soft)',
                color: 'var(--blue)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Ic d={item.icon} size={14}/>
              </div>
              <div>
                <div className="mc-card-title" style={{ fontSize: 13.5 }}>{item.title}</div>
                <div className="mc-card-sub" style={{ marginTop: 4, lineHeight: 1.5 }}>{item.text}</div>
              </div>
            </div>
            <Ic d={P.arrow} size={13}/>
          </button>
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
