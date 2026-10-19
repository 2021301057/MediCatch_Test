package com.medicatch.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.health.client.HealthAiClient;
import com.medicatch.health.dto.DiabetesOnboardingRequest;
import com.medicatch.health.entity.DailyHealthLog;
import com.medicatch.health.entity.DailyHealthMission;
import com.medicatch.health.entity.DiabetesRiskProfile;
import com.medicatch.health.entity.HealthDailyAttendance;
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

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.Map;
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
        when(healthExerciseReviewRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> review = service.reviewDailyExercise(userId, date);

        assertEquals("AEROBIC", review.get("activityType"));
        assertEquals("MODERATE", review.get("effortLabel"));
        assertEquals("실내 자전거를 20분 수행했습니다.", review.get("summary"));
        ArgumentCaptor<String> systemPrompt = ArgumentCaptor.forClass(String.class);
        verify(healthAiClient).completeJson(systemPrompt.capture(), anyString());
        assertTrue(systemPrompt.getValue().contains("자연스러운 한국어로만 작성"));
        assertTrue(systemPrompt.getValue().contains("영어 문장이나 표현을 섞지 마세요"));
        verify(healthExerciseReviewRepository).save(argThat(saved ->
                saved.getExerciseDescription().contains("실내 자전거")
                        && saved.getReviewJson().contains("AEROBIC")
                        && saved.getUserId().equals(userId)));
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
    void calendarCalculatesMealAndExerciseRecordingScoresFromStoredInputs() {
        long userId = 42L;
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
        LocalDate date = month.atDay(1);
        when(dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of(DailyHealthLog.builder().userId(userId).logDate(date)
                        .mealDescription("끼니별 빠른 기록\n아침: 밥·잡곡밥\n점심: 기록 없음\n저녁: 채소")
                        .exerciseDescription("운동 빠른 기록\n종류: 걷기\n시간: 20분")
                        .build()));
        when(healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());
        when(dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, date, month.atEndOfMonth()))
                .thenReturn(List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) service.getCalendar(userId, month).get("days");
        Map<String, Object> day = days.get(0);

        assertEquals(2, day.get("mealRecordedCount"));
        assertEquals(67, day.get("mealScore"));
        assertEquals(20, day.get("exerciseMinutes"));
        assertEquals(67, day.get("exerciseScore"));
        assertEquals(67, day.get("totalScore"));
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
}
