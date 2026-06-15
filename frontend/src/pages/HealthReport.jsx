import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { healthAPI, insuranceAPI } from '../api/services';
import { openPrintPopup } from '../utils/printPage';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  calendar: (<><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></>),
  arrow:    (<><path d="M3 8h10M9 4l4 4-4 4"/></>),
  shield:   (<path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4z"/>),
  search:   (<><circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/></>),
  check:    (<path d="M3 8.5 6.5 12 13 4"/>),
  chev:     (<path d="M4 6l4 4 4-4"/>),
  print:    (<><path d="M5 6V2h6v4"/><rect x="3" y="6" width="10" height="6" rx="1.5"/><path d="M5 11h6v3H5z"/><path d="M11.5 8h.01"/></>),
};

const RISK_COLOR = { '나쁨': '#9A6060', '보통': '#8A7040', '좋음': '#2F6FE8', '-': 'var(--text-2)' };
const DISEASE_KR = { STROKE: '뇌졸중', DIABETES: '당뇨', CARDIO: '심뇌혈관' };
const OVERALL_RISK_LABEL = {
  '나쁨': '전체 위험도 높음',
  '보통': '전체 위험도 보통',
  '좋음': '전체 위험도 낮음',
  '-': '전체 위험도 확인 필요',
};
const FACTOR_STATUS_LABEL = {
  '나쁨': '관리 필요',
  '보통': '주의',
  '좋음': '양호',
  '-': '요인',
};
const FACTOR_STATUS_COLOR = {
  '관리 필요': '#9A6060',
  '주의': '#8A7040',
  '양호': '#2F6FE8',
  '요인': 'var(--text-2)',
};

const parseNumber = (value) => {
  if (value == null || value === '') return null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const normalizeGrade = (value) => {
  if (!value) return null;
  const text = String(value).trim().toUpperCase();
  if (['나쁨', '높음', '위험', 'HIGH', 'BAD', '5', '4'].includes(text)) return '나쁨';
  if (['보통', '중간', 'MEDIUM', 'MID', 'NORMAL', '3'].includes(text)) return '보통';
  if (['좋음', '낮음', 'LOW', 'GOOD', '1', '2'].includes(text)) return '좋음';
  return null;
};

const gradeFromValue = (value) => {
  const n = parseNumber(value);
  if (n == null || Number.isNaN(n)) return '-';
  if (n >= 67) return '나쁨';
  if (n >= 34) return '보통';
  return '좋음';
};

const gradeFromPrediction = (prediction) => (
  normalizeGrade(prediction?.riskGrade)
  || normalizeGrade(prediction?.grade)
  || gradeFromValue(prediction?.riskRatio ?? prediction?.averageRatio)
);

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

const firstText = (...values) => (
  values.find((value) => value != null && String(value).trim() !== '') || ''
);

const factorName = (factor) => firstText(
  factor.riskFactor,
  factor.factorName,
  factor.name,
  factor.title,
  factor.itemName,
  factor.resRiskFactor,
  factor.resName,
  factor.resTitle,
  factor.resItem
);

const factorCurrent = (factor) => firstText(
  factor.currentState,
  factor.currentValue,
  factor.myAmount,
  factor.value,
  factor.resState,
  factor.resCurrent,
  factor.resValue,
  factor.resAmount
);

const factorAverage = (factor) => firstText(
  factor.averageValue,
  factor.averageAmount,
  factor.avgValue,
  factor.resAverage,
  factor.resAvg
);

const factorSeverity = (factor) => (
  normalizeGrade(factor.severityType)
  || normalizeGrade(factor.severity)
  || normalizeGrade(factor.resType)
  || '-'
);

const factorStatusLabel = (factor) => FACTOR_STATUS_LABEL[factorSeverity(factor)] || '요인';

const RiskBadge = ({ grade }) => {
  const label = OVERALL_RISK_LABEL[grade] || OVERALL_RISK_LABEL['-'];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      borderRadius: 9999,
      padding: '4px 9px',
      background: grade === '나쁨' ? '#F2ECEC' : grade === '보통' ? '#F4EFDE' : 'var(--blue-soft)',
      color: RISK_COLOR[grade] || 'var(--text-2)',
      fontSize: 11.5,
      fontWeight: 800,
      lineHeight: 1,
    }}>
      {label}
    </span>
  );
};

const FactorStatus = ({ status }) => (
  <span style={{
    display: 'inline-flex',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    color: FACTOR_STATUS_COLOR[status] || 'var(--text-2)',
    fontSize: 12,
    fontWeight: 700,
  }}>
    {status}
  </span>
);

const factorLine = (factor) => {
  const name = factorName(factor);
  const current = factorCurrent(factor);
  const average = factorAverage(factor);
  if (!name) return '';
  if (current && average) return `${name} (${current} / 평균 ${average})`;
  if (current) return `${name} (${current})`;
  return name;
};

const healthAgeFactorLine = (factor) => (
  firstText(
    factorLine(factor),
    factor.message,
    factor.contents,
    factor.description,
    factor.resContents,
    factor.resMessage
  )
);

const compactDate = (date) => String(date || '').slice(0, 10);

