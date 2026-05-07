package com.medicatch.analysis.controller;

import com.medicatch.analysis.dto.ClaimOpportunityDto;
import com.medicatch.analysis.service.ClaimMatchingService;
import com.medicatch.analysis.service.CoverageGapService;
import com.medicatch.analysis.service.PreTreatmentSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final PreTreatmentSearchService preTreatmentSearchService;
    private final CoverageGapService coverageGapService;
    private final ClaimMatchingService claimMatchingService;

    public AnalysisController(PreTreatmentSearchService preTreatmentSearchService,
                              CoverageGapService coverageGapService,
                              ClaimMatchingService claimMatchingService) {
        this.preTreatmentSearchService = preTreatmentSearchService;
        this.coverageGapService = coverageGapService;
        this.claimMatchingService = claimMatchingService;
    }

    /**
     * Search treatments by condition
     */
    @GetMapping("/treatments/search")
    public ResponseEntity<List<Map<String, Object>>> searchTreatments(
            @RequestParam String condition) {
        log.info("GET /api/analysis/treatments/search - condition: {}", condition);
        try {
            List<Map<String, Object>> results = preTreatmentSearchService.searchTreatments(condition);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            log.error("Error searching treatments: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get treatment details
     */
    @GetMapping("/treatments/{treatmentId}")
    public ResponseEntity<Map<String, Object>> getTreatmentDetails(@PathVariable String treatmentId) {
        log.info("GET /api/analysis/treatments/{} - treatmentId: {}", treatmentId, treatmentId);
        try {
            Map<String, Object> details = preTreatmentSearchService.getTreatmentDetails(treatmentId);
            return ResponseEntity.ok(details);
        } catch (Exception e) {
            log.error("Error getting treatment details: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get available conditions
     */
    @GetMapping("/conditions")
    public ResponseEntity<List<String>> getAvailableConditions() {
        log.info("GET /api/analysis/conditions");
        try {
            List<String> conditions = preTreatmentSearchService.getAvailableConditions();
            return ResponseEntity.ok(conditions);
        } catch (Exception e) {
            log.error("Error getting conditions: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Search hospitals
     */
    @GetMapping("/hospitals/search")
    public ResponseEntity<List<Map<String, Object>>> searchHospitals(
            @RequestParam String condition,
            @RequestParam(required = false) String location) {
        log.info("GET /api/analysis/hospitals/search - condition: {}, location: {}", condition, location);
        try {
            List<Map<String, Object>> results = preTreatmentSearchService.searchHospitals(condition, location);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            log.error("Error searching hospitals: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Analyze coverage gaps
     */
    @GetMapping("/coverage-gaps")
    public ResponseEntity<Map<String, Object>> analyzeCoverageGaps(
            @RequestParam Long userId,
            @RequestBody(required = false) List<Map<String, Object>> policies) {
        log.info("GET /api/analysis/coverage-gaps - userId: {}", userId);
        try {
            Map<String, Object> analysis = coverageGapService.analyzeCoverageGaps(userId, policies);
            return ResponseEntity.ok(analysis);
        } catch (Exception e) {
            log.error("Error analyzing coverage gaps: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Find claim opportunities by matching medical records with insurance policies
     */
    @GetMapping("/claim-opportunities")
    public ResponseEntity<List<ClaimOpportunityDto>> findClaimOpportunities(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestParam(required = false) Long userId) {
        Long resolvedUserId = userId;
        if (resolvedUserId == null && userIdHeader != null && !userIdHeader.isBlank()) {
            resolvedUserId = Long.parseLong(userIdHeader);
        }
        if (resolvedUserId == null) {
            return ResponseEntity.badRequest().build();
        }
        log.info("GET /api/analysis/claim-opportunities - userId: {}", resolvedUserId);
        try {
            List<ClaimOpportunityDto> opportunities = claimMatchingService.findClaimOpportunities(resolvedUserId);
            return ResponseEntity.ok(opportunities);
        } catch (Exception e) {
            log.error("Error finding claim opportunities: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Calculate potential savings
     */
    @GetMapping("/savings-analysis")
    public ResponseEntity<Map<String, Object>> calculateSavings(
            @RequestParam Long userId,
            @RequestBody(required = false) List<Map<String, Object>> medicalHistory) {
        log.info("GET /api/analysis/savings-analysis - userId: {}", userId);
        try {
            Map<String, Object> savings = coverageGapService.calculatePotentialSavings(userId, medicalHistory);
            return ResponseEntity.ok(savings);
        } catch (Exception e) {
            log.error("Error calculating savings: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "analysis-service"));
    }
}
