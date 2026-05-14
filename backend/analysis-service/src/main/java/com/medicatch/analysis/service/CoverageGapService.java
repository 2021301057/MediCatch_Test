package com.medicatch.analysis.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class CoverageGapService {

    /**
     * Analyze coverage gaps for user.
     *
     * Mock recommendations were removed from this service. Coverage comparison
     * should be calculated from real insurance data in insurance-service.
     */
    public Map<String, Object> analyzeCoverageGaps(Long userId, List<Map<String, Object>> policies) {
        log.info("Coverage gap mock response disabled for userId: {}", userId);

        Map<String, Object> analysis = new HashMap<>();
        analysis.put("userId", userId);
        analysis.put("available", false);
        analysis.put("totalGapsFound", 0);
        analysis.put("coverageGaps", List.of());
        analysis.put("overallCoverageRating", "UNKNOWN");
        analysis.put("recommendedActions", List.of());
        analysis.put("message", "Coverage gap analysis is not generated from mock data. Use real insurance coverage comparison data.");

        return analysis;
    }

    /**
     * Get claim opportunities.
     *
     * Claim opportunity matching is handled by ClaimMatchingService.
     */
    public List<Map<String, Object>> findClaimOpportunities(Long userId, List<String> recentMedicalEvents) {
        log.info("CoverageGapService claim opportunity mock response disabled for userId: {}", userId);
        return List.of();
    }

    /**
     * Calculate potential savings.
     *
     * This method no longer applies a fixed coverage rate because that produced
     * mock savings. It only reports the provided medical cost total.
     */
    public Map<String, Object> calculatePotentialSavings(Long userId, List<Map<String, Object>> medicalHistory) {
        log.info("Potential savings mock calculation disabled for userId: {}", userId);

        double totalMedicalCost = medicalHistory == null ? 0 : medicalHistory.stream()
                .mapToDouble(record -> {
                    Object cost = record.get("cost");
                    return cost instanceof Number ? ((Number) cost).doubleValue() : 0;
                })
                .sum();

        Map<String, Object> savings = new HashMap<>();
        savings.put("userId", userId);
        savings.put("available", false);
        savings.put("totalMedicalCost", totalMedicalCost);
        savings.put("currentCoverage", null);
        savings.put("userResponsibility", null);
        savings.put("annualizedResponsibility", null);
        savings.put("potentialSavingsWithBetterCoverage", null);
        savings.put("message", "Savings analysis is not calculated without real policy coverage rules.");

        return savings;
    }
}
