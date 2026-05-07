package com.medicatch.insurance.controller;

import com.medicatch.insurance.dto.PolicyDto;
import com.medicatch.insurance.entity.CoverageItem;
import com.medicatch.insurance.service.CodefInsuranceSyncService;
import com.medicatch.insurance.service.InsuranceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/insurance")
public class InsuranceController {

    private final InsuranceService insuranceService;
    private final CodefInsuranceSyncService codefSyncService;

    public InsuranceController(InsuranceService insuranceService,
                                CodefInsuranceSyncService codefSyncService) {
        this.insuranceService = insuranceService;
        this.codefSyncService = codefSyncService;
    }

    /**
     * Get active policies for user
     */
    @GetMapping("/policies")
    public ResponseEntity<List<PolicyDto>> getActivePolicies(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestParam(value = "userId", required = false) Long userIdParam) {
        Long userId = userIdParam;
        if (userId == null && userIdHeader != null && !userIdHeader.isBlank()) {
            userId = Long.parseLong(userIdHeader);
        }
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }
        log.info("GET /api/insurance/policies - userId: {}", userId);
        try {
            List<PolicyDto> policies = insuranceService.getActivePolicies(userId)
                    .stream().map(PolicyDto::from).collect(Collectors.toList());
            return ResponseEntity.ok(policies);
        } catch (Exception e) {
            log.error("Error getting policies: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get all policies for user
     */
    @GetMapping("/policies/all")
    public ResponseEntity<List<PolicyDto>> getAllPolicies(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        if (userIdHeader == null || userIdHeader.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Long userId = Long.parseLong(userIdHeader);
        log.info("GET /api/insurance/policies/all - userId: {}", userId);
        try {
            List<PolicyDto> policies = insuranceService.getAllPolicies(userId)
                    .stream().map(PolicyDto::from).collect(Collectors.toList());
            return ResponseEntity.ok(policies);
        } catch (Exception e) {
            log.error("Error getting all policies: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get coverage items for specific policy
     */
    @GetMapping("/policies/{policyId}/coverage")
    public ResponseEntity<List<CoverageItem>> getPolicyCoverage(@PathVariable Long policyId) {
        log.info("GET /api/insurance/policies/{}/coverage - policyId: {}", policyId, policyId);
        try {
            List<CoverageItem> items = insuranceService.getCoverageItems(policyId);
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            log.error("Error getting coverage items: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Check coverage for specific service
     */
    @GetMapping("/coverage/check")
    public ResponseEntity<Map<String, Object>> checkCoverage(
            @RequestParam Long policyId,
            @RequestParam String serviceCategory) {
        log.info("GET /api/insurance/coverage/check - policyId: {}, category: {}", policyId, serviceCategory);
        try {
            Map<String, Object> coverage = insuranceService.checkCoverage(policyId, serviceCategory);
            return ResponseEntity.ok(coverage);
        } catch (Exception e) {
            log.error("Error checking coverage: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Calculate estimated coverage amount
     */
    @GetMapping("/coverage/estimate")
    public ResponseEntity<Map<String, Double>> estimateCoverage(
            @RequestParam Long policyId,
            @RequestParam String serviceCategory,
            @RequestParam Double serviceAmount) {
        log.info("GET /api/insurance/coverage/estimate - policyId: {}, amount: {}", policyId, serviceAmount);
        try {
            Map<String, Double> estimate = insuranceService.calculateEstimatedCoverage(
                    policyId, serviceCategory, serviceAmount);
            return ResponseEntity.ok(estimate);
        } catch (Exception e) {
            log.error("Error estimating coverage: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get insurance summary for user
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getInsuranceSummary(@RequestParam String codefId) {
        log.info("GET /api/insurance/summary - codefId: {}", codefId);
        try {
            Map<String, Object> summary = insuranceService.getInsuranceSummary(codefId);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error getting insurance summary: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * CODEF 보험 계약 정보 동기화 (단일 호출)
     */
    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncInsurance(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        String codefId = (String) body.get("codefId");
        if (codefId == null || codefId.isBlank()) return ResponseEntity.badRequest().body(Map.of("message", "codefId가 필요합니다."));
        if (userIdHeader == null || userIdHeader.isBlank()) return ResponseEntity.badRequest().body(Map.of("message", "인증 정보가 필요합니다."));
        Long userId = Long.parseLong(userIdHeader);
        log.info("POST /api/insurance/sync - codefId: {}, userId: {}", codefId, userId);
        try {
            int saved = codefSyncService.syncInsuranceData(
                    userId,
                    codefId,
                    (String) body.get("codefPassword")
            );
            return ResponseEntity.ok(Map.of(
                    "message",      "보험 데이터 동기화가 완료되었습니다.",
                    "savedPolicies", saved
            ));
        } catch (Exception e) {
            log.error("보험 데이터 동기화 실패: {}", e.getMessage(), e);
            Map<String, Object> err = new HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류가 발생했습니다.");
            return ResponseEntity.badRequest().body(err);
        }
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "insurance-service"));
    }
}
