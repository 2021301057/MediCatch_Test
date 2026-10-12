package com.medicatch.health.service;

import com.medicatch.health.dto.DailyHealthLogRequest;
import com.medicatch.health.dto.DiabetesOnboardingRequest;
import com.medicatch.health.dto.Hba1cRequest;
import com.medicatch.health.client.HealthAiClient;
import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.DailyHealthLog;
import com.medicatch.health.entity.DailyHealthMission;
import com.medicatch.health.entity.DiabetesRiskProfile;
import com.medicatch.health.entity.HealthAiAssessment;
import com.medicatch.health.entity.HealthDailyAttendance;
import com.medicatch.health.entity.HealthMealReview;
import com.medicatch.health.entity.HealthExerciseReview;
import com.medicatch.health.entity.Hba1cResult;
import com.medicatch.health.repository.HealthAiAssessmentRepository;
import com.medicatch.health.repository.HealthDailyAttendanceRepository;
import com.medicatch.health.repository.HealthMealReviewRepository;
import com.medicatch.health.repository.HealthExerciseReviewRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.DailyHealthLogRepository;
import com.medicatch.health.repository.DailyHealthMissionRepository;
import com.medicatch.health.repository.DiabetesRiskProfileRepository;
import com.medicatch.health.repository.Hba1cResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.YearMonth;
import java.util.HexFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
@Transactional
public class HealthManagementService {
    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Seoul");

    private final CheckupResultRepository checkupResultRepository;
    private final Hba1cResultRepository hba1cResultRepository;
    private final DiabetesRiskProfileRepository diabetesRiskProfileRepository;
    private final DailyHealthLogRepository dailyHealthLogRepository;
    private final DailyHealthMissionRepository dailyHealthMissionRepository;
    private final HealthAiAssessmentRepository healthAiAssessmentRepository;
    private final HealthDailyAttendanceRepository healthDailyAttendanceRepository;
    private final HealthMealReviewRepository healthMealReviewRepository;
    private final HealthExerciseReviewRepository healthExerciseReviewRepository;
    private final HealthAiClient healthAiClient;
    private final ObjectMapper objectMapper;

