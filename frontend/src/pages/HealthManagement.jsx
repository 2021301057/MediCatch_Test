import React, { useCallback, useEffect, useState } from 'react';
import { healthAPI } from '../api/services';
import MobileNavMenu from '../components/common/MobileNavMenu';

const todayKst = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const EMPTY_LOG = {
  mealQuality: '',
  highSugarIntake: false,
  lateNightMeal: false,
  walkingMinutes: '',
  stepCount: '',
  exerciseCompleted: false,
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
  const [familyHistory, setFamilyHistory] = useState('');
  const [log, setLog] = useState(EMPTY_LOG);
  const [editingId, setEditingId] = useState(null);
  const [testForm, setTestForm] = useState({ testDate: today, value: '', organizationName: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const [assessmentResult, resultsResult, missionsResult, logResult] = await Promise.allSettled([
      healthAPI.getDiabetesAssessment(),
      healthAPI.getHba1cResults(),
      healthAPI.getTodayMissions(),
      healthAPI.getDailyHealthLog(today),
    ]);
    if (assessmentResult.status === 'fulfilled') {
      const data = assessmentResult.value;
      setAssessment(data);
      setFamilyHistory(data.familyHistoryDiabetes == null ? '' : String(data.familyHistoryDiabetes));
    }
    if (resultsResult.status === 'fulfilled') setResults(Array.isArray(resultsResult.value) ? resultsResult.value : []);
    if (missionsResult.status === 'fulfilled') setMissions(Array.isArray(missionsResult.value) ? missionsResult.value : []);
    if (logResult.status === 'fulfilled') setLog({ ...EMPTY_LOG, ...logResult.value,
      walkingMinutes: logResult.value.walkingMinutes ?? '',
      stepCount: logResult.value.stepCount ?? '',
    });
    if ([assessmentResult, resultsResult, missionsResult, logResult].some((result) => result.status === 'rejected')) {
      setMessage('일부 건강 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const updateLog = (key, value) => setLog((current) => ({ ...current, [key]: value }));

  const saveRiskProfile = async () => {
    try {
      const updated = await healthAPI.saveDiabetesRiskProfile({
        familyHistoryDiabetes: familyHistory === '' ? null : familyHistory === 'true',
      });
      setAssessment(updated);
      setMessage('가족력 응답을 저장했습니다.');
    } catch {
      setMessage('가족력 응답을 저장하지 못했습니다.');
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
      setMessage('당화혈색소 기록을 저장했습니다.');
      await load();
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
      setMessage('검사 기록을 삭제했습니다.');
      await load();
    } catch {
      setMessage('검사 기록을 삭제하지 못했습니다.');
    }
  };

  const saveLog = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await healthAPI.saveDailyHealthLog(today, {
        ...log,
        walkingMinutes: log.walkingMinutes === '' ? null : Number(log.walkingMinutes),
        stepCount: log.stepCount === '' ? null : Number(log.stepCount),
      });
      setMessage('오늘의 식사·운동 기록을 저장했습니다.');
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
    } catch {
      setMessage('미션 상태를 저장하지 못했습니다.');
    }
  };

  const level = LEVELS[assessment?.level] || LEVELS.NO_DATA;

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
          <div className="health-management-daily-grid">
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
                        <div className="mc-field-label">{mission.category === 'ACTIVITY' ? '운동' : '식사'}</div>
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
                  <legend className="mc-field-label" style={{ marginBottom: 8 }}>식사 상태</legend>
                  <div className="mc-row-wrap">
                    {[['GOOD', '좋음'], ['FAIR', '보통'], ['POOR', '나쁨']].map(([value, label]) => (
                      <button key={value} type="button" className={`mc-chip${log.mealQuality === value ? ' active' : ''}`} onClick={() => updateLog('mealQuality', value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="mc-check-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={log.highSugarIntake} onChange={(event) => updateLog('highSugarIntake', event.target.checked)} />
                    당류가 많은 음식이나 음료를 먹었어요
                  </label>
                  <label className="mc-check-row" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={log.lateNightMeal} onChange={(event) => updateLog('lateNightMeal', event.target.checked)} />
                    야식을 먹었어요
                  </label>
                </fieldset>
                <div>
                  <div className="mc-field-label" style={{ marginBottom: 8 }}>운동</div>
                  <div className="mc-grid-2">
                    <label className="mc-form-field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="mc-card-sub">걷기 시간 (분)</span>
                      <input className="mc-input" type="number" min="0" max="1440" value={log.walkingMinutes} onChange={(event) => updateLog('walkingMinutes', event.target.value)} />
                    </label>
                    <label className="mc-form-field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="mc-card-sub">걸음 수</span>
                      <input className="mc-input" type="number" min="0" max="100000" value={log.stepCount} onChange={(event) => updateLog('stepCount', event.target.value)} />
                    </label>
                  </div>
                  <label className="mc-check-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={log.exerciseCompleted} onChange={(event) => updateLog('exerciseCompleted', event.target.checked)} />
                    오늘 운동을 완료했어요
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="mc-btn mc-btn-primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '오늘 기록 저장'}</button>
              </div>
              </form>
            </section>
          </div>

          <section className="health-management-section">
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
                <div className="mc-card-sub" style={{ marginTop: 12 }}>{assessment?.disclaimer}</div>
              </div>
              <div className="health-management-family-history">
                <label className="mc-form-field">
                  <span className="mc-field-label">당뇨 가족력 (선택)</span>
                  <select className="mc-select" value={familyHistory} onChange={(event) => setFamilyHistory(event.target.value)}>
                    <option value="">응답하지 않음</option>
                    <option value="true">있음</option>
                    <option value="false">없음</option>
                  </select>
                </label>
                <button className="mc-btn mc-btn-primary" type="button" onClick={saveRiskProfile}>저장</button>
              </div>
            </div>
          </section>

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
        </>
      )}
    </div>
  );
}