const buildCheckupTrend = (checkups) => (
  [...checkups]
    .filter((item) => item.checkupDate)
    .sort((a, b) => String(a.checkupDate).localeCompare(String(b.checkupDate)))
    .slice(-3)
    .map((item) => ({
      date: compactDate(item.checkupDate),
      bloodPressure: parseNumber(item.bloodPressureSystolic) || 0,
      glucose: parseNumber(item.glucose) || 0,
      cholesterol: parseNumber(item.totalCholesterol) || 0,
    }))
);

const RISK_TREND_KEY = {
  STROKE: 'stroke',
  DIABETES: 'diabetes',
  CARDIO: 'cardio',
};

const buildRiskTrend = (predictions) => {
  const byYear = {};
  predictions.forEach((prediction) => {
    const key = RISK_TREND_KEY[prediction.predictionType];
    if (!key) return;
    const compares = Array.isArray(prediction.compares) && prediction.compares.length > 0
      ? prediction.compares
      : [{ year: new Date().getFullYear(), predictedState: prediction.riskRatio }];
    compares.forEach((item) => {
      const year = String(item.year || '').slice(0, 4);
      if (!year) return;
      if (!byYear[year]) byYear[year] = { year };
      byYear[year][key] = parseNumber(item.predictedState ?? item.riskRatio) || 0;
    });
  });
  return Object.values(byYear).sort((a, b) => String(a.year).localeCompare(String(b.year))).slice(-3);
};

const LinkBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--blue)',
    fontWeight: 600,
  }}>
    {children}
  </button>
);

const Metric = ({ label, value, sub, tone }) => (
  <div className="mc-report-metric">
    <div className="mc-report-metric-label">{label}</div>
    <div className="mc-report-metric-value" style={{ color: tone || 'var(--text-1)' }}>{value}</div>
    {sub && <div className="mc-report-metric-sub">{sub}</div>}
  </div>
);

const HEALTH_MBTI_QUESTIONS = [
  {
    key: 'meal',
    title: '평소 식사는 어떤 편인가요?',
    options: [
      { value: 'fresh', label: '균형 있게 챙겨요', desc: '채소, 단백질, 탄수화물을 비교적 고르게 먹어요.' },
      { value: 'quick', label: '간편식이 잦아요', desc: '바쁠 때 외식이나 간편식으로 해결하는 편이에요.' },
      { value: 'skip', label: '끼니를 자주 놓쳐요', desc: '식사 시간이 불규칙하고 거르는 날이 있어요.' },
    ],
  },
  {
    key: 'protein',
    title: '단백질 섭취는 충분한 편인가요?',
    options: [
      { value: 'protein_ok', label: '매끼 조금씩 챙겨요', desc: '달걀, 생선, 두부, 고기, 콩류를 자주 먹어요.' },
      { value: 'protein_low', label: '탄수화물 위주가 많아요', desc: '밥, 면, 빵으로 때우는 날이 잦아요.' },
      { value: 'protein_unsure', label: '잘 모르겠어요', desc: '특별히 계산해서 먹지는 않아요.' },
    ],
  },
  {
    key: 'activity',
    title: '활동량은 어느 쪽에 가까운가요?',
    options: [
      { value: 'active', label: '주 3회 이상 움직여요', desc: '운동이나 걷기를 의식적으로 해요.' },
      { value: 'light', label: '가벼운 산책 정도예요', desc: '꾸준하진 않지만 움직이려고 해요.' },
      { value: 'still', label: '앉아있는 시간이 길어요', desc: '하루 대부분을 책상 앞에서 보내요.' },
    ],
  },
  {
    key: 'sleep',
    title: '수면 리듬은 어떤가요?',
    options: [
      { value: 'regular', label: '비교적 규칙적이에요', desc: '자는 시간과 일어나는 시간이 안정적이에요.' },
      { value: 'late', label: '늦게 자는 편이에요', desc: '야간 활동이나 작업이 많은 편이에요.' },
      { value: 'short', label: '수면 시간이 부족해요', desc: '피로가 누적되는 날이 많아요.' },
    ],
  },
  {
    key: 'stress',
    title: '스트레스 관리는 어떤 편인가요?',
    options: [
      { value: 'release', label: '해소 루틴이 있어요', desc: '산책, 취미, 휴식으로 풀어요.' },
      { value: 'hold', label: '참다가 한 번에 풀어요', desc: '쌓인 뒤에야 쉬는 편이에요.' },
      { value: 'high', label: '요즘 계속 높은 편이에요', desc: '긴장 상태가 오래 이어져요.' },
    ],
  },
  {
    key: 'mood',
    title: '최근 2주간 마음 상태는 어떤가요?',
    options: [
      { value: 'mood_ok', label: '대체로 괜찮아요', desc: '기분이 크게 무너지지는 않아요.' },
      { value: 'anxious', label: '걱정과 긴장이 많아요', desc: '생각이 많고 쉽게 쉬지 못해요.' },
      { value: 'down', label: '의욕이 낮은 날이 많아요', desc: '흥미가 줄거나 무기력한 날이 많아요.' },
    ],
  },
];

