import React, { useCallback, useEffect, useState } from 'react';
import { healthAPI } from '../api/services';
import MobileNavMenu from '../components/common/MobileNavMenu';

const todayKst = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const currentMonthKst = () => todayKst().slice(0, 7);
const shiftMonth = (month, amount) => {
  const [year, value] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
};

const EMPTY_LOG = {
  mealDescription: '',
  exerciseDescription: '',
};

const LEVELS = {
  NO_DATA: { label: '검사 기록 없음', tone: 'mc-tag' },
  NO_SIGNAL: { label: '확인된 관리 신호 없음', tone: 'mc-tag-success' },
  ATTENTION: { label: '추가 확인 권고', tone: 'mc-tag-warning' },
  CONSULT: { label: '의료진 상담 권고', tone: 'mc-tag-danger' },
};

export default function HealthManagement() {
  const today = todayKst();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [results, setResults] = useState([]);
  const [missions, setMissions] = useState([]);
  const [aiGuidance, setAiGuidance] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(currentMonthKst);
  const [calendarDays, setCalendarDays] = useState([]);
  const [hasExistingHba1c, setHasExistingHba1c] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [onboarding, setOnboarding] = useState({
    diagnosisStatus: 'UNKNOWN', healthCheckupStatus: 'UNKNOWN', familyHistoryDiabetes: '', hba1cTestStatus: 'UNKNOWN',
    aiProcessingConsent: '', testDate: todayKst(), value: '', organizationName: '',
  });
  const [familyHistory, setFamilyHistory] = useState('');
  const [aiConsent, setAiConsent] = useState('');
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [log, setLog] = useState(EMPTY_LOG);
  const [editingId, setEditingId] = useState(null);
  const [testForm, setTestForm] = useState({ testDate: today, value: '', organizationName: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const [assessmentResult, resultsResult, logResult] = await Promise.allSettled([
      healthAPI.getDiabetesAssessment(),
      healthAPI.getHba1cResults(),
      healthAPI.getDailyHealthLog(today),
    ]);
    if (assessmentResult.status === 'fulfilled') {
      const data = assessmentResult.value;
      setAssessment(data);
      setOnboarding((current) => ({ ...current, healthCheckupStatus: data.healthCheckupStatus || current.healthCheckupStatus }));
      setFamilyHistory(data.familyHistoryDiabetes == null ? '' : String(data.familyHistoryDiabetes));
      setAiConsent(data.aiProcessingConsent == null ? '' : String(data.aiProcessingConsent));
      if (!data.onboardingComplete) {
        setHasExistingHba1c(Boolean(data.latestHba1c));
        setOnboarding((current) => ({
          ...current,
          diagnosisStatus: data.diagnosisStatus || 'UNKNOWN',
          healthCheckupStatus: data.healthCheckupStatus || 'UNKNOWN',
          familyHistoryDiabetes: data.familyHistoryDiabetes == null ? '' : String(data.familyHistoryDiabetes),
          hba1cTestStatus: data.latestHba1c ? 'RESULT_AVAILABLE' : (data.hba1cTestStatus || 'UNKNOWN'),
          aiProcessingConsent: data.aiProcessingConsent == null ? '' : String(data.aiProcessingConsent),
          testDate: data.latestHba1c?.testDate || current.testDate,
          value: data.latestHba1c?.value == null ? current.value : String(data.latestHba1c.value),
          organizationName: data.latestHba1c?.organizationName || current.organizationName,
        }));
      }
    }
    if (resultsResult.status === 'fulfilled') setResults(Array.isArray(resultsResult.value) ? resultsResult.value : []);
    if (logResult.status === 'fulfilled') setLog({ ...EMPTY_LOG, ...logResult.value });
    if ([assessmentResult, resultsResult, logResult].some((result) => result.status === 'rejected')) {
      setMessage('일부 건강 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }

    const data = assessmentResult.status === 'fulfilled' ? assessmentResult.value : null;
    if (data?.onboardingComplete && data.aiProcessingConsent) {
      try {
        setAiGuidance(await healthAPI.getAiDiabetesGuidance());
      } catch {
        setAiGuidance(null);
      }
    } else {
      setAiGuidance(null);
    }
    const missionsResult = await Promise.allSettled([healthAPI.getTodayMissions()]);
    if (missionsResult[0].status === 'fulfilled') setMissions(Array.isArray(missionsResult[0].value) ? missionsResult[0].value : []);
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const attendance = calendarMonth === currentMonthKst()
      ? healthAPI.recordHealthAttendance()
      : Promise.resolve();
    attendance.then(() => healthAPI.getHealthCalendar(calendarMonth))
      .then((data) => setCalendarDays(Array.isArray(data.days) ? data.days : []))
      .catch(() => {});
  }, [calendarMonth]);

  const updateLog = (key, value) => setLog((current) => ({
    ...current,
    [key]: value,
    ...(key === 'mealDescription' ? { mealReview: null } : {}),
    ...(key === 'exerciseDescription' ? { exerciseReview: null } : {}),
  }));

  const saveAiConsent = async () => {
    try {
      const updated = await healthAPI.saveDiabetesRiskProfile({
        familyHistoryDiabetes: familyHistory === '' ? null : familyHistory === 'true',
        aiProcessingConsent: aiConsent === '' ? null : aiConsent === 'true',
        healthCheckupStatus: onboarding.healthCheckupStatus,
      });
      setAssessment(updated);
      await load();
      setShowAiSettings(false);
      setMessage('AI 분석 동의 설정을 저장했습니다.');
    } catch {
      setMessage('AI 분석 동의 설정을 저장하지 못했습니다.');
    }
  };

  const submitOnboarding = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        diagnosisStatus: onboarding.diagnosisStatus,
        healthCheckupStatus: onboarding.healthCheckupStatus,
        familyHistoryDiabetes: onboarding.familyHistoryDiabetes === '' ? null : onboarding.familyHistoryDiabetes === 'true',
        hba1cTestStatus: onboarding.hba1cTestStatus,
        aiProcessingConsent: onboarding.aiProcessingConsent === 'true',
      };
      if (onboarding.hba1cTestStatus === 'RESULT_AVAILABLE' && onboarding.value !== '' && !hasExistingHba1c) {
        payload.hba1cResult = {
          testDate: onboarding.testDate,
          value: Number(onboarding.value),
          organizationName: onboarding.organizationName,
        };
      }
      await healthAPI.completeDiabetesOnboarding(payload);
      await load();
      setMessage('건강 정보를 저장했습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '건강 정보를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const submitHba1c = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...testForm, value: Number(testForm.value) };
      if (editingId) await healthAPI.updateHba1cResult(editingId, payload);
      else await healthAPI.createHba1cResult(payload);
      setEditingId(null);
      setTestForm({ testDate: today, value: '', organizationName: '', note: '' });
      await load();
      setMessage('당화혈색소 기록을 저장했습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '검사 결과를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const editHba1c = (result) => {
    setEditingId(result.id);
    setTestForm({
      testDate: result.testDate,
      value: String(result.value),
      organizationName: result.organizationName || '',
      note: result.note || '',
    });
  };

  const deleteHba1c = async (id) => {
    try {
      await healthAPI.deleteHba1cResult(id);
      await load();
      setMessage('검사 기록을 삭제했습니다.');
    } catch {
      setMessage('검사 기록을 삭제하지 못했습니다.');
    }
  };

  const saveLog = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const mealDescription = (log.mealDescription || '').trim();
    const exerciseDescription = (log.exerciseDescription || '').trim();
    try {
      const savedLog = await healthAPI.saveDailyHealthLog(today, {
        mealDescription,
        exerciseDescription,
      });
      let mealReview = savedLog.mealReview || null;
      let exerciseReview = savedLog.exerciseReview || null;
      const reviews = [];
      if (assessment?.aiProcessingConsent && mealDescription) {
        reviews.push(['meal', healthAPI.reviewDailyMeal(today)]);
      }
      if (assessment?.aiProcessingConsent && exerciseDescription) {
        reviews.push(['exercise', healthAPI.reviewDailyExercise(today)]);
      }
      const outcomes = await Promise.all(reviews.map(async ([type, promise]) => ({ type, result: await Promise.allSettled([promise]).then(([result]) => result) })));
      outcomes.forEach(({ type, result }) => {
        if (result.status === 'fulfilled') {
          if (type === 'meal') mealReview = result.value;
          if (type === 'exercise') exerciseReview = result.value;
        }
      });
      setLog((current) => ({ ...current, ...savedLog, mealReview, exerciseReview }));
      if (!assessment?.aiProcessingConsent && (mealDescription || exerciseDescription)) {
        setMessage('기록은 저장했습니다. AI 평가를 받으려면 당뇨 위험 안내에서 AI 분석에 동의해주세요.');
      } else if (reviews.length > 0 && outcomes.every(({ result }) => result.status === 'fulfilled')) {
        setMessage('오늘 기록을 저장하고 AI 평가를 완료했습니다.');
      } else if (reviews.length > 0) {
        setMessage('오늘 기록은 저장했지만 일부 AI 평가에 실패했습니다. 잠시 후 다시 저장해보세요.');
      } else {
        setMessage('오늘의 식사·운동 기록을 저장했습니다.');
      }
      healthAPI.getHealthCalendar(calendarMonth).then((calendar) => setCalendarDays(Array.isArray(calendar.days) ? calendar.days : [])).catch(() => {});
    } catch (error) {
      setMessage(error.response?.data?.message || '오늘 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const completeMission = async (id) => {
    try {
      const completed = await healthAPI.completeMission(id);
      setMissions((current) => current.map((mission) => mission.id === id ? completed : mission));
      healthAPI.getHealthCalendar(calendarMonth).then((calendar) => setCalendarDays(Array.isArray(calendar.days) ? calendar.days : [])).catch(() => {});
    } catch {
      setMessage('미션 상태를 저장하지 못했습니다.');
    }
  };

  const level = LEVELS[assessment?.level] || LEVELS.NO_DATA;
  const [calendarYear, calendarMonthNumber] = calendarMonth.split('-').map(Number);
  const calendarStartDay = new Date(calendarYear, calendarMonthNumber - 1, 1).getDay();
  const calendarDayCount = new Date(calendarYear, calendarMonthNumber, 0).getDate();
  const calendarByDate = Object.fromEntries(calendarDays.map((day) => [day.date, day]));
  const previousMonth = shiftMonth(calendarMonth, -1);
  const nextMonth = shiftMonth(calendarMonth, 1);
  const earliestMonth = shiftMonth(currentMonthKst(), -24);

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">혈당·생활습관 관리</div>
          <div className="mc-page-subtitle">검진에서 혈당 관리 신호를 확인했거나, 식사와 운동 습관을 꾸준히 만들고 싶은 분을 위한 기록입니다.</div>
        </div>
      </div>
      <MobileNavMenu />

      {message && <div className="mc-alert mc-alert-blue" role="status" style={{ marginBottom: 16 }}>{message}</div>}
      {loading ? (
        <div className="mc-alert mc-alert-blue"><div><div className="mc-alert-title">건강 정보를 불러오는 중</div></div></div>
      ) : (
        <>
          <nav className="health-stage-nav" aria-label="건강관리 단계">
            {['당뇨 위험 안내', '검진 이력', '오늘의 건강 활동', '활동 달력'].map((title, index) => (
              <button type="button" key={title} className={`health-stage-tab${activeStage === index ? ' active' : ''}`} aria-current={activeStage === index ? 'step' : undefined} onClick={() => setActiveStage(index)}>
                <span>{index + 1}</span>{title}
              </button>
            ))}
          </nav>
          {activeStage === 1 && assessment && !assessment.onboardingComplete && (
            <section className="health-onboarding-section" aria-labelledby="health-onboarding-title">
              <div className="mc-sec-head">
                <span className="mc-sec-title" id="health-onboarding-title">건강검진 이력과 시작 정보</span>
                <span className="mc-card-sub">{onboardingStep + 1} / 5</span>
              </div>
              <form className="mc-card mc-card-body health-onboarding-form" onSubmit={onboardingStep < 4 ? (event) => { event.preventDefault(); setOnboardingStep((step) => Math.min(step + 1, 4)); } : submitOnboarding}>
                {onboardingStep === 0 && (
                  <label className="mc-form-field health-onboarding-field">
                    <span className="mc-field-label">건강검진을 받은 적이 있나요?</span>
                    <select className="mc-select" value={onboarding.healthCheckupStatus} onChange={(event) => setOnboarding({ ...onboarding, healthCheckupStatus: event.target.value })}>
                      <option value="HAD_CHECKUP">받은 적 있어요</option>
                      <option value="NEVER">아직 받은 적 없어요</option>
                      <option value="UNKNOWN">잘 모르겠어요</option>
                    </select>
                    {assessment?.checkupDate && <span className="mc-card-sub">연동된 최근 검진: {assessment.checkupDate}</span>}
                  </label>
                )}
                {onboardingStep === 1 && (
                  <label className="mc-form-field health-onboarding-field">
                    <span className="mc-field-label">당뇨 진단을 받은 적이 있나요?</span>
                    <select className="mc-select" value={onboarding.diagnosisStatus} onChange={(event) => setOnboarding({ ...onboarding, diagnosisStatus: event.target.value })}>
                      <option value="DIAGNOSED">진단받았어요</option>
                      <option value="NOT_DIAGNOSED">진단받은 적 없어요</option>
                      <option value="UNKNOWN">잘 모르겠어요</option>
                    </select>
                  </label>
                )}
                {onboardingStep === 2 && (
                  <label className="mc-form-field health-onboarding-field">
                    <span className="mc-field-label">가족 중 당뇨 진단을 받은 분이 있나요?</span>
                    <select className="mc-select" value={onboarding.familyHistoryDiabetes} onChange={(event) => setOnboarding({ ...onboarding, familyHistoryDiabetes: event.target.value })}>
                      <option value="">응답하지 않을게요</option>
                      <option value="true">있어요</option>
                      <option value="false">없어요</option>
                    </select>
                  </label>
                )}
                {onboardingStep === 3 && (
                  assessment?.latestHba1c ? (
                    <div className="health-onboarding-existing-result">
                      <div className="mc-field-label">저장된 당화혈색소 검사 결과가 있어요</div>
                      <div>{assessment.latestHba1c.testDate} · <strong>{assessment.latestHba1c.value}%</strong></div>
                      <div className="mc-card-sub">기존 기록을 그대로 사용합니다.</div>
                    </div>
                  ) : (
                    <label className="mc-form-field health-onboarding-field">
                      <span className="mc-field-label">당화혈색소(HbA1c) 검사를 받아본 적이 있나요?</span>
                      <select className="mc-select" value={onboarding.hba1cTestStatus} onChange={(event) => setOnboarding({ ...onboarding, hba1cTestStatus: event.target.value })}>
                        <option value="RESULT_AVAILABLE">검사 결과가 있어요</option>
                        <option value="TESTED_NO_RESULT">검사는 받았지만 결과를 몰라요</option>
                        <option value="NOT_TESTED">아직 받지 않았어요</option>
                        <option value="UNKNOWN">잘 모르겠어요</option>
                      </select>
                    </label>
                  )
                )}
                {onboardingStep === 4 && (
                  <div className="health-onboarding-final-step">
                    {onboarding.hba1cTestStatus === 'RESULT_AVAILABLE' && (
                      <div className="health-onboarding-result-fields">
                        <div className="mc-field-label">검사 결과</div>
                        <label className="mc-form-field">
                          <span className="mc-card-sub">검사일</span>
                          <input className="mc-input" type="date" max={today} value={onboarding.testDate} required={!assessment?.latestHba1c} readOnly={hasExistingHba1c} onChange={(event) => setOnboarding({ ...onboarding, testDate: event.target.value })} />
                        </label>
                        <label className="mc-form-field">
                          <span className="mc-card-sub">당화혈색소 (%)</span>
                          <input className="mc-input" type="number" min="3" max="20" step="0.01" value={onboarding.value} required={!assessment?.latestHba1c} readOnly={hasExistingHba1c} onChange={(event) => setOnboarding({ ...onboarding, value: event.target.value })} />
                        </label>
                        <label className="mc-form-field">
                          <span className="mc-card-sub">병원명 (선택)</span>
                          <input className="mc-input" maxLength="150" value={onboarding.organizationName} readOnly={hasExistingHba1c} onChange={(event) => setOnboarding({ ...onboarding, organizationName: event.target.value })} />
                        </label>
                      </div>
                    )}
                    <label className="mc-form-field health-onboarding-field">
                      <span className="mc-field-label">개인화 건강 안내를 위해 AI 분석을 이용할까요?</span>
                      <select className="mc-select" required value={onboarding.aiProcessingConsent} onChange={(event) => setOnboarding({ ...onboarding, aiProcessingConsent: event.target.value })}>
                        <option value="">선택해주세요</option>
                        <option value="true">동의합니다</option>
                        <option value="false">동의하지 않습니다</option>
                      </select>
                      <span className="mc-card-sub">동의하면 위험 단계와 필요한 검사 수치가 AI 제공업체로 전송됩니다. 이름과 병원명은 보내지 않습니다. 동의하지 않아도 규칙 기반 안내와 기록 기능은 이용할 수 있습니다.</span>
                    </label>
                  </div>
                )}
                <div className="health-onboarding-actions">
                  <button className="mc-btn" type="button" disabled={onboardingStep === 0 || saving} onClick={() => setOnboardingStep((step) => Math.max(step - 1, 0))}>이전</button>
                  <button className="mc-btn mc-btn-primary" type="submit" disabled={saving || (onboardingStep === 4 && onboarding.aiProcessingConsent === '')}>
                    {saving ? '저장 중...' : onboardingStep === 4 ? '건강 정보 저장' : '다음'}
                  </button>
                </div>
              </form>
            </section>
          )}
          {activeStage === 2 && assessment && !assessment.onboardingComplete && (
            <div className="mc-alert mc-alert-blue">먼저 검진 이력과 건강관리 시작 정보를 입력하면 오늘의 미션이 개인화됩니다. 기록 기능은 계속 이용할 수 있어요.</div>
          )}
          {activeStage === 2 && <div className="health-management-daily-grid">
            <section className="health-management-section">
              <div className="mc-sec-head">
              <span className="mc-sec-title">오늘의 건강 미션</span>
              <span className="mc-card-sub">{today}</span>
              </div>
              <div className="mc-grid-2 health-management-missions">
                {missions.length === 0 ? (
                  <div className="mc-card mc-card-body mc-card-sub">오늘 등록된 건강 미션이 없습니다.</div>
                ) : missions.map((mission) => (
                  <article className="mc-card mc-card-body" key={mission.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                      <div>
                        <div className="mc-field-label">{mission.category === 'ACTIVITY' ? '운동' : '식사'} · {mission.source === 'AI' ? 'AI 추천' : '기본 추천'}</div>
                        <h3 style={{ margin: '6px 0', fontSize: 17 }}>{mission.title}</h3>
                      </div>
                      <span className={`mc-tag ${mission.status === 'COMPLETED' ? 'mc-tag-success' : 'mc-tag-warning'}`}>
                        {mission.status === 'COMPLETED' ? '완료' : '진행 전'}
                      </span>
                    </div>
                    <div className="mc-card-sub" style={{ lineHeight: 1.6 }}>{mission.description}</div>
                    <div className="mc-card-sub" style={{ marginTop: 8 }}>추천 이유: {mission.reason}</div>
                    {mission.status !== 'COMPLETED' && (
                      <button className="mc-btn mc-btn-primary" type="button" style={{ marginTop: 14 }} onClick={() => completeMission(mission.id)}>
                        미션 완료
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="health-management-section">
              <div className="mc-sec-head">
                <span className="mc-sec-title">오늘의 식사·운동 기록</span>
                <span className="mc-card-sub">{today}</span>
              </div>
              <form className="mc-card mc-card-body health-management-log" onSubmit={saveLog}>
              <div className="mc-grid-2">
                <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                  <legend className="mc-field-label" style={{ marginBottom: 8 }}>오늘의 식사</legend>
                  <label className="mc-form-field health-meal-description">
                    <span className="mc-card-sub">먹은 음식과 식사 내용을 문장으로 적어주세요</span>
                    <textarea className="mc-input" rows="4" maxLength="1000" placeholder="예: 아침에는 오트밀과 달걀을 먹었고, 점심에는 비빔밥을 먹었어요." value={log.mealDescription || ''} onChange={(event) => updateLog('mealDescription', event.target.value)} />
                  </label>
                  {log.mealReview && <div className="health-meal-review" aria-live="polite">
                    <strong>{log.mealReview.balanceLabel === 'BALANCED' ? '균형 잡힌 식사예요' : log.mealReview.balanceLabel === 'NEEDS_ATTENTION' ? '조금 더 챙기면 좋아요' : '식사 기록 평가'}</strong>
                    <p>{log.mealReview.summary}</p>
                    {log.mealReview.positivePoints?.length > 0 && <div>좋았던 점: {log.mealReview.positivePoints.join(' · ')}</div>}
                    {log.mealReview.improvements?.length > 0 && <div>다음 식사 제안: {log.mealReview.improvements.join(' · ')}</div>}
                    <small>입력한 음식 내용에 대한 참고 의견이며 진단이나 영양 처방이 아닙니다.</small>
                  </div>}
                </fieldset>
                <div>
                  <div className="mc-field-label" style={{ marginBottom: 8 }}>오늘의 운동</div>
                  <label className="mc-form-field health-meal-description">
                    <span className="mc-card-sub">운동 종류·시간·진행 방식을 문장으로 적어주세요</span>
                    <textarea className="mc-input" rows="4" maxLength="1000" placeholder="예: 퇴근 후 헬스장에서 하체 근력운동을 40분 하고, 실내 자전거를 15분 탔어요." value={log.exerciseDescription || ''} onChange={(event) => updateLog('exerciseDescription', event.target.value)} />
                  </label>
                  {log.exerciseReview && <div className="health-meal-review" aria-live="polite">
                    <strong>운동 기록 AI 평가</strong>
                    <div>운동 유형: {{ AEROBIC: '유산소', STRENGTH: '근력', FLEXIBILITY: '유연성', SPORT: '스포츠', MIXED: '복합', OTHER: '기타', UNKNOWN: '확인 어려움' }[log.exerciseReview.activityType] || '확인 어려움'} · 강도 참고: {{ LIGHT: '가벼움', MODERATE: '보통', HIGH: '높음', UNKNOWN: '정보 부족' }[log.exerciseReview.effortLabel] || '정보 부족'}</div>
                    <p>{log.exerciseReview.summary}</p>
                    {log.exerciseReview.positivePoints?.length > 0 && <div>좋았던 점: {log.exerciseReview.positivePoints.join(' · ')}</div>}
                    {log.exerciseReview.improvements?.length > 0 && <div>다음 활동 제안: {log.exerciseReview.improvements.join(' · ')}</div>}
                    <small>입력 내용에 대한 참고 의견이며 운동 처방이나 진단이 아닙니다.</small>
                  </div>}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="mc-btn mc-btn-primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '오늘 기록 저장'}</button>
              </div>
              </form>
            </section>
          </div>}

          {activeStage === 3 && <section className="health-management-section">
            <div className="mc-sec-head health-calendar-heading">
              <span className="mc-sec-title">건강 활동 달력</span>
              <div className="health-calendar-controls">
                <button className="mc-btn" type="button" aria-label="이전 달" disabled={calendarMonth <= earliestMonth} onClick={() => setCalendarMonth(previousMonth)}>←</button>
                <strong>{calendarMonth}</strong>
                <button className="mc-btn" type="button" aria-label="다음 달" disabled={nextMonth > currentMonthKst()} onClick={() => setCalendarMonth(nextMonth)}>→</button>
              </div>
            </div>
            <div className="mc-card mc-card-body health-calendar-card">
              <div className="health-calendar-grid" role="grid" aria-label={`${calendarMonth} 건강 활동 달력`}>
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => <div className="health-calendar-weekday" role="columnheader" key={day}>{day}</div>)}
                {Array.from({ length: calendarStartDay }, (_, index) => <div className="health-calendar-blank" role="gridcell" key={`blank-${index}`} />)}
                {Array.from({ length: calendarDayCount }, (_, index) => {
                  const dayNumber = index + 1;
                  const date = `${calendarMonth}-${String(dayNumber).padStart(2, '0')}`;
                  const activity = calendarByDate[date];
                  return (
                    <div className="health-calendar-day" role="gridcell" aria-label={`${date}${activity?.attendance ? ', 출석' : ''}${activity?.meal ? ', 식사 기록' : ''}${activity?.exercise ? ', 운동 기록' : ''}`} key={date}>
                      <span>{dayNumber}</span>
                      <div className="health-calendar-marks" aria-hidden="true">
                        {activity?.attendance && <i className="attendance" />}
                        {activity?.meal && <i className="meal" />}
                        {activity?.exercise && <i className="exercise" />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="health-calendar-legend">
                <span><i className="attendance" /> 출석</span>
                <span><i className="meal" /> 식사 기록/미션</span>
                <span><i className="exercise" /> 운동 기록/미션</span>
              </div>
            </div>
          </section>}

          {activeStage === 0 && <section className="health-management-section">
            <div className="mc-sec-head">
              <span className="mc-sec-title">당뇨 위험 참고 안내</span>
              <span className={`mc-tag ${level.tone}`}>{level.label}</span>
            </div>
            <div className="mc-card mc-card-body health-management-guidance">
              <div className="health-management-guidance-main">
                <div style={{ fontWeight: 700, lineHeight: 1.6 }}>{assessment?.guidance}</div>
                {assessment?.recommendHba1c && (
                  <div className="mc-alert mc-alert-blue" style={{ marginTop: 12 }}>
                    최근 검진 수치를 바탕으로 당화혈색소(HbA1c) 검사를 의료기관과 상담해보세요.
                  </div>
                )}
                {assessment?.signals?.length > 0 && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 20, color: 'var(--text-2)', lineHeight: 1.8 }}>
                    {assessment.signals.map((signal, index) => (
                      <li key={`${signal.name}-${index}`}>
                        <strong>{signal.name}</strong>: {signal.detail}{signal.date ? ` (${signal.date})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {assessment?.actions?.length > 0 && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
                    {assessment.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                )}
                {aiGuidance?.guidance && (
                  <div className="health-ai-guidance">
                    <div className="mc-field-label">나를 위한 AI 건강 가이드</div>
                    <p>{aiGuidance.guidance.summary}</p>
                    {aiGuidance.guidance.mealRecommendations?.length > 0 && <ul>{aiGuidance.guidance.mealRecommendations.map((item, index) => <li key={`meal-${index}`}>{item}</li>)}</ul>}
                    {aiGuidance.guidance.actions?.length > 0 && <ul>{aiGuidance.guidance.actions.map((item, index) => <li key={`action-${index}`}>{item}</li>)}</ul>}
                  </div>
                )}
                {assessment?.aiProcessingConsent && !aiGuidance && (
                  <div className="mc-card-sub" role="status" style={{ marginTop: 12 }}>AI 가이드를 불러오지 못해 규칙 기반 안내를 표시하고 있습니다.</div>
                )}
                <div className="mc-card-sub" style={{ marginTop: 12 }}>{assessment?.disclaimer}</div>
              </div>
              <div className="health-management-family-history">
                {!assessment?.onboardingComplete && <div className="health-first-setup">
                  <div className="mc-field-label">처음 이용하시나요?</div>
                  <p className="mc-card-sub">초기 건강 정보는 한 번만 입력합니다. 저장하면 다음 방문부터 이 질문은 표시되지 않습니다.</p>
                  <button className="mc-btn mc-btn-primary" type="button" onClick={() => setActiveStage(1)}>초기 건강 정보 입력</button>
                </div>}
                <button className="mc-btn" type="button" onClick={() => setShowAiSettings((value) => !value)}>
                  {showAiSettings ? 'AI 동의 설정 닫기' : 'AI 분석 동의 설정'}
                </button>
                {showAiSettings && <div className="health-ai-consent-settings">
                  <label className="mc-form-field">
                    <span className="mc-field-label">개인화 AI 분석</span>
                    <select className="mc-select" value={aiConsent} onChange={(event) => setAiConsent(event.target.value)}>
                      <option value="true">동의</option>
                      <option value="false">동의하지 않음</option>
                    </select>
                    <span className="mc-card-sub">동의하면 식사·운동 문장과 필요한 건강 정보가 AI 제공업체로 전송됩니다. 이름과 병원명은 보내지 않습니다.</span>
                  </label>
                  <button className="mc-btn mc-btn-primary" type="button" onClick={saveAiConsent}>설정 저장</button>
                </div>}
              </div>
            </div>
          </section>}

          {activeStage === 1 && <>
          {assessment?.onboardingComplete && <div className="mc-card mc-card-body health-checkup-status-card">
            <div className="mc-field-label">건강검진 이력</div>
            <p>{assessment.checkupDate ? `최근 검진 기록이 있습니다 · ${assessment.checkupDate}` : assessment.healthCheckupStatus === 'NEVER' ? '아직 건강검진 기록이 없습니다.' : '건강검진을 받은 적이 있는지 등록된 정보가 없습니다.'}</p>
          </div>}
          {assessment && !assessment.onboardingComplete && <div className="mc-card mc-card-body health-checkup-status-card">
            <div className="mc-field-label">당화혈색소 검사 기록</div>
            <p>검진 이력을 입력한 다음 검사 기록을 추가할 수 있어요.</p>
          </div>}
          <section className="health-management-section">
            <div className="mc-sec-head">
              <span className="mc-sec-title">당화혈색소 검사 기록</span>
            </div>
            <div className="mc-two-col">
              <form className="mc-card mc-card-body" onSubmit={submitHba1c}>
                <div className="mc-field-label" style={{ marginBottom: 12 }}>{editingId ? '검사 기록 수정' : '검사 결과 입력'}</div>
                <label className="mc-form-field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="mc-card-sub">검사일</span>
                  <input className="mc-input" type="date" max={today} value={testForm.testDate} required onChange={(event) => setTestForm({ ...testForm, testDate: event.target.value })} />
                </label>
                <label className="mc-form-field" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="mc-card-sub">당화혈색소 (%)</span>
                  <input className="mc-input" type="number" min="3" max="20" step="0.1" required value={testForm.value} onChange={(event) => setTestForm({ ...testForm, value: event.target.value })} />
                </label>
                <label className="mc-form-field" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="mc-card-sub">병원명 (선택)</span>
                  <input className="mc-input" maxLength="150" value={testForm.organizationName} onChange={(event) => setTestForm({ ...testForm, organizationName: event.target.value })} />
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="mc-btn mc-btn-primary" type="submit" disabled={saving}>{saving ? '저장 중...' : editingId ? '수정 저장' : '검사 결과 저장'}</button>
                  {editingId && <button className="mc-btn" type="button" onClick={() => { setEditingId(null); setTestForm({ testDate: today, value: '', organizationName: '', note: '' }); }}>취소</button>}
                </div>
              </form>
              <div className="mc-card mc-card-body">
                {results.length === 0 ? (
                  <div className="mc-card-sub">등록된 검사 결과가 없습니다.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="mc-tbl" style={{ minWidth: 390 }}>
                      <thead><tr><th>검사일</th><th>HbA1c</th><th>병원</th><th>관리</th></tr></thead>
                      <tbody>
                        {results.map((result) => (
                          <tr key={result.id}>
                            <td>{result.testDate}</td><td><strong>{result.value}%</strong></td>
                            <td>{result.organizationName || '-'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button className="mc-btn" type="button" onClick={() => editHba1c(result)}>수정</button>{' '}
                              <button className="mc-btn" type="button" onClick={() => deleteHba1c(result.id)}>삭제</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {assessment?.latestHba1c && (
                  <div className="mc-alert mc-alert-blue" style={{ marginTop: 12 }}>
                    {Number(assessment.latestHba1c.value) >= 6.5
                      ? '검사 결과가 당뇨 진단 참고 기준에 해당할 수 있습니다. 의료기관에서 확인받으세요.'
                      : Number(assessment.latestHba1c.value) >= 5.7
                        ? '경계 참고 범위입니다. 생활습관 관리와 검사 결과 상담을 고려하세요.'
                        : '해당 검사값은 참고 범위에 있습니다. 정기적인 건강 관리를 이어가세요.'}
                  </div>
                )}
                <div className="mc-card-sub" style={{ marginTop: 10 }}>수치 안내는 참고용이며 진단과 치료는 의료진과 상담하세요.</div>
              </div>
            </div>
          </section>
          </>}
        </>
      )}
    </div>
  );
}
