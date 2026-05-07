package com.medicatch.analysis.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class ClaimOpportunityDto {

    private Long id;
    private LocalDate visitDate;
    private String hospitalName;
    private String treatmentType;
    private Double patientPayment;
    private Double insurancePayment;
    private Double totalCost;

    private boolean hasClaimOpportunity;
    private Double claimAmount;
    private String claimInsurance;
    private String matchedCoverage;

    private String claimStatus;

    /**
     * CONFIRMED   – 매핑 확실
     * LIKELY      – 높은 확률 매핑
     * CHECK_NEEDED – 확인 필요 (치과 급여 등)
     * EXCLUDED    – 보장 제외
     */
    private String confidenceLevel;
}
