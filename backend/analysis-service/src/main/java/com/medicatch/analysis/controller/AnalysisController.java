package com.medicatch.analysis.controller;

import com.medicatch.analysis.dto.ClaimOpportunityDto;
import com.medicatch.analysis.dto.PreTreatmentSearchRequest;
import com.medicatch.analysis.dto.PreTreatmentSearchResponse;
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
     * Search pre-treatment coverage rules by user query
     */
    @PostMapping("/pre-treatment-search")
    public ResponseEntity<PreTreatmentSearchResponse> searchPreTreatment(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        log.info("POST /api/analysis/pre-treatment-search - query: {}", body != null ? body.get("query") : null);
        try {
            PreTreatmentSearchRequest normalizedRequest = toPreTreatmentRequest(body, userIdHeader);
            return ResponseEntity.ok(preTreatmentSearchService.searchPreTreatment(normalizedRequest));
        } catch (Exception e) {
            log.error("Error searching pre-treatment rules: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }

    private PreTreatmentSearchRequest toPreTreatmentRequest(Map<String, Object> body, String userIdHeader) {
        Map<String, Object> safeBody = body != null ? body : Map.of();
        Long userId = parseLong(safeBody.get("userId"));
        if (userId == null) {
            userId = parseLong(userIdHeader);
        }
        return PreTreatmentSearchRequest.builder()
                .userId(userId)
                .query(asString(safeBody.get("query")))
                .estimatedCost(parseDouble(safeBody.get("estimatedCost")))
                .hospitalType(asString(safeBody.get("hospitalType")))
                .benefitType(asString(safeBody.get("benefitType")))
                .injuryDiseaseType(asString(safeBody.get("injuryDiseaseType")))
                .build();
    }

    private Long parseLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        String text = value.toString().trim();
        if (text.isBlank()) return null;
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("userId must be a number.");
        }
    }

    private Double parseDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.doubleValue();
        String text = value.toString().trim();
        if (text.isBlank()) return null;
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("estimatedCost must be a number.");
        }
    }

    private String asString(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isBlank() ? null : text;
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
     * Find claim opportunities – matches medical records against active insurance policies
     */
    @GetMapping("/claim-opportunities")
    public ResponseEntity<List<ClaimOpportunityDto>> findClaimOpportunities(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestParam(value = "userId", required = false) String userIdParam) {
        String raw = userIdHeader != null ? userIdHeader : userIdParam;
        if (raw == null || raw.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Long userId = Long.parseLong(raw);
        log.info("GET /api/analysis/claim-opportunities - userId: {}", userId);
        try {
            List<ClaimOpportunityDto> opportunities = claimMatchingService.matchClaimOpportunities(userId);
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
