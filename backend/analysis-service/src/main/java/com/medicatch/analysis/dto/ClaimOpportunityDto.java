package com.medicatch.analysis.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class ClaimOpportunityDto {
    private Long id;
    private LocalDate visitDate;
    private String hospitalName;
    private String department;
    private String diagnosis;
    private String diseaseCode;
    private String treatmentType;
    private Double patientPayment;
    private Double insurancePayment;
    private Double totalCost;
    private String claimStatus;
    private boolean hasClaimOpportunity;
    private Double claimAmount;
    private String claimInsurance;
    private List<MatchedPolicyDto> matchedPolicies;

    @Data
    @Builder
    public static class MatchedPolicyDto {
        private Long policyId;
        private String policyName;
        private String companyName;
        private String coverageType;
        private Double estimatedAmount;
        private String coverageItemName;
    }
}