const getHealthMbtiResult = (answers) => {
  const values = Object.values(answers);
  const routineScore = ['fresh', 'regular', 'release'].filter((v) => values.includes(v)).length;
  const activeScore = ['active', 'light'].includes(answers.activity) ? 1 : 0;
  const nourishScore = ['fresh', 'protein_ok'].filter((v) => values.includes(v)).length;
  const pressureScore = ['quick', 'skip', 'protein_low', 'late', 'short', 'hold', 'high', 'anxious', 'down'].filter((v) => values.includes(v)).length;
  const type = `${routineScore >= 2 ? 'R' : 'F'}${activeScore ? 'A' : 'S'}${nourishScore >= 2 ? 'N' : 'T'}${pressureScore >= 3 ? 'P' : 'B'}`;

  const nutrients = [];
  if (['protein_low', 'protein_unsure'].includes(answers.protein) || ['quick', 'skip'].includes(answers.meal)) {
    nutrients.push({ name: '단백질', reason: '식사가 불규칙하거나 탄수화물 위주일 때 부족해지기 쉬워요.', supplement: '두부, 달걀, 생선, 단백질 보충식' });
  }
  if (['high', 'hold'].includes(answers.stress) || ['short', 'late'].includes(answers.sleep)) {
    nutrients.push({ name: '마그네슘', reason: '긴장과 수면 부족이 반복될 때 관리 후보가 될 수 있어요.', supplement: '견과류, 녹색 채소, 마그네슘' });
  }
  if (answers.activity === 'still') {
    nutrients.push({ name: '비타민 D', reason: '활동량과 야외 노출이 줄면 부족 신호가 생기기 쉬워요.', supplement: '낮 시간 산책, 비타민 D' });
  }
  if (nutrients.length === 0) {
    nutrients.push({ name: '기본 균형 유지', reason: '현재 응답상 큰 결핍 신호는 적어요.', supplement: '수분, 단백질, 채소 섭취 유지' });
  }

  const needsRecovery = type.endsWith('P');
  const isStill = type[1] === 'S';
  const isBalanced = type.includes('R') && type.includes('A') && type.includes('N') && type.includes('B');
  const base = isBalanced ? {
    title: '루틴 밸런서형',
    tone: 'blue',
    summary: '식사, 활동, 휴식의 기본 루틴이 안정적인 편이에요.',
    tips: ['정기 검진 수치를 계속 추적해보세요.', '근력 운동을 조금 더하면 균형이 좋아져요.', '무리한 관리보다 지속 가능한 습관을 유지하세요.'],
  } : needsRecovery ? {
    title: '회복 우선형',
    tone: 'amber',
    summary: '건강 관리보다 피로와 스트레스 회복이 먼저 필요한 타입이에요.',
    tips: ['수면 시간을 먼저 고정해보세요.', '카페인 시간을 조금 앞당겨보세요.', '하루 10분 산책처럼 작은 회복 루틴부터 시작하세요.'],
  } : isStill ? {
    title: '저활동 보완형',
    tone: 'green',
    summary: '식습관은 괜찮아도 활동량이 부족해지기 쉬운 타입이에요.',
    tips: ['식후 10분 걷기를 붙여보세요.', '엘리베이터 대신 계단 1층부터 시작해보세요.', '주 2회 가벼운 근력 루틴을 추천해요.'],
  } : {
    title: '습관 리빌드형',
    tone: 'violet',
    summary: '좋은 습관과 흔들리는 습관이 섞여 있어 재정비 효과가 큰 타입이에요.',
    tips: ['식사, 수면, 활동 중 하나만 먼저 고정해보세요.', '주간 목표를 작게 잡으면 성공률이 높아요.', '건강 리포트의 변화를 한 달 단위로 확인해보세요.'],
  };

  const mindHealth = answers.mood === 'down'
    ? '우울감이나 무기력이 2주 이상 이어진다면 혼자 버티기보다 상담센터나 전문가 상담을 권장해요. 이 결과는 진단이 아니라 도움 신호예요.'
    : answers.mood === 'anxious'
      ? '걱정과 긴장이 오래 지속된다면 짧은 안정 루틴을 만들고, 일상 기능이 흔들리면 상담을 받아보는 것이 좋아요.'
      : '마음 건강 신호는 비교적 안정적으로 보여요. 지금의 회복 루틴을 유지해보세요.';

  return { type, ...base, nutrients: nutrients.slice(0, 3), mindHealth };
};

const HealthReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    visits: 0,
    checkups: 0,
    prescriptions: 0,
    gaps: 0,
    topDepartment: '-',
    topDiagnosis: '-',
    lastCheckupHeadline: '',
  });
  const [timeline, setTimeline] = useState([]);
  const [deptPattern, setDeptPattern] = useState([]);
  const [diagKeywords, setDiagKeywords] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [checkupTrend, setCheckupTrend] = useState([]);
  const [riskTrend, setRiskTrend] = useState([]);
  const [healthAge, setHealthAge] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loadWarning, setLoadWarning] = useState('');
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [showHealthAgeModal, setShowHealthAgeModal] = useState(false);
  const [showMbtiModal, setShowMbtiModal] = useState(false);
  const [mbtiStep, setMbtiStep] = useState(0);
  const [mbtiAnswers, setMbtiAnswers] = useState({});
  const [mbtiResult, setMbtiResult] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadWarning('');
      try {
        const [records, checkups, preds, hAge, comparisons] = await Promise.all([
          healthAPI.getMedicalRecords().catch(() => {
            setLoadWarning('일부 건강 데이터를 불러오지 못했습니다.');
            return [];
          }),
          healthAPI.getCheckupResults().catch(() => []),
          healthAPI.getDiseasePredictions().catch(() => []),
          healthAPI.getHealthAge().catch(() => null),
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

        const prescriptions = recentRecords.filter(isPharmacyRecord).length;
        const gaps = Array.isArray(comparisons) ? comparisons.filter(isCoverageGap) : [];

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

        const diagnosisCount = {};
        recentRecords.forEach((record) => {
          if (isPharmacyRecord(record)) return;
          if (!record.diagnosis || record.diagnosis === '해당없음') return;
          diagnosisCount[record.diagnosis] = (diagnosisCount[record.diagnosis] || 0) + 1;
        });
        const diagnoses = Object.entries(diagnosisCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([diagnosis, count]) => ({ diagnosis, count }));

        const latestCheckup = [...checkups].sort((a, b) => (
          (b.checkupDate || '').localeCompare(a.checkupDate || '')
        ))[0];
        const lastCheckupHeadline = firstText(
          latestCheckup?.abnormalFindings,
          latestCheckup?.recommendations
        );

        setStats({
          visits: recentRecords.length,
          checkups: recentCheckups.length,
          prescriptions,
          gaps: gaps.length,
          topDepartment: departments[0]?.dept || '-',
          topDiagnosis: diagnoses[0]?.diagnosis || '-',
          lastCheckupHeadline,
        });
        setDeptPattern(departments);
        setDiagKeywords(diagnoses);

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

        const latestPredictions = {};
        preds.forEach((prediction) => {
          const key = prediction.predictionType;
          if (!key) return;
          if (!latestPredictions[key] || prediction.checkupDate > latestPredictions[key].checkupDate) {
            latestPredictions[key] = prediction;
          }
        });
        const predictionList = Object.values(latestPredictions);
        setPredictions(predictionList);
        setCheckupTrend(buildCheckupTrend(checkups));
        setRiskTrend(buildRiskTrend(predictionList));
        setHealthAge(hAge);

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
            icon: P.calendar,
            title: '건강검진 기록 확인',
            text: '최근 검진 데이터가 부족하거나 1년 이상 지난 상태일 수 있습니다.',
            path: '/checkup',
          });
        }
        if (next.length === 0) {
          next.push({
            icon: P.check,
            title: '현재는 큰 확인 항목이 없어요',
            text: '진료나 검진 데이터가 새로 동기화되면 리포트가 자동으로 더 풍부해집니다.',
            path: '/checkup',
          });
        }
        setInsights(next);
      } catch (error) {
        console.error('HealthReport error:', error);
        setLoadWarning('건강 리포트를 불러오는 중 문제가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasAnyData = stats.visits > 0
    || stats.checkups > 0
    || stats.prescriptions > 0
    || predictions.length > 0
    || healthAge
    || stats.gaps > 0;

  const summaryItems = (() => {
    if (!hasAnyData) {
      return [{ label: '데이터', value: '대기 중', text: '최근 12개월 건강 데이터가 아직 충분하지 않습니다.' }];
    }
    const items = [];
    if (stats.topDepartment !== '-') {
      items.push({ label: '주요 방문', value: stats.topDepartment });
    }
    if (stats.topDiagnosis !== '-') {
      items.push({ label: '반복 기록', value: stats.topDiagnosis });
    }
    if (stats.lastCheckupHeadline) {
      items.push({ label: '검진 소견', value: stats.lastCheckupHeadline });
    }
    if (stats.gaps > 0) {
      items.push({ label: '보험 점검', value: `${stats.gaps}개`, tone: 'warn' });
    }
    return items.length > 0
      ? items
      : [{ label: '요약', value: '활동 안정', text: '최근 12개월 건강 활동이 안정적으로 정리되었습니다.' }];
  })();

  const healthAgeDiff = healthAge && healthAge.biologicalAge != null && healthAge.chronologicalAge != null
    ? Number(healthAge.biologicalAge) - Number(healthAge.chronologicalAge)
    : null;
  const healthAgeGuidance = healthAgeDiff == null
    ? ''
    : healthAgeDiff <= 0
      ? '좋은 흐름이에요. 지금처럼 식사, 활동, 수면 리듬을 꾸준히 유지해보세요.'
      : '건강 관리 신호가 보여요. 혈압, 혈당, 체중 지표부터 차분히 점검해보세요.';

  const healthAgeFactors = Array.isArray(healthAge?.factors) ? healthAge.factors : [];
  const currentMbtiQuestion = HEALTH_MBTI_QUESTIONS[mbtiStep];
  const mbtiProgress = Math.round(((mbtiStep + 1) / HEALTH_MBTI_QUESTIONS.length) * 100);

  const openMbtiSurvey = () => {
    if (!mbtiResult) {
      setMbtiStep(0);
      setMbtiAnswers({});
    }
    setShowMbtiModal(true);
  };

  const selectMbtiAnswer = (value) => {
    const nextAnswers = { ...mbtiAnswers, [currentMbtiQuestion.key]: value };
    setMbtiAnswers(nextAnswers);
    if (mbtiStep < HEALTH_MBTI_QUESTIONS.length - 1) {
      setMbtiStep((step) => step + 1);
      return;
    }
    setMbtiResult(getHealthMbtiResult(nextAnswers));
  };

  const resetMbtiSurvey = () => {
    setMbtiResult(null);
    setMbtiAnswers({});
    setMbtiStep(0);
  };

  const handlePDFDownload = () => {
    openPrintPopup('MediCatch 건강 리포트');
  };

  return (
    <>
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">건강 리포트</div>
          <div className="mc-page-subtitle">진료, 검진, 보험 점검 흐름을 한 곳에서 확인하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn mc-health-mbti-top-btn" type="button" onClick={openMbtiSurvey}>
            건강 MBTI
          </button>
          <button className="mc-btn mc-btn-primary" type="button" onClick={handlePDFDownload}>
            <Ic d={P.print} size={12}/> PDF 출력하기
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mc-alert mc-alert-blue" style={{ marginTop: 8 }}>
          <div>
            <div className="mc-alert-title">데이터 불러오는 중...</div>
            <div className="mc-alert-body">최근 건강 활동을 정리하고 있습니다.</div>
          </div>
        </div>
      ) : (
        <div className="mc-stack-md">
          {loadWarning && (
            <div className="mc-alert mc-alert-warning">
              <div>
                <div className="mc-alert-title">일부 데이터 확인 필요</div>
                <div className="mc-alert-body">{loadWarning}</div>
              </div>
            </div>
          )}

          {!hasAnyData && (
            <div className="mc-alert mc-alert-blue">
              <div>
                <div className="mc-alert-title">최근 건강 데이터가 아직 없어요</div>
                <div className="mc-alert-body">
                  내 건강 불러오기를 실행하거나 건강검진/진료 기록을 동기화하면 이 화면이 채워집니다.
                </div>
              </div>
            </div>
          )}

          <section>
            <div className="mc-sec-head">
              <span className="mc-sec-title">최근 12개월 요약</span>
            </div>
            <div className="mc-card mc-report-summary-card mc-report-panel">
              <div className="mc-report-metric-grid">
                <Metric label="진료" value={`${stats.visits}회`} sub="병원 방문" />
                <Metric label="검진" value={`${stats.checkups}건`} sub="건강검진" />
                <Metric label="처방" value={`${stats.prescriptions}건`} sub="약국 기록" />
                <Metric
                  label="보험 공백"
                  value={`${stats.gaps}건`}
                  sub="평균 대비 부족"
                  tone={stats.gaps > 0 ? '#9A6060' : '#2F6FE8'}
                />
              </div>
              <div className="mc-report-insight-grid">
                {summaryItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className={`mc-report-insight ${item.tone || ''}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.text && <small>{item.text}</small>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mc-report-hero-chart">
            <div className="mc-sec-head">
              <span className="mc-sec-title">검진 수치 추이</span>
              <span className="mc-card-sub">건강검진 기록에서 가져온 변화 흐름입니다.</span>
            </div>
            <div className="mc-card mc-card-body mc-chart-rise mc-report-chart-card">
              {checkupTrend.length < 2 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '72px 0', fontSize: 13 }}>
                  추이 분석을 위한 검진 데이터가 부족합니다.
                </div>
              ) : (
                <div className="mc-chart-wrap mc-chart-wrap-lg">
                  <ResponsiveContainer width="100%" height={390}>
                    <BarChart
                      data={checkupTrend}
                      margin={{ top: 14, right: 18, left: 2, bottom: 4 }}
                      barGap={7}
                      barCategoryGap="26%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
                      <XAxis dataKey="date" tick={{ fill: '#4A5568', fontSize: 12 }} axisLine={{ stroke: '#DDE1EA' }}/>
                      <YAxis tick={{ fill: '#9AA3B2', fontSize: 12 }} axisLine={{ stroke: '#DDE1EA' }}/>
                      <Tooltip
                        contentStyle={{
                          background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                          fontSize: 12, color: '#0D1520',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}/>
                      <Bar dataKey="bloodPressure" fill="#B95F72" fillOpacity={0.92} name="수축기혈압" barSize={38} radius={[4, 4, 0, 0]}/>
                      <Bar dataKey="glucose" fill="#3FA79A" fillOpacity={0.92} name="공복혈당" barSize={38} radius={[4, 4, 0, 0]}/>
                      <Bar dataKey="cholesterol" fill="#2F8ED8" fillOpacity={0.94} name="총콜레스테롤" barSize={38} radius={[4, 4, 0, 0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mc-two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <div className="mc-sec-head">
                  <span className="mc-sec-title">검진 기반 건강 지표</span>
                  <LinkBtn onClick={() => navigate('/checkup')}>검진 기록 보기 →</LinkBtn>
                </div>
                <div className="mc-card mc-card-body mc-report-panel mc-report-info-card mc-report-health-age-card">
                  <div className="mc-report-health-age-inner">
                    <div className="mc-report-health-age-main">
                      {healthAge && healthAge.biologicalAge != null ? (
                        <>
                          <div className="mc-report-health-age-primary">
                            <div className="mc-field-label">건강나이</div>
                            <div className="mc-report-health-age-value">
                              <span>
                                {healthAge.biologicalAge}세
                              </span>
                              {healthAgeDiff != null && (
                                <b className={healthAgeDiff > 0 ? 'warn' : 'good'}>
                                  {healthAgeDiff > 0 ? `+${healthAgeDiff}세` : healthAgeDiff < 0 ? `${healthAgeDiff}세` : '동일'}
                                </b>
                              )}
                            </div>
                            {healthAge.summaryNote && (
                              <div className="mc-report-health-age-note">
                                {healthAge.summaryNote}
                              </div>
                            )}
                            {healthAgeGuidance && (
                              <div className={`mc-report-health-age-guidance ${healthAgeDiff > 0 ? 'warn' : 'good'}`}>
                                {healthAgeGuidance}
                              </div>
                            )}
                          </div>
                          <div className="mc-report-health-age-side">
                            {healthAge.chronologicalAge != null && (
                              <div className="mc-report-health-age-meta">
                                <span>실제 나이</span>
                                <strong>{healthAge.chronologicalAge}세</strong>
                              </div>
                            )}
                            <div className="mc-report-health-age-meta">
                              <span>나이 차이</span>
                              <strong className={healthAgeDiff > 0 ? 'warn' : 'good'}>
                                {healthAgeDiff > 0 ? `+${healthAgeDiff}세` : healthAgeDiff < 0 ? `${healthAgeDiff}세` : '0세'}
                              </strong>
                            </div>
                            {(healthAge.detailMessage || healthAge.changeAfterMessage || healthAgeFactors.length > 0) && (
                              <button
                                type="button"
                                onClick={() => setShowHealthAgeModal(true)}
                                className="mc-report-health-age-link"
                              >
                                건강나이 이유 보기
                                <Ic d={P.arrow} size={11}/>
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mc-card-sub" style={{ marginTop: 12 }}>건강나이 데이터가 없어요.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mc-sec-head">
                  <span className="mc-sec-title">건강 활동 패턴</span>
                  <LinkBtn onClick={() => navigate('/medical-records')}>진료 기록 보기 →</LinkBtn>
                </div>
                <div className="mc-card mc-card-body mc-report-panel mc-report-info-card">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    <div>
                      <div className="mc-field-label">자주 방문한 진료과</div>
                      {deptPattern.length === 0 ? (
                        <div className="mc-card-sub" style={{ marginTop: 10 }}>진료과 패턴이 없어요.</div>
                      ) : (
                        <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                          {deptPattern.slice(0, 4).map(({ dept, count }) => (
                            <div key={dept} className="mc-kv">
                              <span className="mc-kv-key">{dept}</span>
                              <span className="mc-tag">{count}회</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mc-field-label">반복된 진단</div>
                      {diagKeywords.length === 0 ? (
                        <div className="mc-card-sub" style={{ marginTop: 10 }}>반복 진단이 없어요.</div>
                      ) : (
                        <div className="mc-stack-xs" style={{ marginTop: 10 }}>
                          {diagKeywords.slice(0, 4).map(({ diagnosis, count }) => (
                            <div key={diagnosis} className="mc-kv">
                              <span className="mc-kv-key" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {diagnosis}
                              </span>
                              <span className="mc-tag">{count}회</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mc-print-hide">
            <div className="mc-sec-head">
              <span className="mc-sec-title">건강 MBTI</span>
              <span className="mc-card-sub">생활습관 기반 건강 타입을 확인하세요.</span>
            </div>
            <div className="mc-card mc-health-mbti-card mc-health-mbti-wide">
              <div className="mc-health-mbti-orb">{mbtiResult ? mbtiResult.type : 'MBTI'}</div>
              <div className="mc-health-mbti-body">
                <div className="mc-health-mbti-copy">
                  <div className="mc-health-mbti-kicker">생활습관 설문</div>
                  <div className="mc-health-mbti-title">{mbtiResult ? mbtiResult.title : '나의 건강 타입'}</div>
                  <p>{mbtiResult ? mbtiResult.summary : '식습관, 활동량, 수면 리듬을 선택하고 나의 건강 타입을 확인해보세요.'}</p>
                </div>
                <button className="mc-btn mc-btn-primary" type="button" onClick={openMbtiSurvey}>
                  {mbtiResult ? '결과 보기' : '설문 시작하기'}
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="mc-sec-head">
              <span className="mc-sec-title">질병 위험도 및 추이</span>
              <span className="mc-card-sub">현재 위험도와 연도별 변화를 함께 확인하세요.</span>
            </div>
            <div className="mc-two-col mc-report-risk-grid" style={{ gridTemplateColumns: 'minmax(320px, 0.85fr) minmax(0, 1.35fr)' }}>
              <div className="mc-stack-sm">
                <div className="mc-card mc-card-body mc-report-panel mc-report-risk-list-card">
                  <div className="mc-field-label" style={{ marginBottom: 12 }}>질병 위험도</div>
                  {predictions.length === 0 ? (
                    <div className="mc-card-sub" style={{ padding: '36px 0', textAlign: 'center' }}>
                      질병 예측 데이터가 없어요.
                    </div>
                  ) : (
                    <div className="mc-stack-xs">
                      {predictions.map((prediction) => {
                        const grade = gradeFromPrediction(prediction);
                        const factors = Array.isArray(prediction.factors) ? prediction.factors : [];
                        const compares = Array.isArray(prediction.compares) ? prediction.compares : [];
                        const key = prediction.predictionType;
                        const preview = factors.map(factorLine).filter(Boolean).slice(0, 2);
                        const isOpen = expandedRisk === key;
                        const needsCareCount = factors.filter((factor) => factorSeverity(factor) === '나쁨').length;

                        return (
                          <div
                            key={key}
                            className="mc-report-risk-item"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedRisk(isOpen ? null : key)}
                              className="mc-report-risk-toggle"
                            >
                              <span className="mc-report-risk-copy">
                                <span className="mc-report-risk-name">
                                  {DISEASE_KR[key] || key}
                                </span>
                                {preview.length > 0 && (
                                  <span className="mc-report-risk-preview">
                                    관리 요인: {compactList(preview)}
                                  </span>
                                )}
                              </span>
                              <span className="mc-report-risk-side">
                                <RiskBadge grade={grade} />
                                <span style={{ color: 'var(--text-3)', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}>
                                  <Ic d={P.chev} size={12}/>
                                </span>
                              </span>
                            </button>

                            {isOpen && (
                              <div className="mc-stack-xs" style={{ marginTop: 12 }}>
                                <div className="mc-card-sub" style={{ lineHeight: 1.55 }}>
                                  현재 수치 기준으로 판단한 예측 위험도입니다.
                                  {needsCareCount > 0 ? ` 관리 필요 요인 ${needsCareCount}개가 확인됐습니다.` : ''}
                                </div>
                                {factors.length > 0 ? (
                                  factors.slice(0, 5).map((factor, index) => {
                                    const line = factorLine(factor);
                                    if (!line) return null;
                                    const status = factorStatusLabel(factor);
                                    return (
                                      <div
                                        key={`${line}-${index}`}
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: '74px minmax(0, 1fr)',
                                          gap: 12,
                                          alignItems: 'start',
                                        }}
                                      >
                                        <FactorStatus status={status !== '요인' ? status : `요인 ${index + 1}`} />
                                        <span style={{
                                          minWidth: 0,
                                          fontSize: 13,
                                          fontWeight: 700,
                                          color: 'var(--text-1)',
                                          lineHeight: 1.45,
                                          wordBreak: 'keep-all',
                                        }}>
                                          {line}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="mc-card-sub">상세 위험요인 데이터가 없어요.</div>
                                )}
                                {compares.length > 0 && (
                                  <div style={{
                                    marginTop: 6,
                                    padding: '10px 12px',
                                    borderRadius: 6,
                                    background: '#FAFBFD',
                                    border: '1px solid var(--border-soft)',
                                  }}>
                                    <div className="mc-field-label" style={{ marginBottom: 6 }}>향후 예측 참고</div>
                                    <div className="mc-card-sub" style={{ lineHeight: 1.5 }}>
                                      {compares.map((item) => `${item.year}년 ${item.predictedState}`).join(' → ')}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              <div className="mc-card mc-card-body mc-chart-rise mc-chart-rise-delay mc-report-chart-card">
                <div className="mc-field-label" style={{ marginBottom: 12 }}>질병 위험도 추이</div>
                {riskTrend.length < 2 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '72px 0', fontSize: 13 }}>
                    위험도 추이 데이터가 부족합니다.
                  </div>
                ) : (
                  <div className="mc-chart-wrap mc-chart-wrap-lg">
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={riskTrend} margin={{ top: 14, right: 18, left: 2, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EBEEF4"/>
                        <XAxis dataKey="year" tick={{ fill: '#4A5568', fontSize: 12 }} axisLine={{ stroke: '#DDE1EA' }}/>
                        <YAxis tick={{ fill: '#9AA3B2', fontSize: 12 }} axisLine={{ stroke: '#DDE1EA' }}/>
                        <Tooltip
                          contentStyle={{
                            background: '#fff', border: '1px solid #DDE1EA', borderRadius: 6,
                            fontSize: 12, color: '#0D1520',
                          }}
                          formatter={(value) => [`${value}%`, '발병 확률']}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#4A5568' }}/>
                        <Line type="monotone" dataKey="stroke" stroke="#9A6060" name="뇌졸중" strokeWidth={2.4} dot={{ r: 3.5 }}/>
                        <Line type="monotone" dataKey="diabetes" stroke="#8A7040" name="당뇨" strokeWidth={2.4} dot={{ r: 3.5 }}/>
                        <Line type="monotone" dataKey="cardio" stroke="#2F6FE8" name="심뇌혈관" strokeWidth={2.4} dot={{ r: 3.5 }}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      )}
    </div>

      {showHealthAgeModal && (
        <div className="mc-modal-backdrop mc-health-age-backdrop mc-print-hide" onClick={() => setShowHealthAgeModal(false)}>
          <div className="mc-modal mc-health-age-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mc-modal-head">
              <div>
                <div className="mc-modal-title">건강나이 이유</div>
                <div className="mc-health-age-modal-sub">
                  검진 지표가 건강나이에 반영된 근거입니다.
                </div>
              </div>
              <button className="mc-modal-close" type="button" onClick={() => setShowHealthAgeModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="mc-modal-body">
              <div className="mc-health-age-modal-summary">
                <div>
                  <span>건강나이</span>
                  <strong>{healthAge?.biologicalAge ?? '-'}세</strong>
                </div>
                <div>
                  <span>실제 나이</span>
                  <strong>{healthAge?.chronologicalAge ?? '-'}세</strong>
                </div>
                <div>
                  <span>차이</span>
                  <strong className={healthAgeDiff != null && healthAgeDiff > 0 ? 'warn' : 'good'}>
                    {healthAgeDiff == null ? '-' : healthAgeDiff > 0 ? `+${healthAgeDiff}세` : healthAgeDiff < 0 ? `${healthAgeDiff}세` : '0세'}
                  </strong>
                </div>
              </div>

              {healthAge?.detailMessage && (
                <div className="mc-health-age-modal-note">
                  {healthAge.detailMessage}
                </div>
              )}

              {healthAgeFactors.length > 0 && (
                <div className="mc-health-age-factor-list">
                  {healthAgeFactors.slice(0, 5).map((factor, index) => {
                    const line = healthAgeFactorLine(factor);
                    if (!line) return null;
                    return (
                      <div key={`${line}-${index}`} className="mc-health-age-factor-row">
                        <span>요인 {index + 1}</span>
                        <strong>{line}</strong>
                      </div>
                    );
                  })}
                </div>
              )}

              {healthAge?.changeAfterMessage && (
                <div className="mc-alert mc-alert-blue" style={{ marginTop: 14 }}>
                  <div>
                    <div className="mc-alert-title">개선 시 변화</div>
                    <div className="mc-alert-body">{healthAge.changeAfterMessage}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMbtiModal && (
        <div className="mc-modal-backdrop mc-print-hide" onClick={() => setShowMbtiModal(false)}>
          <div className="mc-modal mc-health-mbti-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mc-modal-head">
              <div>
                <div className="mc-modal-title">건강 MBTI</div>
                <div className="mc-health-mbti-modal-sub">생활습관 선택으로 보는 나의 건강 관리 타입</div>
              </div>
              <button className="mc-modal-close" type="button" onClick={() => setShowMbtiModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="mc-modal-body">
              {!mbtiResult ? (
                <div className="mc-health-mbti-survey">
                  <div className="mc-health-mbti-progress-row">
                    <span>{mbtiStep + 1}/{HEALTH_MBTI_QUESTIONS.length}</span>
                    <b>{mbtiProgress}%</b>
                  </div>
                  <div className="mc-health-mbti-progress"><i style={{ width: `${mbtiProgress}%` }} /></div>
                  <div className="mc-health-mbti-question">{currentMbtiQuestion.title}</div>
                  <div className="mc-health-mbti-options">
                    {currentMbtiQuestion.options.map((option) => (
                      <button key={option.value} type="button" onClick={() => selectMbtiAnswer(option.value)}>
                        <span>{option.label}</span>
                        <small>{option.desc}</small>
                      </button>
                    ))}
                  </div>
                  {mbtiStep > 0 && (
                    <button className="mc-health-mbti-back" type="button" onClick={() => setMbtiStep((step) => Math.max(0, step - 1))}>이전 질문</button>
                  )}
                </div>
              ) : (
                <div className={`mc-health-mbti-result ${mbtiResult.tone}`}>
                  <div className="mc-health-mbti-result-type">{mbtiResult.type}</div>
                  <div className="mc-health-mbti-result-title">{mbtiResult.title}</div>
                  <p>{mbtiResult.summary}</p>
                  <div className="mc-health-mbti-tip-list">
                    {mbtiResult.tips.map((tip) => <div key={tip}>{tip}</div>)}
                  </div>
                  <div className="mc-health-mbti-section-title">부족 가능 영양 · 추천</div>
                  <div className="mc-health-mbti-nutrient-list">
                    {mbtiResult.nutrients.map((item) => (
                      <div key={item.name} className="mc-health-mbti-nutrient-card">
                        <b>{item.name}</b>
                        <span>{item.reason}</span>
                        <small>추천: {item.supplement}</small>
                      </div>
                    ))}
                  </div>
                  <div className="mc-health-mbti-section-title">마음 건강 체크</div>
                  <div className={`mc-health-mbti-mind-note ${mbtiAnswers.mood === 'down' ? 'warning' : ''}`}>{mbtiResult.mindHealth}</div>
                  <div className="mc-health-mbti-disclaimer">영양제 추천은 생활습관 기반 참고용이며, 질환·복용약이 있으면 전문가와 먼저 상의해주세요.</div>
                  <div className="mc-health-mbti-result-actions">
                    <button className="mc-btn" type="button" onClick={resetMbtiSurvey}>다시 하기</button>
                    <button className="mc-btn mc-btn-primary" type="button" onClick={() => setShowMbtiModal(false)}>확인</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HealthReport;
