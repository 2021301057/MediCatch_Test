package com.medicatch.analysis.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class PolicyInfo {
    private Long id;
    private String companyName;
    private String productName;
    private String policyNumber;
    private String policyType;
    private String contractStatus;
    private LocalDate startDate;
    private LocalDate endDate;
    private Double monthlyPremium;
    private Double annualPremium;
    private List<CoverageItemInfo> coverageItems;
    private boolean hasSupplementaryCoverage;

    @Data
    public static class CoverageItemInfo {
        private String name;
        private String category;
        private Double amount;
        private boolean isCovered;
        private String agreementType;
    }
}
