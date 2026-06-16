import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { healthAPI, insuranceAPI } from '../api/services';
import KakaoHospitalMap from '../components/KakaoHospitalMap';
import MobileNavMenu from '../components/common/MobileNavMenu';

const Icon = ({ children, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>
    {children}
  </svg>
);

const P = {
  arrow:  (<path d="M3 8h10M9 4l4 4-4 4" />),
  check:  (<path d="m3 8 4 4 6-7" />),
  plus:   (<path d="M8 3v10M3 8h10" />),
  search: (<><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></>),
  clip:   (<><rect x="3" y="2" width="10" height="12" rx="1.5" /><path d="M6 2v2h4V2" /><path d="M5.5 8h5M5.5 10.5h3" /></>),
  chart:  (<path d="M2 14h12M4 14V9M7 14V6M10 14V8M13 14V4" />),
  chat:   (<><path d="M2 2h12v9H9l-3 3v-3H2V2z" /><path d="M5 6h6M5 8.5h4" /></>),
  shield: (<path d="M8 1 3 3.5v4C3 10 5.5 12.5 8 14c2.5-1.5 5-4 5-6.5v-4L8 1z" />),
  lock:   (<><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></>),
  x:      (<path d="M4 4l8 8M12 4l-8 8" />),
  mapPin: (<><path d="M8 14s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8z"/><circle cx="8" cy="6" r="1.6"/></>),
  phone:  (<><path d="M5 2h6v12H5z"/><path d="M7 12h2"/></>),
};

const QUICK_ACTS = [
  { icon: 'search', title: '진료 전 보장 확인',  sub: '병원 가기 전에',  path: '/pre-treatment' },
  { icon: 'clip',   title: '최근 진료 기록',     sub: '방문 내역 확인', path: '/medical-records' },
  { icon: 'chart',  title: '12개월 건강 리포트', sub: '최신 분석',      path: '/health-report' },
  { icon: 'chat',   title: 'AI 건강 상담',       sub: '지금 채팅',      path: '/chat' },
];

const DISEASE_NAME = {
  'STROKE':         '뇌졸중',
  '뇌졸중':         '뇌졸중',
  'DIABETES':       '당뇨',
  '당뇨':           '당뇨',
  'CARDIO':         '심뇌관계',
  'CARDIOVASCULAR': '심뇌관계',
  '심뇌혈관':       '심뇌관계',
};

const GAP_STYLE = {
  hi:  { lc: '#BBA8A8', tc: '#7A5050', tb: '#F2ECEC', label: '필수' },
  mid: { lc: '#C0B890', tc: '#7A6A40', tb: '#F4EFDE', label: '권장' },
  lo:  { lc: '#A8B8BB', tc: '#405A7A', tb: '#ECF0F2', label: '확인' },
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatWon = (amount) => `${new Intl.NumberFormat('ko-KR').format(Math.round(amount || 0))}원`;

// ── 국가건강검진 지역 그룹 (hospitals 테이블 표준 시도코드 기준) ──────────────
// cities: '전체'는 그룹 내 모든 시도(siDoCds) 조회, 그 외는 (siDoCd, siGunGuCd) 단일 조회
const REGION_GROUPS = [
  { province: '서울특별시', short: '서울', siDoCds: [11], cities: [
    { name: '전체' },
    { name: '종로구', siDoCd: 11, siGunGuCd: 110 }, { name: '중구', siDoCd: 11, siGunGuCd: 140 },
    { name: '용산구', siDoCd: 11, siGunGuCd: 170 }, { name: '성동구', siDoCd: 11, siGunGuCd: 200 },
    { name: '광진구', siDoCd: 11, siGunGuCd: 215 }, { name: '동대문구', siDoCd: 11, siGunGuCd: 230 },
    { name: '중랑구', siDoCd: 11, siGunGuCd: 260 }, { name: '성북구', siDoCd: 11, siGunGuCd: 290 },
    { name: '강북구', siDoCd: 11, siGunGuCd: 305 }, { name: '도봉구', siDoCd: 11, siGunGuCd: 320 },
    { name: '노원구', siDoCd: 11, siGunGuCd: 350 }, { name: '은평구', siDoCd: 11, siGunGuCd: 380 },
    { name: '서대문구', siDoCd: 11, siGunGuCd: 410 }, { name: '마포구', siDoCd: 11, siGunGuCd: 440 },
    { name: '양천구', siDoCd: 11, siGunGuCd: 470 }, { name: '강서구', siDoCd: 11, siGunGuCd: 500 },
    { name: '구로구', siDoCd: 11, siGunGuCd: 530 }, { name: '금천구', siDoCd: 11, siGunGuCd: 545 },
    { name: '영등포구', siDoCd: 11, siGunGuCd: 560 }, { name: '동작구', siDoCd: 11, siGunGuCd: 590 },
    { name: '관악구', siDoCd: 11, siGunGuCd: 620 }, { name: '서초구', siDoCd: 11, siGunGuCd: 650 },
    { name: '강남구', siDoCd: 11, siGunGuCd: 680 }, { name: '송파구', siDoCd: 11, siGunGuCd: 710 },
    { name: '강동구', siDoCd: 11, siGunGuCd: 740 },
  ]},
  { province: '경기도', short: '경기', siDoCds: [41], cities: [
    { name: '전체' },
    { name: '수원 장안구', siDoCd: 41, siGunGuCd: 111 }, { name: '수원 권선구', siDoCd: 41, siGunGuCd: 113 },
    { name: '수원 팔달구', siDoCd: 41, siGunGuCd: 115 }, { name: '수원 영통구', siDoCd: 41, siGunGuCd: 117 },
    { name: '성남 수정구', siDoCd: 41, siGunGuCd: 131 }, { name: '성남 중원구', siDoCd: 41, siGunGuCd: 133 },
    { name: '성남 분당구', siDoCd: 41, siGunGuCd: 135 }, { name: '의정부시', siDoCd: 41, siGunGuCd: 150 },
    { name: '안양 만안구', siDoCd: 41, siGunGuCd: 171 }, { name: '안양 동안구', siDoCd: 41, siGunGuCd: 173 },
    { name: '부천 원미구', siDoCd: 41, siGunGuCd: 192 }, { name: '부천 소사구', siDoCd: 41, siGunGuCd: 194 },
    { name: '부천 오정구', siDoCd: 41, siGunGuCd: 196 }, { name: '광명시', siDoCd: 41, siGunGuCd: 210 },
    { name: '평택시', siDoCd: 41, siGunGuCd: 220 }, { name: '안산 상록구', siDoCd: 41, siGunGuCd: 271 },
    { name: '안산 단원구', siDoCd: 41, siGunGuCd: 273 }, { name: '고양 덕양구', siDoCd: 41, siGunGuCd: 281 },
    { name: '고양 일산동구', siDoCd: 41, siGunGuCd: 285 }, { name: '고양 일산서구', siDoCd: 41, siGunGuCd: 287 },
    { name: '구리시', siDoCd: 41, siGunGuCd: 310 }, { name: '남양주시', siDoCd: 41, siGunGuCd: 360 },
    { name: '오산시', siDoCd: 41, siGunGuCd: 370 }, { name: '시흥시', siDoCd: 41, siGunGuCd: 390 },
    { name: '군포시', siDoCd: 41, siGunGuCd: 410 }, { name: '용인 처인구', siDoCd: 41, siGunGuCd: 461 },
    { name: '용인 기흥구', siDoCd: 41, siGunGuCd: 463 }, { name: '파주시', siDoCd: 41, siGunGuCd: 480 },
    { name: '이천시', siDoCd: 41, siGunGuCd: 500 }, { name: '안성시', siDoCd: 41, siGunGuCd: 550 },
    { name: '김포시', siDoCd: 41, siGunGuCd: 570 }, { name: '화성 만세구', siDoCd: 41, siGunGuCd: 591 },
    { name: '화성 병점구', siDoCd: 41, siGunGuCd: 595 }, { name: '화성 동탄구', siDoCd: 41, siGunGuCd: 597 },
    { name: '광주시', siDoCd: 41, siGunGuCd: 610 }, { name: '포천시', siDoCd: 41, siGunGuCd: 650 },
  ]},
  { province: '인천광역시', short: '인천', siDoCds: [28], cities: [
    { name: '전체' },
    { name: '중구', siDoCd: 28, siGunGuCd: 110 }, { name: '동구', siDoCd: 28, siGunGuCd: 140 },
    { name: '미추홀구', siDoCd: 28, siGunGuCd: 177 }, { name: '연수구', siDoCd: 28, siGunGuCd: 185 },
    { name: '남동구', siDoCd: 28, siGunGuCd: 200 }, { name: '부평구', siDoCd: 28, siGunGuCd: 237 },
    { name: '계양구', siDoCd: 28, siGunGuCd: 245 }, { name: '서구', siDoCd: 28, siGunGuCd: 260 },
    { name: '강화군', siDoCd: 28, siGunGuCd: 710 },
  ]},
  { province: '강원특별자치도', short: '강원', siDoCds: [51], cities: [
    { name: '전체' },
    { name: '춘천시', siDoCd: 51, siGunGuCd: 110 }, { name: '원주시', siDoCd: 51, siGunGuCd: 130 },
    { name: '강릉시', siDoCd: 51, siGunGuCd: 150 }, { name: '동해시', siDoCd: 51, siGunGuCd: 170 },
    { name: '태백시', siDoCd: 51, siGunGuCd: 190 }, { name: '속초시', siDoCd: 51, siGunGuCd: 210 },
    { name: '삼척시', siDoCd: 51, siGunGuCd: 230 }, { name: '홍천군', siDoCd: 51, siGunGuCd: 720 },
    { name: '영월군', siDoCd: 51, siGunGuCd: 750 },
  ]},
  { province: '충청도', short: '충청', siDoCds: [30, 36, 43, 44], cities: [
    { name: '전체' },
    { name: '대전광역시', siDoCd: 30 }, { name: '세종시', siDoCd: 36 },
    { name: '청주 상당구', siDoCd: 43, siGunGuCd: 111 }, { name: '청주 서원구', siDoCd: 43, siGunGuCd: 112 },
    { name: '청주 흥덕구', siDoCd: 43, siGunGuCd: 113 }, { name: '청주 청원구', siDoCd: 43, siGunGuCd: 114 },
    { name: '충주시', siDoCd: 43, siGunGuCd: 130 }, { name: '제천시', siDoCd: 43, siGunGuCd: 150 },
    { name: '옥천군', siDoCd: 43, siGunGuCd: 730 }, { name: '진천군', siDoCd: 43, siGunGuCd: 750 },
    { name: '음성군', siDoCd: 43, siGunGuCd: 770 },
    { name: '천안 동남구', siDoCd: 44, siGunGuCd: 131 }, { name: '천안 서북구', siDoCd: 44, siGunGuCd: 133 },
    { name: '공주시', siDoCd: 44, siGunGuCd: 150 }, { name: '보령시', siDoCd: 44, siGunGuCd: 180 },
    { name: '아산시', siDoCd: 44, siGunGuCd: 200 }, { name: '서산시', siDoCd: 44, siGunGuCd: 210 },
    { name: '논산시', siDoCd: 44, siGunGuCd: 230 }, { name: '당진시', siDoCd: 44, siGunGuCd: 270 },
    { name: '홍성군', siDoCd: 44, siGunGuCd: 800 }, { name: '예산군', siDoCd: 44, siGunGuCd: 810 },
  ]},
  { province: '전라도', short: '전라', siDoCds: [29, 46, 52], cities: [
    { name: '전체' },
    { name: '광주광역시', siDoCd: 29 },
    { name: '목포시', siDoCd: 46, siGunGuCd: 110 }, { name: '여수시', siDoCd: 46, siGunGuCd: 130 },
    { name: '순천시', siDoCd: 46, siGunGuCd: 150 }, { name: '나주시', siDoCd: 46, siGunGuCd: 170 },
    { name: '광양시', siDoCd: 46, siGunGuCd: 230 }, { name: '고흥군', siDoCd: 46, siGunGuCd: 770 },
    { name: '화순군', siDoCd: 46, siGunGuCd: 790 }, { name: '장흥군', siDoCd: 46, siGunGuCd: 800 },
    { name: '강진군', siDoCd: 46, siGunGuCd: 810 }, { name: '해남군', siDoCd: 46, siGunGuCd: 820 },
    { name: '무안군', siDoCd: 46, siGunGuCd: 840 }, { name: '영광군', siDoCd: 46, siGunGuCd: 870 },
    { name: '전주 완산구', siDoCd: 52, siGunGuCd: 111 }, { name: '전주 덕진구', siDoCd: 52, siGunGuCd: 113 },
    { name: '군산시', siDoCd: 52, siGunGuCd: 130 }, { name: '익산시', siDoCd: 52, siGunGuCd: 140 },
    { name: '정읍시', siDoCd: 52, siGunGuCd: 180 }, { name: '남원시', siDoCd: 52, siGunGuCd: 190 },
    { name: '고창군', siDoCd: 52, siGunGuCd: 790 }, { name: '부안군', siDoCd: 52, siGunGuCd: 800 },
  ]},
  { province: '경상북도', short: '경북', siDoCds: [27, 47], cities: [
    { name: '전체' },
    { name: '대구광역시', siDoCd: 27 },
    { name: '포항 남구', siDoCd: 47, siGunGuCd: 111 }, { name: '포항 북구', siDoCd: 47, siGunGuCd: 113 },
    { name: '경주시', siDoCd: 47, siGunGuCd: 130 }, { name: '김천시', siDoCd: 47, siGunGuCd: 150 },
    { name: '안동시', siDoCd: 47, siGunGuCd: 170 }, { name: '구미시', siDoCd: 47, siGunGuCd: 190 },
    { name: '영주시', siDoCd: 47, siGunGuCd: 210 }, { name: '영천시', siDoCd: 47, siGunGuCd: 230 },
    { name: '상주시', siDoCd: 47, siGunGuCd: 250 }, { name: '문경시', siDoCd: 47, siGunGuCd: 280 },
    { name: '경산시', siDoCd: 47, siGunGuCd: 290 },
  ]},
  { province: '경상남도', short: '경남', siDoCds: [26, 31, 48], cities: [
    { name: '전체' },
    { name: '부산광역시', siDoCd: 26 }, { name: '울산광역시', siDoCd: 31 },
    { name: '창원 의창구', siDoCd: 48, siGunGuCd: 121 }, { name: '창원 성산구', siDoCd: 48, siGunGuCd: 123 },
    { name: '창원 마산합포구', siDoCd: 48, siGunGuCd: 125 }, { name: '창원 마산회원구', siDoCd: 48, siGunGuCd: 127 },
    { name: '창원 진해구', siDoCd: 48, siGunGuCd: 129 }, { name: '진주시', siDoCd: 48, siGunGuCd: 170 },
    { name: '통영시', siDoCd: 48, siGunGuCd: 220 }, { name: '사천시', siDoCd: 48, siGunGuCd: 240 },
    { name: '김해시', siDoCd: 48, siGunGuCd: 250 }, { name: '밀양시', siDoCd: 48, siGunGuCd: 270 },
    { name: '거제시', siDoCd: 48, siGunGuCd: 310 }, { name: '양산시', siDoCd: 48, siGunGuCd: 330 },
  ]},
  { province: '제주특별자치도', short: '제주', siDoCds: [50], cities: [
    { name: '전체' },
    { name: '제주시', siDoCd: 50, siGunGuCd: 110 }, { name: '서귀포시', siDoCd: 50, siGunGuCd: 130 },
  ]},
];

const RISK_META = { '나쁨': '위험 구간 · 관리 필요', '보통': '평균 수준', '좋음': '양호한 상태' };

const RISK_PLACEHOLDERS = [
  { name: '뇌졸중', cls: 'lo', level: '낮음', pct: 22 },
  { name: '당뇨', cls: 'mid', level: '중간', pct: 48 },
  { name: '심뇌혈관', cls: 'lo', level: '낮음', pct: 30 },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [visits, setVisits]           = useState([]);
  const [risks, setRisks]             = useState([]);
  const [gaps, setGaps]               = useState([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [topDept, setTopDept]         = useState('-');
  const [nextCheckup, setNextCheckup] = useState(null);
  const [premium, setPremium]         = useState({ total: 0, insurers: 0 });

  // 국가건강검진 예약 모달
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('서울특별시');
  const [selectedCity, setSelectedCity]         = useState('전체');
  const [reservationHospitals, setReservationHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const hospitalListRef = useRef(null);

  const selectedRegion = REGION_GROUPS.find((r) => r.province === selectedProvince) || REGION_GROUPS[0];

  // 지도 마커 클릭 시 목록에서 해당 병원이 보이도록 스크롤
  useEffect(() => {
    if (selectedHospitalId == null || !hospitalListRef.current) return;
    const el = hospitalListRef.current.querySelector(`[data-hid="${selectedHospitalId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedHospitalId]);

  const fetchHospitals = useCallback((region, cityName) => {
    setHospitalsLoading(true);
    setSelectedHospitalId(null);
    const city = region.cities.find((c) => c.name === cityName);
    const requests = (!city || city.name === '전체')
      ? region.siDoCds.map((cd) => healthAPI.getHospitals(cd))
      : [healthAPI.getHospitals(city.siDoCd, city.siGunGuCd ?? null)];
    Promise.all(requests.map((p) => p.catch(() => [])))
      .then((results) => setReservationHospitals(results.flat().filter(Boolean)))
      .finally(() => setHospitalsLoading(false));
  }, []);

  useEffect(() => {
    if (!showReservationModal) return;
    fetchHospitals(selectedRegion, selectedCity);
  }, [showReservationModal, selectedProvince, selectedCity, fetchHospitals, selectedRegion]);

  useEffect(() => {
    const today = new Date();
    const since = new Date(today);
    since.setMonth(since.getMonth() - 12);
    const startDate = since.toISOString().slice(0, 10);

    healthAPI.getMedicalRecords({ startDate })
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setTotalVisits(rows.length);
        setVisits(rows.slice(0, 3).map((r) => {
          const isPharmacy = r.diseaseCode === '$' || (r.hospitalName || r.hospital || '').includes('약국');
          return {
            hospital:  r.hospitalName || r.hospital || '-',
            date:      r.visitDate    || '-',
            diagnosis: isPharmacy ? '약국 조제' : (r.diagnosis && r.diagnosis !== '해당없음' ? r.diagnosis : r.treatmentType || '-'),
            dept:      isPharmacy ? '약국' : (r.department || '-'),
            type:      r.treatmentType || '-',
          };
        }));
        const deptCount = {};
        rows.forEach((r) => { if (r.department) deptCount[r.department] = (deptCount[r.department] || 0) + 1; });
        const top = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0];
        if (top) setTopDept(top[0]);
      })
      .catch(() => {});

    healthAPI.getDiseasePredictions()
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const latest = {};
        rows.forEach((r) => { if (!latest[r.predictionType]) latest[r.predictionType] = r; });
        const parseAvgRatio = (val) => {
          if (!val) return null;
          const s = String(val);
          return parseFloat(s.includes('/') ? s.split('/')[0] : s) || null;
        };
        const gradeFromRank = (rank) => {
          if (rank == null) return { label: '-', cls: 'lo' };
          if (rank >= 67) return { label: '나쁨', cls: 'hi' };
          if (rank >= 34) return { label: '보통', cls: 'mid' };
          return { label: '좋음', cls: 'lo' };
        };
        const mapped = Object.values(latest).map((r) => {
          const ratio    = parseFloat(r.riskRatio) || 0;
          const avgRatio = parseAvgRatio(r.averageRatio);
          const grade    = gradeFromRank(avgRatio);
          return {
            name:     DISEASE_NAME[r.predictionType] || r.predictionType,
            ratio,
            avgRatio,
            level:    grade.label,
            cls:      grade.cls,
            pct:      avgRatio ?? 20,
          };
        });
        setRisks(mapped);
      })
      .catch(() => {});

    healthAPI.getCheckupResults()
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const latest = rows.reduce((a, b) => (a.checkupDate > b.checkupDate ? a : b));
        const lastDate = new Date(latest.checkupDate);
        const nextDate = new Date(lastDate);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        const now = new Date();
        const diffDays = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
        setNextCheckup({
          lastDate: latest.checkupDate,
          nextDate: nextDate.toISOString().slice(0, 10),
          dday: diffDays,
        });
      })
      .catch(() => {});

    insuranceAPI.getCoverageComparison()
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const gapItems = rows
          .filter((r) => {
            const self = r.selfCoverageAmount ?? r.self_coverage_amount ?? 0;
            const avg  = r.avgGroupCoverageAmount ?? r.avg_group_coverage_amount ?? 0;
            return avg > 0 && self < avg;
          })
          .slice(0, 3)
          .map((r) => {
            const self = r.selfCoverageAmount ?? r.self_coverage_amount ?? 0;
            const avg  = r.avgGroupCoverageAmount ?? r.avg_group_coverage_amount ?? 1;
            const pct  = Math.round((1 - self / avg) * 100);
            const severity = pct >= 70 ? 'hi' : pct >= 30 ? 'mid' : 'lo';
            return {
              name:     r.coverageName ?? r.coverage_name ?? '-',
              desc:     `평균 대비 ${pct}% 부족`,
              severity,
            };
          });
        setGaps(gapItems);
      })
      .catch(() => {});

    insuranceAPI.getPolicies()
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const total = rows.reduce((sum, p) => sum + toNumber(p.monthlyPremium ?? p.monthly_premium), 0);
        const insurers = new Set(
          rows.map((p) => p.companyName ?? p.insurer_name).filter(Boolean)
        ).size;
        setPremium({ total, insurers });
      })
      .catch(() => {});
  }, []);

  const topRisk = risks.length > 0
    ? risks.reduce((a, b) => (a.ratio > b.ratio ? a : b))
    : null;

  const stats = [
    { lbl: '월 보험료 합계', val: premium.total > 0 ? formatWon(premium.total) : '정보 없음',
      meta: premium.insurers > 0 ? `${premium.insurers}개 보험사 통합` : '보험 동기화 필요', blue: false },
    { lbl: '최근 진료 기록', val: `${totalVisits}건`,            meta: '최근 12개월 기준',           blue: true  },
    { lbl: '건강 위험도',    val: topRisk ? topRisk.level : '-', meta: topRisk ? `${topRisk.name} · ${RISK_META[topRisk.level] || ''}` : '데이터 없음', blue: false },
    { lbl: '보험 공백',      val: gaps.length > 0 ? `${gaps.length}개 항목` : '확인 필요',
      meta: gaps.length > 0 ? '즉시 개선 권장' : '보험 공백 페이지 확인', blue: false },
  ];

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-greeting-name">안녕하세요, {user?.name || '사용자'} 님</div>
          <div className="mc-greeting-sub">오늘도 건강한 하루 되세요. 내 건강 기록과 보험 현황을 한눈에 확인해보세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn mc-btn-primary" onClick={() => navigate('/insurance')}>
            <Icon size={12}>{P.shield}</Icon> 내 보험 현황 보기
          </button>
        </div>
      </div>

      <MobileNavMenu />

      {/* Stats strip */}
      <div className="mc-stats-strip">
        {stats.map((s, i) => (
          <div className="mc-stat-cell" key={i}>
            <div className="mc-stat-lbl">{s.lbl}</div>
            <div className={`mc-stat-val${s.blue ? ' blue' : ''}`}>{s.val}</div>
            {s.pill
              ? <span className="mc-stat-pill">{s.pill}</span>
              : <div className="mc-stat-meta">{s.meta}</div>}
          </div>
        ))}
      </div>

      {/* Medical records + Risk */}
      <div className="mc-two-col">
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">최근 진료 기록</span>
            <button className="mc-sec-link" onClick={() => navigate('/medical-records')}>
              전체 보기 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <table className="mc-tbl mc-dashboard-record-table">
            <thead>
              <tr>
                <th>병원 / 내역</th>
                <th>날짜</th>
                <th>구분</th>
              </tr>
            </thead>
            <tbody>
              {visits.length > 0 ? visits.map((c, i) => (
                <tr key={i} onClick={() => navigate('/medical-records')} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="mc-tbl-hospital">{c.hospital}</div>
                    {c.diagnosis !== '-' && <div className="mc-tbl-detail">{c.diagnosis}</div>}
                  </td>
                  <td><span className="mc-tbl-date">{c.date}</span></td>
                  <td><span className="mc-tbl-tag">{c.type}</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>
                    아직 연동된 진료 기록이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mc-tbl-footer">
            <span className="mc-tbl-footer-label">최근 방문 기록</span>
            <span className="mc-tbl-footer-value">총 {totalVisits}건</span>
          </div>
        </div>

        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">건강 위험도</span>
            <button className="mc-sec-link" onClick={() => navigate('/health-report')}>
              리포트 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <div className={`mc-risk-list${risks.length === 0 ? ' locked' : ''}`}>
            {risks.length > 0 ? risks.map((r, i) => (
              <div className="mc-risk-row" key={i}>
                <div className="mc-risk-meta">
                  <span className="mc-risk-name">{r.name}</span>
                  <span className={`mc-risk-lvl ${r.cls}`}>
                    {r.level}
                    {r.avgRatio != null && (
                      <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
                        100명 중 {r.avgRatio}번째
                      </span>
                    )}
                  </span>
                </div>
                <div className="mc-risk-bar">
                  <div className={`mc-risk-fill ${r.cls}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            )) : (
              <div className="mc-risk-locked-preview">
                {RISK_PLACEHOLDERS.map((r) => (
                  <div className="mc-risk-row mc-risk-row-placeholder" key={r.name}>
                    <div className="mc-risk-meta">
                      <span className="mc-risk-name">{r.name}</span>
                      <span className={`mc-risk-lvl ${r.cls}`}>{r.level}</span>
                    </div>
                    <div className="mc-risk-bar">
                      <div className={`mc-risk-fill ${r.cls}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
                <div className="mc-risk-lock-overlay">
                  <span className="mc-risk-lock-icon"><Icon size={16}>{P.lock}</Icon></span>
                  <strong>데이터를 먼저 불러와주세요</strong>
                  <span>데이터를 연결하면 질병 위험도와 변화 추이를 확인할 수 있어요.</span>
                  <button className="mc-btn mc-btn-primary" type="button" onClick={() => navigate('/checkup')}>
                    건강검진 기록 보기
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mc-ai-strip" onClick={() => navigate('/chat')}>
            <div>
              <strong>AI 인사이트</strong>
              <span>건강 이력 기반 맞춤 보험·보건 어드바이스</span>
            </div>
            <em>→</em>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mc-three-col">
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">빠른 기능</span>
          </div>
          <div className="mc-action-grid">
            {QUICK_ACTS.map((a, i) => (
              <button className="mc-action-cell" key={i} onClick={() => navigate(a.path)}>
                <div className="mc-action-icon"><Icon size={13}>{P[a.icon]}</Icon></div>
                <div className="mc-action-title">{a.title}</div>
                <div className="mc-action-sub">{a.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">보험 공백</span>
            <button className="mc-sec-link" onClick={() => navigate('/insurance-plan')}>
              개선하기 <Icon>{P.arrow}</Icon>
            </button>
          </div>
          <div className="mc-gap-list">
            {gaps.length > 0 ? gaps.map((g, i) => {
              const s = GAP_STYLE[g.severity] || GAP_STYLE.mid;
              return (
                <div className="mc-gap-row" key={i}>
                  <div className="mc-gap-accent" style={{ background: s.lc }} />
                  <div className="mc-gap-info">
                    <div className="mc-gap-name">{g.name}</div>
                    <div className="mc-gap-sub">{g.desc}</div>
                  </div>
                  <span className="mc-gap-tag" style={{ color: s.tc, background: s.tb }}>{s.label}</span>
                </div>
              );
            }) : (
              <div className="mc-gap-empty-state">
                <span className="mc-gap-empty-icon"><Icon size={15}>{P.shield}</Icon></span>
                <div>
                  <strong>보험 공백이 없어요</strong>
                  <span>현재 확인된 부족 보장은 없습니다.</span>
                </div>
              </div>
            )}
            <div className="mc-gap-footer">
              <button
                className="mc-btn mc-btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={() => navigate('/insurance-plan')}
              >
                <Icon size={12}>{P.plus}</Icon> 보험 공백 확인
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="mc-sec-head">
            <span className="mc-sec-title">다가오는 검진</span>
          </div>
          <div className="mc-widget">
            <div className="mc-widget-title">국가건강검진</div>
            {nextCheckup ? (
              <>
                <div className="mc-widget-sub">
                  최근 검진 {nextCheckup.lastDate} · 다음 예정 {nextCheckup.nextDate}
                </div>
                <div style={{ fontSize: 12, color: nextCheckup.dday <= 30 ? '#9A6060' : 'var(--text-2)', marginBottom: 8 }}>
                  {nextCheckup.dday > 0 ? `D-${nextCheckup.dday}` : nextCheckup.dday === 0 ? 'D-day' : `D+${Math.abs(nextCheckup.dday)} 초과`}
                </div>
              </>
            ) : (
              <div className="mc-widget-sub">검진 기록이 없어요</div>
            )}
            <button
              className="mc-btn"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
              onClick={() => setShowReservationModal(true)}
            >
              병원 조회하기
            </button>
          </div>
          <div className="mc-widget mc-widget-tight">
            <div className="mc-widget-section-lbl">최근 진료 요약</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: 'var(--text-2)' }}>최근 방문</span>
              <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{totalVisits}건</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>주요 진료과</span>
              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{topDept}</span>
            </div>
          </div>
        </div>
      </div>

      {showReservationModal && (
        <div className="mc-modal-backdrop" onClick={() => setShowReservationModal(false)}>
          <div className="mc-modal mc-reservation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-modal-head">
              <div>
                <div className="mc-modal-title">국가건강검진 예약 정보</div>
                <div className="mc-reservation-sub">전국 국가건강검진 가능 병원을 지도와 목록으로 확인하세요.</div>
              </div>
              <button className="mc-modal-close" type="button" onClick={() => setShowReservationModal(false)} aria-label="닫기">
                <Icon size={15}>{P.x}</Icon>
              </button>
            </div>
            <div className="mc-modal-body mc-reservation-body2">
              <div className="mc-reservation-filterbar">
                <select
                  className="mc-province-select"
                  value={selectedProvince}
                  onChange={(e) => { setSelectedProvince(e.target.value); setSelectedCity('전체'); }}
                  aria-label="시/도 선택"
                >
                  {REGION_GROUPS.map((region) => (
                    <option key={region.province} value={region.province}>{region.province}</option>
                  ))}
                </select>
                <select
                  className="mc-province-select mc-city-select"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  aria-label="시/군/구 선택"
                >
                  {selectedRegion.cities.map((city) => (
                    <option key={city.name} value={city.name}>{city.name}</option>
                  ))}
                </select>
                <span className="mc-reservation-count">{hospitalsLoading ? '...' : `${reservationHospitals.length}곳`}</span>
              </div>
              <div className="mc-reservation-split">
                <div className="mc-reservation-list" ref={hospitalListRef}>
                  {hospitalsLoading ? (
                    <div className="mc-reservation-empty">병원 정보를 불러오는 중...</div>
                  ) : reservationHospitals.length > 0 ? reservationHospitals.map((h, i) => (
                    <div
                      className={`mc-reservation-hospital ${selectedHospitalId === h.id ? 'active' : ''}`}
                      key={h.id ?? `${h.hmcNm}-${i}`}
                      data-hid={h.id}
                      onClick={() => setSelectedHospitalId(h.id)}
                    >
                      <div className="mc-reservation-num">{i + 1}</div>
                      <div className="mc-reservation-info">
                        <div className="mc-reservation-name">{h.hmcNm}</div>
                        {h.locAddr && <div className="mc-reservation-meta"><Icon size={11}>{P.mapPin}</Icon>{h.locAddr}</div>}
                        {h.hmcTelNo && (
                          <div className="mc-reservation-meta">
                            <Icon size={11}>{P.phone}</Icon>
                            <a className="mc-reservation-tel" href={`tel:${h.hmcTelNo}`} onClick={(e) => e.stopPropagation()}>{h.hmcTelNo}</a>
                          </div>
                        )}
                      </div>
                      <span className="mc-tag mc-tag-success">검진 가능</span>
                    </div>
                  )) : (
                    <div className="mc-reservation-empty">해당 지역의 검진 병원 정보가 없어요.</div>
                  )}
                </div>
                <KakaoHospitalMap
                  hospitals={reservationHospitals}
                  selectedId={selectedHospitalId}
                  onSelect={setSelectedHospitalId}
                />
              </div>
            </div>
            <div className="mc-modal-foot">
              <button className="mc-btn" type="button" onClick={() => setShowReservationModal(false)}>닫기</button>
              {/*<button className="mc-btn mc-btn-primary" type="button" onClick={() => navigate('/checkup')}>검진 기록 보기</button>*/}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
