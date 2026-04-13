package com.medicatch.insurance.controller;

import com.medicatch.insurance.entity.CoverageItem;
import com.medicatch.insurance.entity.Policy;
import com.medicatch.insurance.service.InsuranceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/insurance")
public class InsuranceController {

    private final InsuranceService insuranceService;

    public InsuranceController(InsuranceService insuranceService) {
        this.insuranceService = insuranceService;
    }

    /**
     * Get active policies for user
     */
    @GetMapping("/policies")
    public ResponseEntity<List<Policy>> getActivePolicies(@RequestParam Long userId) {
        log.info("GET /api/insurance/policies - userId: {}", userId);
        try {
            List<Policy> policies = insuranceService.getActivePolicies(userId);
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
    public ResponseEntity<List<Policy>> getAllPolicies(@RequestParam Long userId) {
        log.info("GET /api/insurance/policies/all - userId: {}", userId);
        try {
            List<Policy> policies = insuranceService.getAllPolicies(userId);
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
    public ResponseEntity<Map<String, Object>> getInsuranceSummary(@RequestParam Long userId) {
        log.info("GET /api/insurance/summary - userId: {}", userId);
        try {
            Map<String, Object> summary = insuranceService.getInsuranceSummary(userId);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error getting insurance summary: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
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
