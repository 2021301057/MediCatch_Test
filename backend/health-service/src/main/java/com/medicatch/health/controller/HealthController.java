package com.medicatch.health.controller;

import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.MedicalRecord;
import com.medicatch.health.entity.MedicationDetail;
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

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
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
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "health-service"));
    }
}
