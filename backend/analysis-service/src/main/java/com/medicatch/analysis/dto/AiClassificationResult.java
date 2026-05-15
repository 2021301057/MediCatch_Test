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
}
