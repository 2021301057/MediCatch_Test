package com.medicatch.analysis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreTreatmentSearchResponse {

    private String query;
    private Boolean matched;
    private String matchSource;
    private String confidence;
    private TreatmentClassificationDto classification;
    private ActualLossResultDto actualLoss;
    private FixedBenefitResultDto fixedBenefits;
    private List<String> nextQuestions;
    private String message;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TreatmentClassificationDto {
        private String keyword;
        private List<String> synonyms;
        private String injuryDiseaseType;
        private String careType;
        private String benefitType;
        private String treatmentCategory;
        private String actualLossCategory;
        private String fixedBenefitCategory;
        private Boolean needsUserConfirmation;
        private String cautionMessage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActualLossResultDto {
        private Boolean applicable;
        private String reason;
        private Integer candidateRuleCount;
        private List<ActualLossRuleDto> rules;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActualLossRuleDto {
        private String generationCode;
        private String careType;
        private String benefitType;
        private String treatmentCategory;
        private String actualLossCategory;
        private Double reimbursementRate;
        private Double patientCopayRate;
        private Double fixedDeductible;
        private String deductibleMethod;
        private Double limitAmount;
        private Integer limitCount;
        private Boolean requiresRider;
        private Boolean isExcluded;
        private String note;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FixedBenefitResultDto {
        private Boolean applicable;
        private String category;
        private Integer matchRuleCount;
        private List<FixedBenefitRuleDto> rules;
        private List<FixedBenefitOwnedGroupDto> ownedGroups;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FixedBenefitRuleDto {
        private String category;
        private String displayName;
        private List<String> matchKeywords;
        private List<String> excludeKeywords;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FixedBenefitOwnedGroupDto {
        private String category;
        private String displayName;
        private Boolean owned;
        private Integer matchedItemCount;
        private Double totalCoverageAmount;
        private List<MatchedCoverageItemDto> matchedItems;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MatchedCoverageItemDto {
        private Long policyId;
        private String policyName;
        private String insurerName;
        private String policyType;
        private String itemName;
        private String category;
        private String agreementType;
        private Double coverageAmount;
    }
}
