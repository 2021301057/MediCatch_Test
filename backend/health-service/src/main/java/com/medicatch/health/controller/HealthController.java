package com.medicatch.health.controller;

import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.MedicalRecord;
import com.medicatch.health.entity.MedicationDetail;
import com.medicatch.health.service.CodefSyncService;
import com.medicatch.health.service.HealthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final HealthService healthService;
    private final CodefSyncService codefSyncService;

    public HealthController(HealthService healthService, CodefSyncService codefSyncService) {
        this.healthService = healthService;
        this.codefSyncService = codefSyncService;
    }

    /**
     * Get health summary for user
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getHealthSummary(@RequestParam Long userId) {
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
    public ResponseEntity<List<MedicalRecord>> getMedicalRecords(
            @RequestParam Long userId,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        log.info("GET /api/health/medical-records - userId: {}", userId);
        try {
            LocalDate start = startDate != null ? startDate : LocalDate.now().minusYears(1);
            LocalDate end = endDate != null ? endDate : LocalDate.now();

            List<MedicalRecord> records = healthService.getMedicalRecords(userId, start, end);
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
    public ResponseEntity<List<CheckupResult>> getCheckupResults(
            @RequestParam Long userId,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        log.info("GET /api/health/checkup-results - userId: {}", userId);
        try {
            LocalDate start = startDate != null ? startDate : LocalDate.now().minusYears(2);
            LocalDate end = endDate != null ? endDate : LocalDate.now();

            List<CheckupResult> results = healthService.getCheckupResults(userId, start, end);
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
    public ResponseEntity<List<MedicationDetail>> getCurrentMedications(@RequestParam Long userId) {
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
    public ResponseEntity<Map<String, String>> getHealthRiskLevel(@RequestParam Long userId) {
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
    public ResponseEntity<Map<String, Object>> syncStep1(@RequestBody Map<String, Object> body) {
        Long userId = Long.parseLong(body.get("userId").toString());
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
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
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
                    "message",          "건강 데이터 동기화가 완료되었습니다.",
                    "savedCheckups",    result.getSavedCheckups(),
                    "savedMedicals",    result.getSavedMedicals(),
                    "savedMedications", result.getSavedMedications()
            ));
        } catch (Exception e) {
            log.error("건강 데이터 동기화 2차 실패: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
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
