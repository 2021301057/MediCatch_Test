package com.medicatch.health.controller;

import com.medicatch.health.dto.CheckupResultDto;
import com.medicatch.health.dto.MedicalRecordDto;
import com.medicatch.health.entity.DiseasePrediction;
import com.medicatch.health.entity.DiseasePredictionCompare;
import com.medicatch.health.entity.DiseasePredictionFactor;
import com.medicatch.health.entity.DiseasePredictionYearly;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.health.entity.HealthAgeResult;
import com.medicatch.health.entity.MedicationDetail;
import com.medicatch.health.repository.DiseasePredictionRepository;
import com.medicatch.health.repository.HealthAgeResultRepository;
import com.medicatch.health.service.CodefSyncService;
import com.medicatch.health.service.HealthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final HealthService healthService;
    private final CodefSyncService codefSyncService;
    private final DiseasePredictionRepository diseasePredictionRepo;
    private final HealthAgeResultRepository healthAgeResultRepo;
    private final ObjectMapper objectMapper;

    public HealthController(HealthService healthService,
                            CodefSyncService codefSyncService,
                            DiseasePredictionRepository diseasePredictionRepo,
                            HealthAgeResultRepository healthAgeResultRepo,
                            ObjectMapper objectMapper) {
        this.healthService = healthService;
        this.codefSyncService = codefSyncService;
        this.diseasePredictionRepo = diseasePredictionRepo;
        this.healthAgeResultRepo = healthAgeResultRepo;
        this.objectMapper = objectMapper;
    }

    /**
     * Get health summary for user
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getHealthSummary(@RequestHeader("X-User-Id") Long userId) {
        log.info("GET /api/health/summary - userId: {}", userId);
        try {
            Map<String, Object> summary = healthService.getUserHealthSummary(userId);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error getting health summary: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", "Failed to get health summary"));
        }
    }

    /**
     * Get medical records
     */
    @GetMapping("/medical-records")
    public ResponseEntity<List<MedicalRecordDto>> getMedicalRecords(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        log.info("GET /api/health/medical-records - userId: {}", userId);
        try {
            LocalDate start = startDate != null ? startDate : LocalDate.now().minusYears(3);
            LocalDate end = endDate != null ? endDate : LocalDate.now();

            List<MedicalRecordDto> records = healthService.getMedicalRecords(userId, start, end)
                    .stream().map(MedicalRecordDto::from).collect(Collectors.toList());
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            log.error("Error getting medical records: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get checkup results
     */
    @GetMapping("/checkup-results")
    public ResponseEntity<List<CheckupResultDto>> getCheckupResults(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        log.info("GET /api/health/checkup-results - userId: {}", userId);
        try {
            LocalDate start = startDate != null ? startDate : LocalDate.now().minusYears(3);
            LocalDate end = endDate != null ? endDate : LocalDate.now();

            List<CheckupResultDto> results = healthService.getCheckupResults(userId, start, end)
                    .stream().map(CheckupResultDto::from).collect(Collectors.toList());
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            log.error("Error getting checkup results: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get current medications
     */
    @GetMapping("/medications")
    public ResponseEntity<List<MedicationDetail>> getCurrentMedications(@RequestHeader("X-User-Id") Long userId) {
        log.info("GET /api/health/medications - userId: {}", userId);
        try {
            List<MedicationDetail> medications = healthService.getCurrentMedications(userId);
            return ResponseEntity.ok(medications);
        } catch (Exception e) {
            log.error("Error getting medications: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get health risk level
     */
    @GetMapping("/risk-level")
    public ResponseEntity<Map<String, String>> getHealthRiskLevel(@RequestHeader("X-User-Id") Long userId) {
        log.info("GET /api/health/risk-level - userId: {}", userId);
        try {
            String riskLevel = healthService.calculateHealthRiskLevel(userId);
            Map<String, String> response = new HashMap<>();
            response.put("riskLevel", riskLevel);
            response.put("userId", userId.toString());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting health risk level: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * CODEF 건강 데이터 동기화 1단계: 건강검진(NHIS) + 진료정보(HIRA) 1차 요청
     */
    @PostMapping("/sync/step1")
    public ResponseEntity<Map<String, Object>> syncStep1(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody Map<String, Object> body) {
        log.info("POST /api/health/sync/step1 - userId: {}", userId);
        try {
            CodefSyncService.SyncStep1Response resp = codefSyncService.syncStep1(
                    userId,
                    (String) body.get("userName"),
                    (String) body.get("phoneNo"),
                    (String) body.get("identity13"),
                    (String) body.get("telecom"),
                    (String) body.get("loginTypeLevel")
            );
            return ResponseEntity.ok(Map.of(
                    "sessionKey",      resp.getSessionKey(),
                    "loginTypeLevel",  resp.getLoginTypeLevel(),
                    "requiresTwoWay",  resp.isRequiresTwoWay()
            ));
        } catch (Exception e) {
            log.error("건강 데이터 동기화 1차 실패: {}", e.getMessage(), e);
            Map<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류가 발생했습니다.");
            return ResponseEntity.badRequest().body(err);
        }
    }

    /**
     * CODEF 건강 데이터 동기화 2단계: 인증 확인 + DB 저장
     */
    @PostMapping("/sync/step2")
    public ResponseEntity<Map<String, Object>> syncStep2(@RequestBody Map<String, Object> body) {
        log.info("POST /api/health/sync/step2");
        try {
            String sessionKey = (String) body.get("sessionKey");
            CodefSyncService.SyncStep2Result result = codefSyncService.syncStep2(sessionKey, "");
            return ResponseEntity.ok(Map.of(
                    "message",           "건강 데이터 동기화가 완료되었습니다.",
                    "savedCheckups",     result.getSavedCheckups(),
                    "savedMedicals",     result.getSavedMedicals(),
                    "savedMedications",  result.getSavedMedications()
            ));
        } catch (Exception e) {
            log.error("건강 데이터 동기화 2차 실패: {}", e.getMessage(), e);
            Map<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류가 발생했습니다.");
            return ResponseEntity.badRequest().body(err);
        }
    }

    // ── 건강검진(NHIS) 단독 ──────────────────────────────────────────────

    @PostMapping("/sync/checkup/step1")
    public ResponseEntity<Map<String, Object>> syncCheckupStep1(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody Map<String, Object> body) {
        log.info("POST /api/health/sync/checkup/step1 - userId: {}", userId);
        try {
            String sessionKey = codefSyncService.syncCheckupStep1(
                    userId,
                    (String) body.get("userName"),
                    (String) body.get("phoneNo"),
                    (String) body.get("identity13"),
                    (String) body.get("telecom"),
                    (String) body.get("loginTypeLevel")
            );
            return ResponseEntity.ok(Map.of("sessionKey", sessionKey));
        } catch (Exception e) {
            log.error("건강검진 1차 실패: {}", e.getMessage(), e);
            HashMap<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류");
            return ResponseEntity.badRequest().body(err);
        }
    }

    @PostMapping("/sync/checkup/step2")
    public ResponseEntity<Map<String, Object>> syncCheckupStep2(@RequestBody Map<String, Object> body) {
        log.info("POST /api/health/sync/checkup/step2");
        try {
            CodefSyncService.CheckupStep2Result result = codefSyncService.syncCheckupStep2((String) body.get("sessionKey"));
            Map<String, Object> resp = new HashMap<>();
            resp.put("message", "건강검진 동기화 완료");
            resp.put("savedCheckups", result.getSavedCheckups());
            resp.put("savedPredictions", result.getSavedPredictions());
            resp.put("failedPredictions", result.getFailedPredictions());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("건강검진 2차 실패: {}", e.getMessage(), e);
            HashMap<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류");
            return ResponseEntity.badRequest().body(err);
        }
    }

    // ── 진료정보(HIRA) 단독 ──────────────────────────────────────────────

    @PostMapping("/sync/medical/step1")
    public ResponseEntity<Map<String, Object>> syncMedicalStep1(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody Map<String, Object> body) {
        log.info("POST /api/health/sync/medical/step1 - userId: {}", userId);
        try {
            String sessionKey = codefSyncService.syncMedicalStep1(
                    userId,
                    (String) body.get("userName"),
                    (String) body.get("phoneNo"),
                    (String) body.get("identity13"),
                    (String) body.get("telecom"),
                    (String) body.get("loginTypeLevel")
            );
            return ResponseEntity.ok(Map.of("sessionKey", sessionKey));
        } catch (Exception e) {
            log.error("진료정보 1차 실패: {}", e.getMessage(), e);
            HashMap<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류");
            return ResponseEntity.badRequest().body(err);
        }
    }

    @PostMapping("/sync/medical/step2")
    public ResponseEntity<Map<String, Object>> syncMedicalStep2(@RequestBody Map<String, Object> body) {
        log.info("POST /api/health/sync/medical/step2");
        try {
            int[] counts = codefSyncService.syncMedicalStep2((String) body.get("sessionKey"));
            return ResponseEntity.ok(Map.of(
                    "message",          "진료 기록 동기화 완료",
                    "savedMedicals",    counts[0],
                    "savedMedications", counts[1]
            ));
        } catch (Exception e) {
            log.error("진료정보 2차 실패: {}", e.getMessage(), e);
            HashMap<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류");
            return ResponseEntity.badRequest().body(err);
        }
    }


    /**
     * Get disease predictions (뇌졸중 / 당뇨 / 심뇌혈관)
     * - factors (위험요인 + 연도별 추이) 와 compares (연도별 예측값) 포함
     */
    @GetMapping("/disease-predictions")
    public ResponseEntity<List<Map<String, Object>>> getDiseasePredictions(@RequestHeader("X-User-Id") Long userId) {
        log.info("GET /api/health/disease-predictions - userId: {}", userId);
        try {
            List<DiseasePrediction> rows = diseasePredictionRepo.findByUserIdOrderByCheckupDateDesc(userId);
            List<Map<String, Object>> resp = rows.stream().map(p -> {
                Map<String, Object> m = new HashMap<>();
                m.put("predictionType",  p.getPredictionType());
                m.put("checkupDate",     p.getCheckupDate());
                m.put("riskGrade",       p.getRiskGrade());
                m.put("riskRatio",       p.getRiskRatio());
                m.put("averageRatio",    p.getAverageRatio());
                m.put("averageAgeGroup", p.getAverageAgeGroup());

                List<DiseasePredictionFactor> factors = p.getFactors();
                if (factors != null) {
                    m.put("factors", factors.stream()
                            .sorted(Comparator.comparing(
                                    DiseasePredictionFactor::getSortOrder,
                                    Comparator.nullsLast(Comparator.naturalOrder())))
                            .map(f -> {
                                Map<String, Object> fm = new HashMap<>();
                                fm.put("riskFactor",    f.getRiskFactor());
                                fm.put("currentState",  f.getCurrentState());
                                fm.put("severityType",  f.getSeverityType());
                                fm.put("averageValue",  f.getAverageValue());
                                List<DiseasePredictionYearly> yearly = f.getYearly();
                                if (yearly != null) {
                                    fm.put("yearly", yearly.stream()
                                            .sorted(Comparator.comparing(
                                                    DiseasePredictionYearly::getYear,
                                                    Comparator.nullsLast(Comparator.naturalOrder())))
                                            .map(y -> {
                                                Map<String, Object> ym = new HashMap<>();
                                                ym.put("year",          y.getYear());
                                                ym.put("myAmount",      y.getMyAmount());
                                                ym.put("averageAmount", y.getAverageAmount());
                                                return ym;
                                            }).collect(Collectors.toList()));
                                }
                                return fm;
                            }).collect(Collectors.toList()));
                }

                List<DiseasePredictionCompare> compares = p.getCompares();
                if (compares != null) {
                    m.put("compares", compares.stream()
                            .sorted(Comparator.comparing(
                                    DiseasePredictionCompare::getYear,
                                    Comparator.nullsLast(Comparator.naturalOrder())))
                            .map(c -> {
                                Map<String, Object> cm = new HashMap<>();
                                cm.put("year",           c.getYear());
                                cm.put("predictedState", c.getPredictedState());
                                return cm;
                            }).collect(Collectors.toList()));
                }
                return m;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Error getting disease predictions: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get health age (건강나이)
     * - 최신 1건 반환. factors 포함. 데이터 없으면 204 No Content
     */
    @GetMapping("/health-age")
    public ResponseEntity<Map<String, Object>> getHealthAge(@RequestHeader("X-User-Id") Long userId) {
        log.info("GET /api/health/health-age - userId: {}", userId);
        try {
            List<HealthAgeResult> rows = healthAgeResultRepo.findByUserIdOrderByCheckupDateDesc(userId);
            if (rows.isEmpty()) return ResponseEntity.noContent().build();
            HealthAgeResult r = rows.get(0);
            Map<String, Object> m = new HashMap<>();
            m.put("checkupDate",        r.getCheckupDate());
            m.put("biologicalAge",      r.getBiologicalAge());
            m.put("chronologicalAge",   r.getChronologicalAge());
            m.put("summaryNote",        r.getSummaryNote());
            m.put("detailMessage",      r.getDetailMessage());
            m.put("changeAfterMessage", r.getChangeAfterMessage());
            m.put("gender",             r.getGender());
            m.put("height",             r.getHeight());
            m.put("weight",             r.getWeight());

            // factors: 저장된 JSON 문자열을 파싱해서 그대로 노출 (CODEF resDetailList 원본 구조)
            String factorsJson = r.getFactors();
            if (factorsJson != null && !factorsJson.isBlank()) {
                try {
                    List<Map<String, Object>> factors = objectMapper.readValue(
                            factorsJson, new TypeReference<List<Map<String, Object>>>() {});
                    m.put("factors", factors);
                } catch (Exception ex) {
                    log.warn("health-age factors JSON 파싱 실패: {}", ex.getMessage());
                    m.put("factors", List.of());
                }
            } else {
                m.put("factors", List.of());
            }
            return ResponseEntity.ok(m);
        } catch (Exception e) {
            log.error("Error getting health age: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "health-service"));
    }
}
