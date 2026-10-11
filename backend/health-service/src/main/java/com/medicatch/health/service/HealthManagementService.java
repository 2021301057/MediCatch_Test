package com.medicatch.health.service;

import com.medicatch.health.dto.DailyHealthLogRequest;
import com.medicatch.health.dto.Hba1cRequest;
import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.DailyHealthLog;
import com.medicatch.health.entity.DailyHealthMission;
import com.medicatch.health.entity.DiabetesRiskProfile;
import com.medicatch.health.entity.Hba1cResult;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.DailyHealthLogRepository;
import com.medicatch.health.repository.DailyHealthMissionRepository;
import com.medicatch.health.repository.DiabetesRiskProfileRepository;
import com.medicatch.health.repository.Hba1cResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        return toHba1cMap(hba1cResultRepository.save(result));
    }

    public Map<String, Object> updateHba1cResult(Long userId, Long id, Hba1cRequest request) {
        validateHba1c(request);
        Hba1cResult result = hba1cResultRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("검사 기록을 찾을 수 없습니다."));
        result.setTestDate(request.testDate());
        result.setValue(request.value());
        result.setOrganizationName(clean(request.organizationName(), 150));
        result.setNote(clean(request.note(), 500));
        return toHba1cMap(hba1cResultRepository.save(result));
    }

    public void deleteHba1cResult(Long userId, Long id) {
        Hba1cResult result = hba1cResultRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("검사 기록을 찾을 수 없습니다."));
        hba1cResultRepository.delete(result);
    }

    public Map<String, Object> saveDiabetesRiskProfile(Long userId, Boolean familyHistoryDiabetes) {
        DiabetesRiskProfile profile = diabetesRiskProfileRepository.findByUserId(userId)
                .orElseGet(() -> DiabetesRiskProfile.builder().userId(userId).build());
        profile.setFamilyHistoryDiabetes(familyHistoryDiabetes);
        diabetesRiskProfileRepository.save(profile);
        return getDiabetesAssessment(userId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDiabetesAssessment(Long userId) {
        List<CheckupResult> checkups = checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId);
        List<Hba1cResult> hba1cResults = hba1cResultRepository.findByUserIdOrderByTestDateDescIdDesc(userId);
        Boolean familyHistory = diabetesRiskProfileRepository.findByUserId(userId)
                .map(DiabetesRiskProfile::getFamilyHistoryDiabetes).orElse(null);

        CheckupResult latest = checkups.isEmpty() ? null : checkups.get(0);
        Hba1cResult latestHba1c = hba1cResults.isEmpty() ? null : hba1cResults.get(0);
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

        boolean hasCheckupData = latest != null;
        boolean recommendHba1c = latestHba1c == null
                && (signals.stream().anyMatch(s -> List.of("공복혈당", "가족력", "BMI", "허리둘레", "혈압", "중성지방", "HDL")
                        .contains(s.get("name"))));
        String level = !hasCheckupData && latestHba1c == null ? "NO_DATA"
                : highSignal ? "CONSULT"
                : signals.isEmpty() ? "NO_SIGNAL" : "ATTENTION";
        String guidance = switch (level) {
            case "CONSULT" -> "검사 결과가 진단 참고 기준에 해당할 수 있습니다. 결과를 가지고 의료기관에서 확인받으세요.";
            case "ATTENTION" -> "건강검진 지표에 관리 신호가 있습니다. HbA1c 검사를 의료진과 상담해보세요.";
            case "NO_SIGNAL" -> "입력된 검사에서 별도 관리 신호가 확인되지 않았습니다. 정기적인 건강 관리를 이어가세요.";
            default -> "건강검진 또는 검사 결과를 연동하면 참고 안내를 제공할게요.";
        };
        List<String> actions = switch (level) {
            case "CONSULT" -> List.of(
                    "검사 결과지를 가지고 의료기관에 방문해 진단 여부와 추가 검사를 확인하세요.",
                    "의료진 상담 전까지 임의로 약을 시작하거나 중단하지 마세요."
            );
            case "ATTENTION" -> List.of(
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
        response.put("checkupDate", latest == null ? null : latest.getCheckupDate());
        response.put("latestGlucose", latest == null ? null : latest.getGlucose());
        response.put("latestHba1c", latestHba1c == null ? null : toHba1cMap(latestHba1c));
        response.put("signals", signals);
        response.put("disclaimer", "이 안내는 참고 정보이며 당뇨병 진단을 대신하지 않습니다.");
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyLog(Long userId, LocalDate date) {
        validateLogDate(date);
        return dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)
                .map(this::toDailyLogMap)
                .orElseGet(() -> emptyDailyLog(date));
    }

    public Map<String, Object> saveDailyLog(Long userId, LocalDate date, DailyHealthLogRequest request) {
        validateLogDate(date);
        validateDailyLog(request);
        DailyHealthLog log = dailyHealthLogRepository.findByUserIdAndLogDate(userId, date)
                .orElseGet(() -> DailyHealthLog.builder().userId(userId).logDate(date).build());
        log.setMealQuality(clean(request.mealQuality(), 10));
        log.setHighSugarIntake(Boolean.TRUE.equals(request.highSugarIntake()));
        log.setLateNightMeal(Boolean.TRUE.equals(request.lateNightMeal()));
        log.setWalkingMinutes(request.walkingMinutes());
        log.setStepCount(request.stepCount());
        log.setExerciseCompleted(Boolean.TRUE.equals(request.exerciseCompleted()));
        return toDailyLogMap(dailyHealthLogRepository.save(log));
    }

    public synchronized List<Map<String, Object>> getTodayMissions(Long userId) {
        LocalDate today = LocalDate.now(APP_ZONE);
        List<DailyHealthMission> existing = dailyHealthMissionRepository
                .findByUserIdAndMissionDateOrderByCategoryAsc(userId, today);
        if (!existing.isEmpty()) return existing.stream().map(this::toMissionMap).toList();

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

        List<DailyHealthMission> created = dailyHealthMissionRepository.saveAll(List.of(
                DailyHealthMission.builder().userId(userId).missionDate(today).category("ACTIVITY")
                        .code("WALK_20_MIN").title("오늘 20분 걷기")
                        .description("무리가 없는 편안한 속도로 20분 걸어보세요.")
                        .reason(activityReason).status("PENDING").build(),
                DailyHealthMission.builder().userId(userId).missionDate(today).category("MEAL")
                        .code(mealCode).title(mealTitle).description(mealDescription)
                        .reason(mealReason).status("PENDING").build()
        ));
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
        map.put("status", mission.getStatus());
        map.put("completedAt", mission.getCompletedAt());
        return map;
    }

    private String clean(String value, int maxLength) {
        if (value == null || value.isBlank()) return null;
        String clean = value.trim();
        return clean.length() > maxLength ? clean.substring(0, maxLength) : clean;
    }
}