    private static final String AI_PROMPT_VERSION = "diabetes-guidance-v1";
    private static final String MEAL_REVIEW_PROMPT_VERSION = "meal-review-v2";
    private static final String EXERCISE_REVIEW_PROMPT_VERSION = "exercise-review-v2";

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getHba1cResults(Long userId) {
        return hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId).stream()
                .map(this::toHba1cMap).toList();
    }

    public Map<String, Object> createHba1cResult(Long userId, Hba1cRequest request) {
        validateHba1c(request);
        Hba1cResult result = Hba1cResult.builder()
                .userId(userId)
                .testDate(request.testDate())
                .value(request.value())
                .organizationName(clean(request.organizationName(), 150))
                .note(clean(request.note(), 500))
                .build();
        Hba1cResult saved = hba1cResultRepository.save(result);
        updateHba1cTestStatus(userId, "RESULT_AVAILABLE");
        return toHba1cMap(saved);
    }

    public Map<String, Object> updateHba1cResult(Long userId, Long id, Hba1cRequest request) {
        validateHba1c(request);
        Hba1cResult result = hba1cResultRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("검사 기록을 찾을 수 없습니다."));
        result.setTestDate(request.testDate());
        result.setValue(request.value());
        result.setOrganizationName(clean(request.organizationName(), 150));
        result.setNote(clean(request.note(), 500));
        Hba1cResult saved = hba1cResultRepository.save(result);
        updateHba1cTestStatus(userId, "RESULT_AVAILABLE");
        return toHba1cMap(saved);
    }

    public void deleteHba1cResult(Long userId, Long id) {
        Hba1cResult result = hba1cResultRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("검사 기록을 찾을 수 없습니다."));
        hba1cResultRepository.delete(result);
        if (hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId).isEmpty()) {
            updateHba1cTestStatus(userId, "TESTED_NO_RESULT");
        }
    }

    public Map<String, Object> saveDiabetesRiskProfile(Long userId, Boolean familyHistoryDiabetes) {
        return saveDiabetesRiskProfile(userId, familyHistoryDiabetes, null);
    }

    public Map<String, Object> saveDiabetesRiskProfile(Long userId, Boolean familyHistoryDiabetes, Boolean aiProcessingConsent) {
        return saveDiabetesRiskProfile(userId, familyHistoryDiabetes, aiProcessingConsent, null);
    }

    public Map<String, Object> saveDiabetesRiskProfile(Long userId, Boolean familyHistoryDiabetes, Boolean aiProcessingConsent, String healthCheckupStatus) {
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId)
                .orElseGet(() -> DiabetesRiskProfile.builder().userId(userId).build());
        profile.setFamilyHistoryDiabetes(familyHistoryDiabetes);
        if (aiProcessingConsent != null) profile.setAiProcessingConsent(aiProcessingConsent);
        if (healthCheckupStatus != null) {
            if (!List.of("HAD_CHECKUP", "NEVER", "UNKNOWN").contains(healthCheckupStatus))
                throw new IllegalArgumentException("건강검진 이력을 선택해주세요.");
            profile.setHealthCheckupStatus(healthCheckupStatus);
        }
        diabetesRiskProfileRepository.save(profile);
        return getDiabetesAssessment(userId);
    }

    public Map<String, Object> completeDiabetesOnboarding(Long userId, DiabetesOnboardingRequest request) {
        if (diabetesRiskProfileRepository.findByUserId(userId)
                .map(profile -> profile.getOnboardingCompletedAt() != null).orElse(false)) {
            throw new IllegalStateException("초기 건강 정보 입력은 이미 완료되었습니다.");
        }
        validateOnboarding(userId, request);
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId)
                .orElseGet(() -> DiabetesRiskProfile.builder().userId(userId).build());
        profile.setDiagnosisStatus(request.diagnosisStatus());
        profile.setFamilyHistoryDiabetes(request.familyHistoryDiabetes());
        profile.setHba1cTestStatus(request.hba1cTestStatus());
        profile.setHealthCheckupStatus(request.healthCheckupStatus());
        profile.setAiProcessingConsent(request.aiProcessingConsent());
        profile.setOnboardingCompletedAt(LocalDateTime.now(APP_ZONE));
        diabetesRiskProfileRepository.save(profile);

        if (request.hba1cResult() != null) {
            validateHba1c(request.hba1cResult());
            Hba1cRequest result = request.hba1cResult();
            hba1cResultRepository.save(Hba1cResult.builder()
                    .userId(userId)
                    .testDate(result.testDate())
                    .value(result.value())
                    .organizationName(clean(result.organizationName(), 150))
                    .note(clean(result.note(), 500))
                    .build());
        }
        return getDiabetesAssessment(userId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDiabetesAssessment(Long userId) {
        List<CheckupResult> checkups = checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId);
        List<Hba1cResult> hba1cResults = hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId);
        Boolean familyHistory = diabetesRiskProfileRepository.findByUserId(userId)
                .map(DiabetesRiskProfile::getFamilyHistoryDiabetes).orElse(null);
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId).orElse(null);
        boolean diagnosed = profile != null && "DIAGNOSED".equals(profile.getDiagnosisStatus());

        CheckupResult latest = checkups.isEmpty() ? null : checkups.get(0);
        Hba1cResult latestHba1c = hba1cResults.isEmpty() ? null : hba1cResults.get(0);
        boolean hba1cTestedWithoutResult = profile != null && "TESTED_NO_RESULT".equals(profile.getHba1cTestStatus());
        List<Map<String, Object>> signals = new ArrayList<>();
        boolean highSignal = false;

        if (latest != null && latest.getGlucose() != null) {
            double glucose = latest.getGlucose();
            if (glucose >= 126) {
                signals.add(signal("공복혈당", "검사 기준에 해당할 수 있어 의료기관 확인을 권합니다.", latest.getCheckupDate()));
                highSignal = true;
            } else if (glucose >= 100) {
                signals.add(signal("공복혈당", "경계 범위로 추가 검사 상담을 고려해보세요.", latest.getCheckupDate()));
            }
        }

        if (latestHba1c != null) {
            if (latestHba1c.getValue().compareTo(BigDecimal.valueOf(6.5)) >= 0) {
                signals.add(signal("당화혈색소", "검사 기준에 해당할 수 있어 의료기관 확인이 필요합니다.", latestHba1c.getTestDate()));
                highSignal = true;
            } else if (latestHba1c.getValue().compareTo(BigDecimal.valueOf(5.7)) >= 0) {
                signals.add(signal("당화혈색소", "경계 범위입니다. 의료진과 결과를 상담해보세요.", latestHba1c.getTestDate()));
            }
        }

        if (latest != null) {
            if (latest.getBmi() != null && latest.getBmi() >= 23) {
                signals.add(signal("BMI", "당뇨 위험을 검토할 때 함께 보는 항목입니다.", latest.getCheckupDate()));
            }
            if (latest.getWaist() != null && latest.getWaist() >= 85) {
                signals.add(signal("허리둘레", "성별별 참고 기준과 함께 확인할 항목입니다.", latest.getCheckupDate()));
            }
            if ((latest.getBloodPressureSystolic() != null && latest.getBloodPressureSystolic() >= 140)
                    || (latest.getBloodPressureDiastolic() != null && latest.getBloodPressureDiastolic() >= 90)) {
                signals.add(signal("혈압", "당뇨 위험 평가에 함께 고려할 건강 지표입니다.", latest.getCheckupDate()));
            }
            if (latest.getTriglycerides() != null && latest.getTriglycerides() >= 250) {
                signals.add(signal("중성지방", "당뇨 위험 평가에 함께 고려할 건강 지표입니다.", latest.getCheckupDate()));
            }
            if (latest.getHdlCholesterol() != null && latest.getHdlCholesterol() < 35) {
                signals.add(signal("HDL", "당뇨 위험 평가에 함께 고려할 건강 지표입니다.", latest.getCheckupDate()));
            }
        }
        if (Boolean.TRUE.equals(familyHistory)) {
            signals.add(signal("가족력", "가족력이 있다고 입력한 정보입니다.", null));
        }
        if (diagnosed) {
            signals.add(signal("당뇨 진단 이력", "사용자가 의료기관에서 진단받았다고 응답했습니다.", null));
        }
        if (hba1cTestedWithoutResult && latestHba1c == null) {
            signals.add(signal("HbA1c 결과 확인", "검사를 받았다고 응답했습니다. 검사기관에서 결과를 확인해 의료진과 상담하세요.", null));
        }

        boolean hasCheckupData = latest != null;
        boolean recommendHba1c = latestHba1c == null && !hba1cTestedWithoutResult
                && (signals.stream().anyMatch(s -> List.of("공복혈당", "가족력", "BMI", "허리둘레", "혈압", "중성지방", "HDL")
                        .contains(s.get("name"))));
        String level = diagnosed ? "CONSULT"
                : !hasCheckupData && latestHba1c == null && !hba1cTestedWithoutResult ? "NO_DATA"
                : highSignal ? "CONSULT"
                : signals.isEmpty() ? "NO_SIGNAL" : "ATTENTION";
        String guidance = switch (level) {
            case "CONSULT" -> diagnosed
                    ? "당뇨 진단 이력이 있다고 응답했습니다. 담당 의료진의 관리 계획과 정기 진료를 우선해 주세요."
                    : "검사 결과가 진단 참고 기준에 해당할 수 있습니다. 결과를 가지고 의료기관에서 확인받으세요.";
            case "ATTENTION" -> hba1cTestedWithoutResult
                    ? "HbA1c 검사를 받으셨다면 검사기관에서 결과를 확인하고 의료진과 상담해보세요."
                    : "건강검진 지표에 관리 신호가 있습니다. HbA1c 검사를 의료진과 상담해보세요.";
            case "NO_SIGNAL" -> "입력된 검사에서 별도 관리 신호가 확인되지 않았습니다. 정기적인 건강 관리를 이어가세요.";
            default -> "건강검진 또는 검사 결과를 연동하면 참고 안내를 제공할게요.";
        };
        List<String> actions = switch (level) {
            case "CONSULT" -> diagnosed ? List.of(
                    "담당 의료진의 진료 및 치료 계획을 따르고, 증상이나 수치 변화가 있으면 상담하세요.",
                    "이 안내는 치료를 대체하지 않으며 약을 임의로 변경하지 마세요."
            ) : List.of(
                    "검사 결과지를 가지고 의료기관에 방문해 진단 여부와 추가 검사를 확인하세요.",
                    "의료진 상담 전까지 임의로 약을 시작하거나 중단하지 마세요."
            );
            case "ATTENTION" -> hba1cTestedWithoutResult ? List.of(
                    "검사 결과지를 확인해 날짜와 수치를 기록해보세요.",
                    "검사 결과 해석은 의료진과 상담하세요."
            ) : List.of(
                    "HbA1c 검사가 필요한지 의료진과 상담하세요.",
                    "단 음료를 물이나 무가당 음료로 바꾸고, 가능한 범위에서 걷기 활동을 기록해보세요."
            );
            case "NO_SIGNAL" -> List.of(
                    "균형 잡힌 식사와 규칙적인 신체 활동을 이어가세요.",
                    "검진 주기는 개인의 건강 상태와 의료진 안내에 맞춰 확인하세요."
            );
            default -> List.of(
                    "검진 결과를 연결하거나 HbA1c 검사 결과를 직접 기록하면 참고 안내를 받을 수 있습니다.",
                    "가족력 질문은 선택 항목이며 응답하지 않아도 됩니다."
            );
        };

        Map<String, Object> response = new HashMap<>();
        response.put("level", level);
        response.put("guidance", guidance);
        response.put("actions", actions);
        response.put("recommendHba1c", recommendHba1c);
        response.put("familyHistoryDiabetes", familyHistory);
        response.put("diagnosisStatus", profile == null ? null : profile.getDiagnosisStatus());
        response.put("hba1cTestStatus", profile == null ? null : profile.getHba1cTestStatus());
        response.put("aiProcessingConsent", profile == null ? null : profile.getAiProcessingConsent());
        response.put("onboardingComplete", profile != null && profile.getOnboardingCompletedAt() != null);
        response.put("healthCheckupStatus", profile != null && profile.getHealthCheckupStatus() != null
                ? profile.getHealthCheckupStatus() : latest != null ? "HAD_CHECKUP" : null);
        response.put("checkupDate", latest == null ? null : latest.getCheckupDate());
        response.put("checkupResultId", latest == null ? null : latest.getId());
        response.put("latestGlucose", latest == null ? null : latest.getGlucose());
        response.put("latestBmi", latest == null ? null : latest.getBmi());
        response.put("latestWaist", latest == null ? null : latest.getWaist());
        response.put("latestBloodPressureSystolic", latest == null ? null : latest.getBloodPressureSystolic());
        response.put("latestBloodPressureDiastolic", latest == null ? null : latest.getBloodPressureDiastolic());
        response.put("latestTriglycerides", latest == null ? null : latest.getTriglycerides());
        response.put("latestHdl", latest == null ? null : latest.getHdlCholesterol());
        response.put("latestHba1c", latestHba1c == null ? null : toHba1cMap(latestHba1c));
        response.put("latestHba1cId", latestHba1c == null ? null : latestHba1c.getId());
        response.put("signals", signals);
        response.put("disclaimer", "이 안내는 참고 정보이며 당뇨병 진단을 대신하지 않습니다.");
        return response;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Map<String, Object> generateAiGuidance(Long userId) {
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("건강 정보 입력을 먼저 완료해주세요."));
        if (profile.getOnboardingCompletedAt() == null) {
            throw new IllegalStateException("건강 정보 입력을 먼저 완료해주세요.");
        }
        if (!Boolean.TRUE.equals(profile.getAiProcessingConsent())) {
            throw new IllegalStateException("AI 건강 가이드 이용에 동의하지 않았습니다.");
        }

        Map<String, Object> assessment = getDiabetesAssessment(userId);
        Map<String, Object> snapshot = buildAiInputSnapshot(profile, assessment);
        String snapshotJson = writeJson(snapshot);
        String inputHash = sha256(snapshotJson);
        HealthAiAssessment saved = healthAiAssessmentRepository
                .findByUserIdAndInputHashAndPromptVersion(userId, inputHash, AI_PROMPT_VERSION)
                .orElseGet(() -> createAiAssessment(userId, assessment, snapshot, snapshotJson, inputHash));
        return toAiGuidanceMap(saved);
    }

    @Transactional
    public Map<String, Object> recordTodayAttendance(Long userId) {
        LocalDate today = LocalDate.now(APP_ZONE);
        healthDailyAttendanceRepository.recordAttendance(userId, today);
        return Map.of("date", today, "attended", true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCalendar(Long userId, YearMonth month) {
        if (month == null || month.isAfter(YearMonth.now(APP_ZONE))
                || month.isBefore(YearMonth.now(APP_ZONE).minusYears(2))) {
            throw new IllegalArgumentException("달력은 최근 2년부터 이번 달까지 조회할 수 있습니다.");
        }
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        Map<LocalDate, HealthDailyAttendance> attendanceByDate = new HashMap<>();
        healthDailyAttendanceRepository.findByUserIdAndAttendanceDateBetween(userId, start, end)
                .forEach(item -> attendanceByDate.put(item.getAttendanceDate(), item));
        Map<LocalDate, DailyHealthLog> logsByDate = new HashMap<>();
        dailyHealthLogRepository.findByUserIdAndLogDateBetween(userId, start, end)
                .forEach(item -> logsByDate.put(item.getLogDate(), item));
        Map<LocalDate, List<DailyHealthMission>> missionsByDate = new HashMap<>();
        dailyHealthMissionRepository.findByUserIdAndMissionDateBetween(userId, start, end)
                .forEach(item -> missionsByDate.computeIfAbsent(item.getMissionDate(), ignored -> new ArrayList<>()).add(item));

        List<Map<String, Object>> days = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            DailyHealthLog log = logsByDate.get(date);
            List<DailyHealthMission> missions = missionsByDate.getOrDefault(date, List.of());
            boolean meal = (log != null && (log.getMealQuality() != null
                    || (log.getMealDescription() != null && !log.getMealDescription().isBlank())))
                    || missions.stream().anyMatch(m -> "MEAL".equals(m.getCategory()) && "COMPLETED".equals(m.getStatus()));
            boolean exercise = (log != null && ((log.getExerciseDescription() != null && !log.getExerciseDescription().isBlank())
                    || log.isExerciseCompleted()
                    || (log.getWalkingMinutes() != null && log.getWalkingMinutes() > 0)
                    || (log.getStepCount() != null && log.getStepCount() > 0)))
                    || missions.stream().anyMatch(m -> "ACTIVITY".equals(m.getCategory()) && "COMPLETED".equals(m.getStatus()));
            Map<String, Object> day = new HashMap<>();
            day.put("date", date);
            day.put("attendance", attendanceByDate.containsKey(date));
            day.put("meal", meal);
            day.put("exercise", exercise);
            days.add(day);
        }
        return Map.of("month", month.toString(), "days", days);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyLog(Long userId, LocalDate date) {
        validateLogDate(date);
        Map<String, Object> response = dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)
                .map(this::toDailyLogMap)
                .orElseGet(() -> emptyDailyLog(date));
        response.put("mealReview", getMealReview(userId, date, (String) response.get("mealDescription")));
        response.put("exerciseReview", getExerciseReview(userId, date, (String) response.get("exerciseDescription")));
        return response;
    }

    public Map<String, Object> saveDailyLog(Long userId, LocalDate date, DailyHealthLogRequest request) {
        validateLogDate(date);
        validateDailyLog(request);
        DailyHealthLog log = dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)
                .orElseGet(() -> DailyHealthLog.builder().userId(userId).logDate(date).build());
        log.setMealQuality(clean(request.mealQuality(), 10));
        log.setMealDescription(clean(request.mealDescription(), 1000));
        log.setExerciseDescription(clean(request.exerciseDescription(), 1000));
        log.setHighSugarIntake(Boolean.TRUE.equals(request.highSugarIntake()));
        log.setLateNightMeal(Boolean.TRUE.equals(request.lateNightMeal()));
        log.setWalkingMinutes(null);
        log.setStepCount(null);
        log.setExerciseCompleted(false);
        Map<String, Object> response = toDailyLogMap(dailyHealthLogRepository.save(log));
        response.put("mealReview", getMealReview(userId, date, (String) response.get("mealDescription")));
        response.put("exerciseReview", getExerciseReview(userId, date, (String) response.get("exerciseDescription")));
        return response;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Map<String, Object> reviewDailyMeal(Long userId, LocalDate date) {
        validateLogDate(date);
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("건강 정보 입력을 먼저 완료해주세요."));
        if (!Boolean.TRUE.equals(profile.getAiProcessingConsent())) {
            throw new IllegalStateException("AI 분석 이용 동의가 필요합니다.");
        }
        DailyHealthLog log = dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)
                .orElseThrow(() -> new IllegalStateException("식사 기록을 먼저 저장해주세요."));
        String description = clean(log.getMealDescription(), 1000);
        if (description == null) throw new IllegalArgumentException("먹은 음식을 먼저 입력해주세요.");
        String hash = sha256(MEAL_REVIEW_PROMPT_VERSION + "|" + description);
        HealthMealReview review = healthMealReviewRepository.findByUserIdAndLogDateAndInputHash(userId, date, hash)
                .orElseGet(() -> {
                    String system = "식사 기록을 평가하는 건강정보 보조 도구입니다. 진단이나 칼로리 추측을 하지 말고 기록된 음식에 근거해 균형과 개선점만 간결하게 제안하세요. 사용자에게 보이는 summary, positivePoints, improvements의 모든 문장은 자연스러운 한국어로만 작성하고 영어 문장이나 표현을 섞지 마세요. JSON 객체만 반환하고 키는 balanceLabel, summary, positivePoints, improvements로 합니다. balanceLabel은 BALANCED, NEEDS_ATTENTION, UNKNOWN 중 하나이며 배열은 각각 최대 3개입니다.";
                    String output = healthAiClient.completeJson(system,
                            "식사 기록: " + description + "\n당뇨 예방 관점에서 비난 없이 실천 가능한 피드백을 한국어로 작성하세요. 양이 없으면 양을 추정하지 마세요.");
                    try { objectMapper.readTree(output); }
                    catch (Exception e) { throw new IllegalStateException("AI 식사 평가 형식이 올바르지 않습니다."); }
                    return healthMealReviewRepository.save(HealthMealReview.builder().userId(userId).logDate(date)
                            .inputHash(hash).mealDescription(description).reviewJson(output)
                            .modelName(healthAiClient.getModel()).build());
                });
        return mealReviewMap(review);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Map<String, Object> reviewDailyExercise(Long userId, LocalDate date) {
        validateLogDate(date);
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("건강 정보 입력을 먼저 완료해주세요."));
        if (!Boolean.TRUE.equals(profile.getAiProcessingConsent())) {
            throw new IllegalStateException("AI 분석 이용 동의가 필요합니다.");
        }
        DailyHealthLog log = dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)
                .orElseThrow(() -> new IllegalStateException("운동 기록을 먼저 저장해주세요."));
        String description = clean(log.getExerciseDescription(), 1000);
        if (description == null) throw new IllegalArgumentException("오늘 한 운동을 먼저 입력해주세요.");
        String hash = sha256(EXERCISE_REVIEW_PROMPT_VERSION + "|" + description);
        HealthExerciseReview review = healthExerciseReviewRepository.findByUserIdAndLogDateAndInputHash(userId, date, hash)
                .orElseGet(() -> {
                    String system = "운동 기록을 검토하는 건강정보 보조 도구입니다. 사용자가 쓴 문장만 근거로 운동 종류와 수행 내용, 실천 가능한 개선점을 평가하세요. 운동시간이나 강도를 임의로 추정하지 말고 정보가 부족하면 분명히 밝히세요. 진단이나 치료 지시를 하지 마세요. 사용자에게 보이는 summary, positivePoints, improvements의 모든 문장은 자연스러운 한국어로만 작성하고 영어 문장이나 표현을 섞지 마세요. JSON 객체만 반환하세요. 키는 activityType, effortLabel, summary, positivePoints, improvements입니다. activityType은 AEROBIC, STRENGTH, FLEXIBILITY, SPORT, MIXED, OTHER, UNKNOWN 중 하나, effortLabel은 LIGHT, MODERATE, HIGH, UNKNOWN 중 하나이며 배열은 최대 3개입니다.";
                    String output = healthAiClient.completeJson(system,
                            "오늘의 운동 기록: " + description + "\n운동 종류와 기록의 구체성을 한국어로 요약하고 무리하지 않는 다음 행동을 제안하세요.");
                    try { objectMapper.readTree(output); }
                    catch (Exception e) { throw new IllegalStateException("AI 운동 평가 형식이 올바르지 않습니다."); }
                    return healthExerciseReviewRepository.save(HealthExerciseReview.builder().userId(userId).logDate(date)
                            .inputHash(hash).exerciseDescription(description).reviewJson(output)
                            .modelName(healthAiClient.getModel()).build());
                });
        return exerciseReviewMap(review);
    }

    private Map<String, Object> getMealReview(Long userId, LocalDate date, String description) {
        if (description == null || description.isBlank()) return null;
        return healthMealReviewRepository.findByUserIdAndLogDateAndInputHash(userId, date,
                sha256(MEAL_REVIEW_PROMPT_VERSION + "|" + description.trim())).map(this::mealReviewMap).orElse(null);
    }

    private Map<String, Object> mealReviewMap(HealthMealReview review) {
        try {
            JsonNode json = objectMapper.readTree(review.getReviewJson());
            String label = json.path("balanceLabel").asText("UNKNOWN");
            Map<String, Object> result = new HashMap<>();
            result.put("balanceLabel", List.of("BALANCED", "NEEDS_ATTENTION", "UNKNOWN").contains(label) ? label : "UNKNOWN");
            result.put("summary", json.path("summary").asText("입력한 식사 기록을 확인했습니다."));
            result.put("positivePoints", jsonStringList(json.path("positivePoints")));
            result.put("improvements", jsonStringList(json.path("improvements")));
            result.put("createdAt", review.getCreatedAt());
            return result;
        } catch (Exception e) { throw new IllegalStateException("저장된 식사 평가를 읽을 수 없습니다.", e); }
    }

    private Map<String, Object> getExerciseReview(Long userId, LocalDate date, String description) {
        if (description == null || description.isBlank()) return null;
        return healthExerciseReviewRepository.findByUserIdAndLogDateAndInputHash(userId, date,
                sha256(EXERCISE_REVIEW_PROMPT_VERSION + "|" + description.trim())).map(this::exerciseReviewMap).orElse(null);
    }

    private Map<String, Object> exerciseReviewMap(HealthExerciseReview review) {
        try {
            JsonNode json = objectMapper.readTree(review.getReviewJson());
            String activityType = json.path("activityType").asText("UNKNOWN");
            String effortLabel = json.path("effortLabel").asText("UNKNOWN");
            Map<String, Object> result = new HashMap<>();
            result.put("activityType", List.of("AEROBIC", "STRENGTH", "FLEXIBILITY", "SPORT", "MIXED", "OTHER", "UNKNOWN").contains(activityType) ? activityType : "UNKNOWN");
            result.put("effortLabel", List.of("LIGHT", "MODERATE", "HIGH", "UNKNOWN").contains(effortLabel) ? effortLabel : "UNKNOWN");
            result.put("summary", json.path("summary").asText("입력한 운동 기록을 확인했습니다."));
            result.put("positivePoints", jsonStringList(json.path("positivePoints")));
            result.put("improvements", jsonStringList(json.path("improvements")));
            result.put("createdAt", review.getCreatedAt());
            return result;
        } catch (Exception e) { throw new IllegalStateException("저장된 운동 평가를 읽을 수 없습니다.", e); }
    }

    private List<String> jsonStringList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node.isArray()) node.forEach(value -> { if (value.isTextual() && !value.asText().isBlank()) values.add(value.asText()); });
        else if (node.isTextual() && !node.asText().isBlank()) values.add(node.asText());
        return values.stream().limit(3).toList();
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public synchronized List<Map<String, Object>> getTodayMissions(Long userId) {
        LocalDate today = LocalDate.now(APP_ZONE);
        List<DailyHealthMission> existing = dailyHealthMissionRepository
                .findByUserIdAndMissionDateOrderByCategoryAsc(userId, today);
        if (!existing.isEmpty()) return existing.stream().map(this::toMissionMap).toList();

        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null || profile.getOnboardingCompletedAt() == null) return List.of();

        Map<String, Object> assessment = getDiabetesAssessment(userId);
        List<DailyHealthLog> recentLogs = dailyHealthLogRepository.findTop7ByUserIdOrderByLogDateDesc(userId);
        String activityReason = recentLogs.stream().anyMatch(log -> log.getWalkingMinutes() != null && log.getWalkingMinutes() >= 20)
                ? "최근 기록을 바탕으로 오늘도 활동을 이어가도록 제안합니다."
                : "가볍게 시작할 수 있는 오늘의 활동 목표입니다.";
        boolean glucoseSignal = "ATTENTION".equals(assessment.get("level")) || "CONSULT".equals(assessment.get("level"));
        String mealCode = today.getDayOfYear() % 2 == 0 ? "REDUCE_SUGARY_DRINKS" : "BALANCE_DINNER";
        String mealTitle = "REDUCE_SUGARY_DRINKS".equals(mealCode) ? "단 음료 대신 물 선택하기" : "저녁 탄수화물 양 조절하기";
        String mealDescription = "REDUCE_SUGARY_DRINKS".equals(mealCode)
                ? "오늘 마실 음료 중 하나를 물이나 무가당 음료로 바꿔보세요."
                : "저녁 식사에서 탄수화물 양을 살펴보고 채소와 단백질을 함께 챙겨보세요.";
        String mealReason = glucoseSignal
                ? "검진 결과를 바탕으로 식사 습관을 점검하는 미션입니다."
                : "작은 식사 기록을 쌓기 위한 오늘의 미션입니다.";

        List<Map<String, Object>> aiMissions = List.of();
        Long assessmentId = null;
        if (Boolean.TRUE.equals(profile.getAiProcessingConsent())) {
            try {
                Map<String, Object> guidance = generateAiGuidance(userId);
                assessmentId = ((Number) guidance.get("id")).longValue();
                Object output = guidance.get("guidance");
                if (output instanceof Map<?, ?> outputMap && outputMap.get("missions") instanceof List<?> list) {
                    aiMissions = list.stream().filter(Map.class::isInstance).map(item -> {
                        Map<String, Object> parsed = new HashMap<>();
                        ((Map<?, ?>) item).forEach((key, value) -> {
                            if (key instanceof String name) parsed.put(name, value);
                        });
                        return parsed;
                    }).toList();
                }
            } catch (Exception ignored) {
                // Existing rule-based missions remain available when AI is unavailable.
            }
        }

        List<DailyHealthMission> toSave = new ArrayList<>();
        Map<String, Object> activity = aiMissions.stream().filter(m -> "ACTIVITY".equals(m.get("category"))).findFirst().orElse(null);
        Map<String, Object> meal = aiMissions.stream().filter(m -> "MEAL".equals(m.get("category"))).findFirst().orElse(null);
        toSave.add(DailyHealthMission.builder().userId(userId).missionDate(today).category("ACTIVITY")
                .code("WALK_20_MIN").title(textOr(activity, "title", "오늘 20분 걷기", 120))
                .description(textOr(activity, "description", "무리가 없는 편안한 속도로 20분 걸어보세요.", 500))
                .reason(textOr(activity, "reason", activityReason, 300)).status("PENDING")
                .source(activity == null ? "RULE" : "AI").assessmentId(activity == null ? null : assessmentId).build());
        toSave.add(DailyHealthMission.builder().userId(userId).missionDate(today).category("MEAL")
                .code(mealCode).title(textOr(meal, "title", mealTitle, 120))
                .description(textOr(meal, "description", mealDescription, 500))
                .reason(textOr(meal, "reason", mealReason, 300)).status("PENDING")
                .source(meal == null ? "RULE" : "AI").assessmentId(meal == null ? null : assessmentId).build());
        List<DailyHealthMission> created = dailyHealthMissionRepository.saveAll(toSave);
        return created.stream().map(this::toMissionMap).toList();
    }

    public Map<String, Object> completeMission(Long userId, Long missionId) {
        DailyHealthMission mission = dailyHealthMissionRepository.findByIdAndUserId(missionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("오늘의 미션을 찾을 수 없습니다."));
        mission.setStatus("COMPLETED");
        mission.setCompletedAt(LocalDateTime.now(APP_ZONE));
        return toMissionMap(dailyHealthMissionRepository.save(mission));
    }

    private void validateHba1c(Hba1cRequest request) {
        if (request == null || request.testDate() == null || request.value() == null
                || request.value().compareTo(BigDecimal.valueOf(3)) < 0
                || request.value().compareTo(BigDecimal.valueOf(20)) > 0
                || request.value().scale() > 2) {
            throw new IllegalArgumentException("검사일과 유효한 HbA1c 결과(3~20%)를 입력해주세요.");
        }
        if (request.testDate().isAfter(LocalDate.now(APP_ZONE))) {
            throw new IllegalArgumentException("검사일은 오늘 이후로 입력할 수 없습니다.");
        }
    }

    private void validateOnboarding(Long userId, DiabetesOnboardingRequest request) {
        if (request == null || !List.of("DIAGNOSED", "NOT_DIAGNOSED", "UNKNOWN").contains(request.diagnosisStatus())
                || !List.of("HAD_CHECKUP", "NEVER", "UNKNOWN").contains(request.healthCheckupStatus())
                || !List.of("RESULT_AVAILABLE", "TESTED_NO_RESULT", "NOT_TESTED", "UNKNOWN").contains(request.hba1cTestStatus())
                || request.aiProcessingConsent() == null) {
            throw new IllegalArgumentException("필수 건강 정보와 AI 이용 동의 여부를 선택해주세요.");
        }
        if (request.hba1cResult() != null && !"RESULT_AVAILABLE".equals(request.hba1cTestStatus())) {
            throw new IllegalArgumentException("검사 결과를 입력한 경우 검사 결과 있음으로 선택해주세요.");
        }
        if ("RESULT_AVAILABLE".equals(request.hba1cTestStatus()) && request.hba1cResult() == null
                && hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId).isEmpty()) {
            throw new IllegalArgumentException("검사 결과가 있다고 선택했다면 검사일과 HbA1c 수치를 입력해주세요.");
        }
    }

    private void updateHba1cTestStatus(Long userId, String status) {
        diabetesRiskProfileRepository.findByUserId(userId).ifPresent(profile -> {
            profile.setHba1cTestStatus(status);
            diabetesRiskProfileRepository.save(profile);
        });
    }

    private Map<String, Object> buildAiInputSnapshot(DiabetesRiskProfile profile, Map<String, Object> assessment) {
        Map<String, Object> input = new TreeMap<>();
        input.put("diagnosisStatus", profile.getDiagnosisStatus());
        input.put("familyHistoryDiabetes", profile.getFamilyHistoryDiabetes());
        input.put("hba1cTestStatus", profile.getHba1cTestStatus());
        input.put("riskLevel", assessment.get("level"));
        input.put("signals", assessment.get("signals"));
        input.put("latestGlucose", assessment.get("latestGlucose"));
        input.put("latestBmi", assessment.get("latestBmi"));
        input.put("latestWaist", assessment.get("latestWaist"));
        input.put("latestBloodPressureSystolic", assessment.get("latestBloodPressureSystolic"));
        input.put("latestBloodPressureDiastolic", assessment.get("latestBloodPressureDiastolic"));
        input.put("latestTriglycerides", assessment.get("latestTriglycerides"));
        input.put("latestHdl", assessment.get("latestHdl"));
        Object hba1cValue = assessment.get("latestHba1c");
        if (hba1cValue instanceof Map<?, ?> hba1c) {
            Map<String, Object> minimalResult = new TreeMap<>();
            minimalResult.put("testDate", hba1c.get("testDate"));
            minimalResult.put("value", hba1c.get("value"));
            input.put("latestHba1c", minimalResult);
        }
        input.put("checkupDate", assessment.get("checkupDate"));
        return input;
    }

    private HealthAiAssessment createAiAssessment(Long userId, Map<String, Object> assessment, Map<String, Object> snapshot,
                                                   String snapshotJson, String inputHash) {
        String prompt = "건강관리 대상자의 요약 데이터: " + snapshotJson + "\n"
                + "규칙 기반 위험 단계: " + assessment.get("level") + "\n"
                + "이 데이터를 바탕으로 짧고 실행 가능한 생활습관 안내와 오늘 할 수 있는 식사/운동 미션을 생성하세요.";
        String system = "당신은 건강관리 안내 작성 도우미입니다. 진단, 치료, 약물 변경을 지시하지 말고 의료진 상담이 필요한 경우 명시하세요. "
                + "과장하거나 입력에 없는 건강 상태를 추정하지 말고, 한국어로 작성하세요. 반드시 JSON 객체만 반환하고 형식은 "
                + "{\\\"summary\\\":string,\\\"mealRecommendations\\\":[string],\\\"actions\\\":[string],\\\"missions\\\":["
                + "{\\\"category\\\":\\\"MEAL\\\"|\\\"ACTIVITY\\\",\\\"title\\\":string,\\\"description\\\":string,\\\"reason\\\":string}]} 입니다. "
                + "미션은 MEAL과 ACTIVITY 각각 하나씩만 반환하세요.";
        String raw = healthAiClient.completeJson(system, prompt);
        Map<String, Object> output = normalizeAiOutput(raw);
        HealthAiAssessment entity = HealthAiAssessment.builder()
                .userId(userId)
                .riskLevel(String.valueOf(assessment.get("level")))
                .inputHash(inputHash)
                .promptVersion(AI_PROMPT_VERSION)
                .modelName(clean(healthAiClient.getModel(), 120))
                .checkupResultId((Long) assessment.get("checkupResultId"))
                .hba1cResultId((Long) assessment.get("latestHba1cId"))
                .inputSnapshot(writeJson(snapshot))
                .outputJson(writeJson(output))
                .build();
        return healthAiAssessmentRepository.save(entity);
    }

    private Map<String, Object> normalizeAiOutput(String raw) {
        try {
            JsonNode root = objectMapper.readTree(raw);
            Map<String, Object> output = new HashMap<>();
            output.put("summary", textOr(root.path("summary").asText(null), "검진 결과를 바탕으로 생활습관을 꾸준히 관리해보세요.", 1000));
            output.put("mealRecommendations", readStringList(root.path("mealRecommendations"), 5, 300));
            output.put("actions", readStringList(root.path("actions"), 5, 300));
            List<Map<String, Object>> missions = new ArrayList<>();
            JsonNode missionNodes = root.path("missions");
            if (missionNodes.isArray()) {
                for (JsonNode node : missionNodes) {
                    String category = node.path("category").asText("");
                    if (!List.of("MEAL", "ACTIVITY").contains(category)) continue;
                    Map<String, Object> mission = new HashMap<>();
                    mission.put("category", category);
                    mission.put("title", textOr(node.path("title").asText(null), category.equals("MEAL") ? "식사 습관 점검" : "가벼운 신체 활동", 120));
                    mission.put("description", textOr(node.path("description").asText(null), "무리가 없는 범위에서 실천해보세요.", 500));
                    mission.put("reason", textOr(node.path("reason").asText(null), "일상 건강관리를 위한 제안입니다.", 300));
                    if (missions.stream().noneMatch(existing -> category.equals(existing.get("category")))) missions.add(mission);
                }
            }
            output.put("missions", missions);
            return output;
        } catch (Exception e) {
            throw new IllegalStateException("AI 응답 형식이 올바르지 않습니다.", e);
        }
    }

    private List<String> readStringList(JsonNode node, int maxItems, int maxLength) {
        List<String> values = new ArrayList<>();
        if (node.isArray()) {
            node.forEach(item -> {
                if (item.isTextual() && !item.asText().isBlank() && values.size() < maxItems) {
                    values.add(clean(item.asText(), maxLength));
                }
            });
        }
        return values;
    }

    private String textOr(Map<String, Object> source, String key, String fallback, int maxLength) {
        Object value = source == null ? null : source.get(key);
        return value instanceof String text && !text.isBlank() ? clean(text, maxLength) : fallback;
    }

    private String textOr(String value, String fallback, int maxLength) {
        return value == null || value.isBlank() ? fallback : clean(value, maxLength);
    }

    private Map<String, Object> toAiGuidanceMap(HealthAiAssessment assessment) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", assessment.getId());
        map.put("riskLevel", assessment.getRiskLevel());
        map.put("model", assessment.getModelName());
        map.put("generatedAt", assessment.getCreatedAt());
        try {
            map.put("guidance", objectMapper.readValue(assessment.getOutputJson(), new TypeReference<Map<String, Object>>() {}));
        } catch (Exception e) {
            map.put("guidance", Map.of());
        }
        return map;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("건강 안내 데이터를 저장할 수 없습니다.", e);
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("입력 데이터 지문을 계산할 수 없습니다.", e);
        }
    }

    private void validateDailyLog(DailyHealthLogRequest request) {
        if (request == null) throw new IllegalArgumentException("일일 기록을 입력해주세요.");
        if (request.mealQuality() != null && !List.of("GOOD", "FAIR", "POOR").contains(request.mealQuality())) {
            throw new IllegalArgumentException("식사 평가는 GOOD, FAIR, POOR 중에서 선택해주세요.");
        }
        if (request.walkingMinutes() != null && (request.walkingMinutes() < 0 || request.walkingMinutes() > 1440)) {
            throw new IllegalArgumentException("걷기 시간은 0~1440분으로 입력해주세요.");
        }
        if (request.stepCount() != null && (request.stepCount() < 0 || request.stepCount() > 100000)) {
            throw new IllegalArgumentException("걸음 수는 0~100000보로 입력해주세요.");
        }
    }

    private void validateLogDate(LocalDate date) {
        if (date == null || date.isAfter(LocalDate.now(APP_ZONE))) {
            throw new IllegalArgumentException("오늘 이후의 날짜는 기록할 수 없습니다.");
        }
    }

    private Map<String, Object> signal(String name, String detail, LocalDate date) {
        Map<String, Object> signal = new HashMap<>();
        signal.put("name", name);
        signal.put("detail", detail);
        signal.put("date", date);
        return signal;
    }

    private Map<String, Object> toHba1cMap(Hba1cResult result) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", result.getId());
        map.put("testDate", result.getTestDate());
        map.put("value", result.getValue());
        map.put("organizationName", result.getOrganizationName());
        map.put("note", result.getNote());
        return map;
    }

    private Map<String, Object> toDailyLogMap(DailyHealthLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("logDate", log.getLogDate());
        map.put("mealQuality", log.getMealQuality());
        map.put("mealDescription", log.getMealDescription());
        map.put("exerciseDescription", log.getExerciseDescription());
        map.put("highSugarIntake", log.isHighSugarIntake());
        map.put("lateNightMeal", log.isLateNightMeal());
        map.put("walkingMinutes", log.getWalkingMinutes());
        map.put("stepCount", log.getStepCount());
        map.put("exerciseCompleted", log.isExerciseCompleted());
        return map;
    }

    private Map<String, Object> emptyDailyLog(LocalDate date) {
        Map<String, Object> map = new HashMap<>();
        map.put("logDate", date);
        map.put("mealQuality", null);
        map.put("mealDescription", null);
        map.put("exerciseDescription", null);
        map.put("highSugarIntake", false);
        map.put("lateNightMeal", false);
        map.put("walkingMinutes", null);
        map.put("stepCount", null);
        map.put("exerciseCompleted", false);
        return map;
    }

    private Map<String, Object> toMissionMap(DailyHealthMission mission) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", mission.getId());
        map.put("missionDate", mission.getMissionDate());
        map.put("category", mission.getCategory());
        map.put("code", mission.getCode());
        map.put("title", mission.getTitle());
        map.put("description", mission.getDescription());
        map.put("reason", mission.getReason());
        map.put("source", mission.getSource() == null ? "RULE" : mission.getSource());
        map.put("status", mission.getStatus());
        map.put("completedAt", mission.getCompletedAt());
        map.put("source", mission.getSource() == null ? "RULE" : mission.getSource());
        return map;
    }

    private String clean(String value, int maxLength) {
        if (value == null || value.isBlank()) return null;
        String clean = value.trim();
        return clean.length() > maxLength ? clean.substring(0, maxLength) : clean;
    }
}
