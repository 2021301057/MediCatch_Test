package com.medicatch.analysis.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class CoverageGapService {

    /**
     * Analyze coverage gaps for user
     */
    public Map<String, Object> analyzeCoverageGaps(Long userId, List<Map<String, Object>> policies) {
        log.info("Analyzing coverage gaps for userId: {}", userId);

        Map<String, Object> analysis = new HashMap<>();

        List<Map<String, String>> gaps = new ArrayList<>();

        gaps.add(Map.of(
                "category", "치과",
                "issue", "보장률 낮음",
                "coverage", "30%",
                "recommendation", "치과 보험 추가 가입 검토",
                "estimatedCost", "월 50,000원"
        ));

        gaps.add(Map.of(
                "category", "안경/렌즈",
                "issue", "보장 제외",
                "coverage", "0%",
                "recommendation", "안경 보조금 서비스 이용",
                "estimatedCost", "연 200,000원"
        ));

        gaps.add(Map.of(
                "category", "미용 시술",
                "issue", "보장 제외",
                "coverage", "0%",
                "recommendation", "실비보험 추가 고려",
                "estimatedCost", "월 100,000원"
        ));

        analysis.put("userId", userId);
        analysis.put("totalGapsFound", gaps.size());
        analysis.put("coverageGaps", gaps);
        analysis.put("overallCoverageRating", "Good");
        analysis.put("recommendedActions", List.of(
                "치과 보험 추가 가입",
                "안경 보조금 프로그램 확인",
                "실비보험 비교 검토"
        ));

        return analysis;
    }

    /**
     * Get claim opportunities
     */
    public List<Map<String, Object>> findClaimOpportunities(Long userId, List<String> recentMedicalEvents) {
        log.info("Finding claim opportunities for userId: {}", userId);

        List<Map<String, Object>> opportunities = new ArrayList<>();

        if (recentMedicalEvents.contains("입원")) {
            opportunities.add(Map.of(
                    "type", "입원급여",
                    "condition", "최근 입원 기록 발견",
                    "estimatedAmount", 2000000,
                    "probability", "높음",
                    "nextStep", "입원 증명서 준비"
            ));
        }

        if (recentMedicalEvents.contains("수술")) {
            opportunities.add(Map.of(
                    "type", "수술급여",
                    "condition", "최근 수술 기록 발견",
                    "estimatedAmount", 1500000,
                    "probability", "높음",
                    "nextStep", "수술비 영수증 확인"
            ));
        }

        if (recentMedicalEvents.contains("진료")) {
            opportunities.add(Map.of(
                    "type", "외래진료비",
                    "condition", "정기 진료 기록",
                    "estimatedAmount", 500000,
                    "probability", "중간",
                    "nextStep", "최근 3개월 영수증 확인"
            ));
        }

        if (opportunities.isEmpty()) {
            opportunities.add(Map.of(
                    "type", "일반진료비",
                    "condition", "정기적인 진료",
                    "estimatedAmount", 200000,
                    "probability", "중간",
                    "nextStep", "최근 진료 기록 확인"
            ));
        }

        return opportunities;
    }

    /**
     * Calculate potential savings
     */
    public Map<String, Object> calculatePotentialSavings(Long userId, List<Map<String, Object>> medicalHistory) {
        log.info("Calculating potential savings for userId: {}", userId);

        double totalMedicalCost = medicalHistory.stream()
                .mapToDouble(record -> {
                    Object cost = record.get("cost");
                    return cost instanceof Number ? ((Number) cost).doubleValue() : 0;
                })
                .sum();

        double avgCoverageRate = 0.80;  // 80% average
        double currentCoverage = totalMedicalCost * avgCoverageRate;
        double userResponsibility = totalMedicalCost - currentCoverage;

        Map<String, Object> savings = new HashMap<>();
        savings.put("totalMedicalCost", totalMedicalCost);
        savings.put("currentCoverage", currentCoverage);
        savings.put("userResponsibility", userResponsibility);
        savings.put("annualizedResponsibility", userResponsibility * 12);
        savings.put("potentialSavingsWithBetterCoverage", (totalMedicalCost * 0.9) - currentCoverage);

        return savings;
    }
}
