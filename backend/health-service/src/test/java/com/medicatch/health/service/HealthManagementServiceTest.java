package com.medicatch.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.health.client.HealthAiClient;
import com.medicatch.health.dto.DailyHealthLogRequest;
import com.medicatch.health.dto.DiabetesOnboardingRequest;
import com.medicatch.health.entity.DailyHealthLog;
import com.medicatch.health.entity.DailyHealthMission;
import com.medicatch.health.entity.DiabetesRiskProfile;
import com.medicatch.health.entity.HealthDailyAttendance;
import com.medicatch.health.entity.HealthMealReview;
import com.medicatch.health.entity.HealthExerciseReview;
import com.medicatch.health.entity.HealthAiAssessment;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.DailyHealthLogRepository;
import com.medicatch.health.repository.DailyHealthMissionRepository;
import com.medicatch.health.repository.DiabetesRiskProfileRepository;
import com.medicatch.health.repository.Hba1cResultRepository;
import com.medicatch.health.repository.HealthAiAssessmentRepository;
import com.medicatch.health.repository.HealthDailyAttendanceRepository;
import com.medicatch.health.repository.HealthMealReviewRepository;
import com.medicatch.health.repository.HealthExerciseReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthManagementServiceTest {
    @Mock private CheckupResultRepository checkupResultRepository;
    @Mock private Hba1cResultRepository hba1cResultRepository;
    @Mock private DiabetesRiskProfileRepository diabetesRiskProfileRepository;
    @Mock private DailyHealthLogRepository dailyHealthLogRepository;
    @Mock private DailyHealthMissionRepository dailyHealthMissionRepository;
    @Mock private HealthAiAssessmentRepository healthAiAssessmentRepository;
    @Mock private HealthDailyAttendanceRepository healthDailyAttendanceRepository;
    @Mock private HealthMealReviewRepository healthMealReviewRepository;
    @Mock private HealthExerciseReviewRepository healthExerciseReviewRepository;
    @Mock private HealthAiClient healthAiClient;

    private HealthManagementService service;

    @BeforeEach
    void setUp() {
        service = new HealthManagementService(checkupResultRepository, hba1cResultRepository,
                diabetesRiskProfileRepository, dailyHealthLogRepository, dailyHealthMissionRepository,
                healthAiAssessmentRepository, healthDailyAttendanceRepository, healthMealReviewRepository,
                healthExerciseReviewRepository, healthAiClient, new ObjectMapper());
    }

    @Test
    void onboardingStoresExplicitUnknownAnswersAndConsentChoice() {
        long userId = 42L;
        AtomicReference<DiabetesRiskProfile> stored = new AtomicReference<>();
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenAnswer(invocation -> Optional.ofNullable(stored.get()));
        when(diabetesRiskProfileRepository.save(any())).thenAnswer(invocation -> {
            DiabetesRiskProfile profile = invocation.getArgument(0);
            stored.set(profile);
            return profile;
        });
        when(checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId)).thenReturn(List.of());
        when(hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId)).thenReturn(List.of());

        Map<String, Object> result = service.completeDiabetesOnboarding(userId,
                new DiabetesOnboardingRequest("UNKNOWN", null, "NOT_TESTED", "UNKNOWN", false, null));

        assertEquals(true, result.get("onboardingComplete"));
        assertEquals(false, result.get("aiProcessingConsent"));
        verify(diabetesRiskProfileRepository).save(argThat(profile ->
                "UNKNOWN".equals(profile.getDiagnosisStatus())
                        && "NOT_TESTED".equals(profile.getHba1cTestStatus())
                        && profile.getFamilyHistoryDiabetes() == null
                        && Boolean.FALSE.equals(profile.getAiProcessingConsent())
                        && profile.getOnboardingCompletedAt() != null));
    }

    @Test
    void aiGuidanceIsRejectedWithoutUserConsent() {
        DiabetesRiskProfile profile = DiabetesRiskProfile.builder()
                .userId(42L).onboardingCompletedAt(java.time.LocalDateTime.now()).aiProcessingConsent(false).build();
        when(diabetesRiskProfileRepository.findByUserId(42L)).thenReturn(Optional.of(profile));

        assertThrows(IllegalStateException.class, () -> service.generateAiGuidance(42L));
        verifyNoInteractions(healthAiClient);
        verifyNoInteractions(healthAiAssessmentRepository);
    }

    @Test
    void exerciseNarrativeIsReviewedAndPersistedWhenConsentIsGranted() {
        long userId = 42L;
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Seoul"));
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(
                DiabetesRiskProfile.builder().userId(userId).aiProcessingConsent(true).build()));
        when(dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)).thenReturn(Optional.of(
                DailyHealthLog.builder().userId(userId).logDate(date)
                        .exerciseDescription("퇴근 후 실내 자전거를 20분 탔어요.").build()));
        when(healthExerciseReviewRepository.findByUserIdAndLogDateAndInputHash(eq(userId), eq(date), anyString()))
                .thenReturn(Optional.empty());
        when(healthAiClient.completeJson(anyString(), anyString())).thenReturn("""
                {"activityType":"AEROBIC","effortLabel":"MODERATE","summary":"실내 자전거를 20분 수행했습니다.","positivePoints":["운동 시간을 기록했어요"],"improvements":["마친 뒤 가볍게 스트레칭하세요"]}
                """);
        when(healthAiClient.getModel()).thenReturn("test-model");
        when(healthExerciseReviewRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> review = service.reviewDailyExercise(userId, date);

        assertEquals("AEROBIC", review.get("activityType"));
        assertEquals("MODERATE", review.get("effortLabel"));
        assertEquals("실내 자전거를 20분 수행했습니다.", review.get("summary"));
        ArgumentCaptor<String> systemPrompt = ArgumentCaptor.forClass(String.class);
        verify(healthAiClient).completeJson(systemPrompt.capture(), anyString());
        assertTrue(systemPrompt.getValue().contains("자연스러운 한국어로만 작성"));
        assertTrue(systemPrompt.getValue().contains("영어 문장이나 표현을 섞지 마세요"));
        verify(healthExerciseReviewRepository).saveAndFlush(argThat(saved ->
                saved.getExerciseDescription().contains("실내 자전거")
                        && saved.getReviewJson().contains("AEROBIC")
                        && saved.getUserId().equals(userId)));
    }

    @Test
    void mealReviewUsesValidatedAiScoreAndPersistsStructuredResult() {
        long userId = 42L;
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Seoul"));
        String description = "끼니별 빠른 기록\n아침: 밥·잡곡밥\n점심: 기록 없음\n저녁: 기록 없음";
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(
                DiabetesRiskProfile.builder().userId(userId).aiProcessingConsent(true).build()));
        when(dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)).thenReturn(Optional.of(
                DailyHealthLog.builder().userId(userId).logDate(date).mealDescription(description).build()));
        when(healthMealReviewRepository.findByUserIdAndLogDateAndInputHash(eq(userId), eq(date), anyString()))
                .thenReturn(Optional.empty());
        when(healthAiClient.completeJson(anyString(), anyString())).thenReturn("""
                {"balanceLabel":"BALANCED","balanceScore":82,"balanceRationale":"기록된 식사에 곡류와 채소가 포함되어 있습니다.","summary":"채소를 포함한 식사입니다.","positivePoints":[],"improvements":[]}
                """);
        when(healthAiClient.getModel()).thenReturn("test-model");
        when(healthMealReviewRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> review = service.reviewDailyMeal(userId, date);

        assertFalse(review.containsKey("balanceScore"));
        assertFalse(review.containsKey("balanceRationale"));
        ArgumentCaptor<String> systemPrompt = ArgumentCaptor.forClass(String.class);
        verify(healthAiClient).completeJson(systemPrompt.capture(), anyString());
        assertTrue(systemPrompt.getValue().contains("끼니 수나 기록 완성도는 점수에 반영하지 마세요"));
        verify(healthMealReviewRepository).saveAndFlush(argThat(saved ->
                saved.getMealDescription().equals(description)
                        && saved.getReviewJson().contains("balanceScore")
                        && saved.getUserId().equals(userId)));
    }

    @Test
    void duplicateMealReviewInsertReusesTheAlreadyPersistedResult() {
        long userId = 42L;
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Seoul"));
        String description = "아침에 잡곡밥과 채소를 먹었습니다.";
        HealthMealReview existing = HealthMealReview.builder().userId(userId).logDate(date)
                .mealDescription(description).reviewJson("{\"balanceLabel\":\"BALANCED\",\"balanceScore\":80}")
                .inputHash("same-hash").modelName("test-model").build();
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(
                DiabetesRiskProfile.builder().userId(userId).aiProcessingConsent(true).build()));
        when(dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)).thenReturn(Optional.of(
                DailyHealthLog.builder().userId(userId).logDate(date).mealDescription(description).build()));
        when(healthMealReviewRepository.findByUserIdAndLogDateAndInputHash(eq(userId), eq(date), anyString()))
                .thenReturn(Optional.empty(), Optional.of(existing));
        when(healthAiClient.completeJson(anyString(), anyString())).thenReturn("""
                {"balanceLabel":"BALANCED","balanceScore":80,"balanceRationale":"균형이 좋습니다.","summary":"좋습니다.","positivePoints":[],"improvements":[]}
                """);
        when(healthAiClient.getModel()).thenReturn("test-model");
        when(healthMealReviewRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));

        Map<String, Object> review = service.reviewDailyMeal(userId, date);

        assertFalse(review.containsKey("balanceScore"));
        verify(healthMealReviewRepository, times(2))
                .findByUserIdAndLogDateAndInputHash(eq(userId), eq(date), anyString());
    }

    @Test
    void dailyLogSaveUsesAtomicUserDateUpsertAndReturnsPersistedRecord() {
        long userId = 42L;
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Seoul"));
        DailyHealthLog saved = DailyHealthLog.builder().userId(userId).logDate(date)
                .mealDescription("아침: 밥").exerciseDescription("걷기 20분").build();
        when(dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)).thenReturn(Optional.of(saved));
        when(healthMealReviewRepository.findByUserIdAndLogDateAndInputHash(eq(userId), eq(date), anyString()))
                .thenReturn(Optional.empty());
        when(healthExerciseReviewRepository.findByUserIdAndLogDateAndInputHash(eq(userId), eq(date), anyString()))
                .thenReturn(Optional.empty());

        Map<String, Object> result = service.saveDailyLog(userId, date,
                new DailyHealthLogRequest(null, "아침: 밥", "걷기 20분", false, false, null, null, false));

        assertEquals("아침: 밥", result.get("mealDescription"));
        assertEquals("걷기 20분", result.get("exerciseDescription"));
        verify(dailyHealthLogRepository).upsertDailyLog(userId, date, null, "아침: 밥", "걷기 20분", false, false);
    }

    @Test
    void todayMissionsUseRecentRecordsAndAvoidRecentlyUsedMissionCodes() {
        long userId = 42L;
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        DiabetesRiskProfile profile = DiabetesRiskProfile.builder().userId(userId)
                .onboardingCompletedAt(LocalDateTime.now()).aiProcessingConsent(false).build();
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateOrderByCategoryAsc(userId, today))
                .thenReturn(List.of());
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, today.minusDays(6), today))
                .thenReturn(List.of(
                        DailyHealthLog.builder().userId(userId).logDate(today.minusDays(1))
                                .mealDescription("끼니별 빠른 기록\n아침: 단 음료\n점심: 기록 없음\n저녁: 기록 없음").build(),
                        DailyHealthLog.builder().userId(userId).logDate(today.minusDays(2))
                                .mealDescription("끼니별 빠른 기록\n아침: 단 음료\n점심: 기록 없음\n저녁: 기록 없음").build()));
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, today.minusDays(3), today.minusDays(1)))
                .thenReturn(List.of(
                        DailyHealthMission.builder().code("MEAL_DRINK_SWAP").build(),
                        DailyHealthMission.builder().code("MEAL_ADD_VEGETABLE").build(),
                        DailyHealthMission.builder().code("ACTIVITY_START_WALK").build()));
        when(dailyHealthMissionRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<Map<String, Object>> missions = service.getTodayMissions(userId);

        assertEquals(2, missions.size());
        assertTrue(missions.stream().anyMatch(mission -> "MEAL_BALANCED_PLATE".equals(mission.get("code"))));
        assertTrue(missions.stream().anyMatch(mission -> "ACTIVITY_STRETCH".equals(mission.get("code"))));
        assertTrue(missions.stream().allMatch(mission -> "RULE".equals(mission.get("source"))));
        verifyNoInteractions(healthAiClient);
    }

    @Test
    void todayMissionsFallBackToPersonalizedRulesWhenAiIsUnavailable() {
        long userId = 42L;
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        DiabetesRiskProfile profile = DiabetesRiskProfile.builder().userId(userId)
                .onboardingCompletedAt(LocalDateTime.now()).aiProcessingConsent(true).build();
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateOrderByCategoryAsc(userId, today))
                .thenReturn(List.of());
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, today.minusDays(6), today))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, today.minusDays(3), today.minusDays(1)))
                .thenReturn(List.of());
        when(checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId)).thenReturn(List.of());
        when(hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId)).thenReturn(List.of());
        when(healthAiAssessmentRepository.findByUserIdAndInputHashAndPromptVersion(eq(userId), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(healthAiClient.completeJson(anyString(), anyString())).thenThrow(new IllegalStateException("AI unavailable"));
        when(dailyHealthMissionRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<Map<String, Object>> missions = service.getTodayMissions(userId);

        assertEquals(2, missions.size());
        assertTrue(missions.stream().allMatch(mission -> "RULE".equals(mission.get("source"))));
        assertTrue(missions.stream().anyMatch(mission -> "ACTIVITY_START_WALK".equals(mission.get("code"))));
        assertTrue(missions.stream().anyMatch(mission -> "MEAL_BALANCED_PLATE".equals(mission.get("code"))));
    }

    @Test
    void todayMissionsOnlyUseAiWordingForTheSelectedSafeCandidateCode() {
        long userId = 42L;
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        DiabetesRiskProfile profile = DiabetesRiskProfile.builder().userId(userId)
                .onboardingCompletedAt(LocalDateTime.now()).aiProcessingConsent(true).build();
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateOrderByCategoryAsc(userId, today))
                .thenReturn(List.of());
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, today.minusDays(6), today))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, today.minusDays(3), today.minusDays(1)))
                .thenReturn(List.of());
        when(checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId)).thenReturn(List.of());
        when(hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId)).thenReturn(List.of());
        when(healthAiAssessmentRepository.findByUserIdAndInputHashAndPromptVersion(eq(userId), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(healthAiClient.completeJson(anyString(), anyString())).thenReturn("""
                {"summary":"생활습관을 이어가세요.","mealRecommendations":[],"actions":[],"missions":[
                  {"category":"ACTIVITY","code":"ACTIVITY_START_WALK","title":"천천히 10분 걷기","description":"편한 속도로 걸어보세요.","reason":"짧게 시작해보세요."},
                  {"category":"MEAL","code":"UNAPPROVED_CODE","title":"고강도 달리기","description":"무리한 목표","reason":"추천 이유"}]}
                """);
        when(healthAiClient.getModel()).thenReturn("test-model");
        when(healthAiAssessmentRepository.save(any())).thenAnswer(invocation -> {
            HealthAiAssessment saved = invocation.getArgument(0);
            saved.setId(77L);
            return saved;
        });
        when(dailyHealthMissionRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<Map<String, Object>> missions = service.getTodayMissions(userId);

        Map<String, Object> activity = missions.stream().filter(mission -> "ACTIVITY".equals(mission.get("category")))
                .findFirst().orElseThrow();
        Map<String, Object> meal = missions.stream().filter(mission -> "MEAL".equals(mission.get("category")))
                .findFirst().orElseThrow();
        assertEquals("AI", activity.get("source"));
        assertEquals("천천히 10분 걷기", activity.get("title"));
        assertEquals("RULE", meal.get("source"));
        assertEquals("MEAL_BALANCED_PLATE", meal.get("code"));
        assertFalse("고강도 달리기".equals(meal.get("title")));
    }

    @Test
    void weeklySummaryComparesCurrentWeekToTheSameElapsedDaysLastWeek() {
        long userId = 42L;
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate weekStart = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        int elapsedDays = (int) java.time.temporal.ChronoUnit.DAYS.between(weekStart, today) + 1;
        LocalDate comparisonStart = weekStart.minusDays(7);
        LocalDate comparisonEnd = comparisonStart.plusDays(elapsedDays - 1L);
        String mealDescription = "끼니별 빠른 기록\n아침: 밥·잡곡밥\n점심: 기록 없음\n저녁: 기록 없음";
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, weekStart, today))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(today)
                        .mealDescription(mealDescription).exerciseDescription("운동 빠른 기록\n종류: 걷기\n시간: 20분").build()));
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, comparisonStart, comparisonEnd))
                .thenReturn(List.of());
        when(healthMealReviewRepository.findByUserIdAndLogDateBetween(userId, weekStart, today)).thenReturn(List.of());
        when(healthMealReviewRepository.findByUserIdAndLogDateBetween(userId, comparisonStart, comparisonEnd)).thenReturn(List.of());
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, weekStart, today))
                .thenReturn(List.of(HealthDailyAttendance.builder().userId(userId).attendanceDate(today).build()));
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, comparisonStart, comparisonEnd))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, weekStart, today))
                .thenReturn(List.of(DailyHealthMission.builder().status("COMPLETED").build()));
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, comparisonStart, comparisonEnd))
                .thenReturn(List.of());

        Map<String, Object> summary = service.getWeeklySummary(userId);

        assertEquals(weekStart, summary.get("weekStart"));
        assertEquals(today, summary.get("weekEnd"));
        assertEquals(elapsedDays, summary.get("daysElapsed"));
        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = (Map<String, Object>) summary.get("metrics");
        assertEquals(1, metrics.get("attendanceDays"));
        assertEquals(1, metrics.get("mealRecordDays"));
        assertEquals(1, metrics.get("exerciseDays"));
        assertEquals(20, metrics.get("exerciseMinutes"));
        assertEquals(1, metrics.get("completedMissions"));
        assertEquals(1, metrics.get("availableMissions"));
        assertNull(metrics.get("mealAverageScore"));
        assertEquals("지난주 같은 기간보다 식사 기록이 1일 늘었어요.", summary.get("headline"));
        verify(dailyHealthLogRepository).findByUserIdAndLogDateBetween(userId, comparisonStart, comparisonEnd);
    }

    @Test
    void consentedAiGuidanceIsNormalizedAndPersistedWithoutProviderIdentifiers() {
        long userId = 42L;
        DiabetesRiskProfile profile = DiabetesRiskProfile.builder().userId(userId)
                .diagnosisStatus("UNKNOWN").hba1cTestStatus("NOT_TESTED")
                .aiProcessingConsent(true).onboardingCompletedAt(java.time.LocalDateTime.now()).build();
        when(diabetesRiskProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId)).thenReturn(List.of());
        when(hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId)).thenReturn(List.of());
        when(healthAiAssessmentRepository.findByUserIdAndInputHashAndPromptVersion(eq(userId), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(healthAiClient.completeJson(anyString(), anyString())).thenReturn("""
                {"summary":"생활습관 관리를 이어가세요.","mealRecommendations":["물 선택하기"],"actions":["걷기 기록하기"],"missions":[]}
                """);
        when(healthAiClient.getModel()).thenReturn("test-model");
        when(healthAiAssessmentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> response = service.generateAiGuidance(userId);

        assertEquals("NO_DATA", response.get("riskLevel"));
        @SuppressWarnings("unchecked")
        Map<String, Object> guidance = (Map<String, Object>) response.get("guidance");
        assertEquals("생활습관 관리를 이어가세요.", guidance.get("summary"));
        ArgumentCaptor<HealthAiAssessment> saved = ArgumentCaptor.forClass(HealthAiAssessment.class);
        verify(healthAiAssessmentRepository).save(saved.capture());
        assertTrue(saved.getValue().getOutputJson().contains("물 선택하기"));
        assertFalse(saved.getValue().getInputSnapshot().contains("organizationName"));
    }

    @Test
    void calendarCombinesAttendanceLogsAndCompletedMissionsByDate() {
        long userId = 42L;
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
        LocalDate first = month.atDay(1);
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, first, month.atEndOfMonth()))
                .thenReturn(List.of(HealthDailyAttendance.builder().userId(userId).attendanceDate(first).build()));
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, first, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(first.plusDays(1))
                        .mealQuality("GOOD").build()));
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, first, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthMission.builder().userId(userId).missionDate(first.plusDays(2))
                        .category("ACTIVITY").status("COMPLETED").build()));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) service.getCalendar(userId, month).get("days");

        assertEquals(month.lengthOfMonth(), days.size());
        assertEquals(true, days.get(0).get("attendance"));
        assertEquals(true, days.get(1).get("meal"));
        assertEquals(true, days.get(2).get("exercise"));
        assertEquals(false, days.get(2).get("attendance"));
    }

    @Test
    void calendarUsesAiMealReviewAndExerciseDurationForScores() throws Exception {
        long userId = 42L;
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
        LocalDate date = month.atDay(1);
        String mealDescription = "끼니별 빠른 기록\n아침: 밥·잡곡밥\n점심: 기록 없음\n저녁: 채소";
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(date)
                        .mealDescription(mealDescription)
                        .exerciseDescription("운동 빠른 기록\n종류: 걷기\n시간: 20분")
                        .build()));
        when(healthMealReviewRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(HealthMealReview.builder().userId(userId).logDate(date)
                        .inputHash(mealReviewHash(mealDescription))
                        .reviewJson("{\"balanceLabel\":\"NEEDS_ATTENTION\",\"balanceScore\":40,\"improvements\":[\"채소를 조금 더 챙겨보세요.\"]}").build()));
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) service.getCalendar(userId, month).get("days");
        Map<String, Object> day = days.get(0);

        assertEquals(2, day.get("mealRecordedCount"));
        assertEquals(51, day.get("mealScore"));
        assertEquals(20, day.get("exerciseMinutes"));
        assertEquals(67, day.get("exerciseScore"));
        assertEquals("채소를 조금 더 챙겨보세요.", day.get("mealScoreReason"));
        assertEquals("20분 운동을 기록했어요.", day.get("exerciseScoreReason"));
        assertEquals(59, day.get("totalScore"));
        assertEquals(2, day.get("scoredCategoryCount"));
    }

    @Test
    void calendarNeverAwardsMealBalanceScoreWhenAllMealsAreSkipped() throws Exception {
        long userId = 42L;
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
        LocalDate date = month.atDay(1);
        String mealDescription = "끼니별 빠른 기록\n아침: 먹지 않음\n점심: 먹지 않음\n저녁: 먹지 않음";
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(date)
                        .mealDescription(mealDescription).build()));
        when(healthMealReviewRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(HealthMealReview.builder().userId(userId).logDate(date)
                        .inputHash(mealReviewHash(mealDescription))
                        .reviewJson("{\"balanceLabel\":\"BALANCED\",\"balanceScore\":100}").build()));
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) service.getCalendar(userId, month).get("days");

        assertEquals(0, days.get(0).get("mealRecordedCount"));
        assertNull(days.get(0).get("mealScore"));
        assertNull(days.get(0).get("totalScore"));
        assertTrue(((String) days.get(0).get("mealScoreReason")).contains("식사한 끼니가 없어"));
    }

    @Test
    void mealScoreCombinesActualMealCoverageWithAiCompositionScore() throws Exception {
        long userId = 42L;
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
        LocalDate date = month.atDay(1);
        String mealDescription = "끼니별 빠른 기록\n아침: 밥·잡곡밥\n점심: 기록 없음\n저녁: 기록 없음";
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(date)
                        .mealDescription(mealDescription).build()));
        when(healthMealReviewRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(HealthMealReview.builder().userId(userId).logDate(date)
                        .inputHash(mealReviewHash(mealDescription))
                        .reviewJson("{\"balanceLabel\":\"BALANCED\",\"balanceScore\":100}").build()));
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) service.getCalendar(userId, month).get("days");
        Map<String, Object> day = days.get(0);

        assertEquals(1, day.get("mealRecordedCount"));
        assertEquals(73, day.get("mealScore"));
        assertFalse(((String) day.get("mealScoreReason")).contains("40:60"));
        assertFalse(((String) day.get("mealScoreReason")).contains("AI 식사 구성 평가"));
        assertEquals(73, day.get("totalScore"));
        assertEquals(1, day.get("scoredCategoryCount"));
    }

    @Test
    void calendarDoesNotScoreRestDaysOrUnspecifiedExerciseDurationAsZero() {
        long userId = 42L;
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
        LocalDate date = month.atDay(1);
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(date)
                                .exerciseDescription("운동 빠른 기록\n종류: 오늘은 운동하지 않음\n시간: 운동하지 않음").build(),
                        DailyHealthLog.builder().userId(userId).logDate(date.plusDays(1))
                                .exerciseDescription("평소보다 오래 걸었어요.").build()));
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) service.getCalendar(userId, month).get("days");

        assertNull(days.get(0).get("exerciseScore"));
        assertNull(days.get(0).get("totalScore"));
        assertNull(days.get(1).get("exerciseScore"));
        assertNull(days.get(1).get("totalScore"));
    }

    private static String mealReviewHash(String description) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(("meal-review-v4|" + description).getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
