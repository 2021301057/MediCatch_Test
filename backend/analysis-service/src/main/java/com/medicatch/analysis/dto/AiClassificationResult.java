package com.medicatch.analysis.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class AiClassificationResult {
    private String normalizedQuery;
    private String injuryDiseaseType;
    private String careType;
    private String benefitType;
    private String treatmentCategory;
    private String actualLossCategory;
    private String fixedBenefitCategory;
    private String confidence;
    private boolean needsUserConfirmation;
    private String reason;
    private List<String> nextQuestions;
    /** AI_CLASSIFICATION or HEURISTIC */
    @Builder.Default
    private String source = "AI_CLASSIFICATION";
    /** false이면 의료/보험 무관 쿼리로 판단 — matched:false 처리 */
    @Builder.Default
    private boolean isValidMedicalQuery = true;
}
