package com.medicatch.analysis.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PolicyInfo {

    private Long id;
    private String companyName;
    private String productName;
    private String policyNumber;
    private String policyType;
    private String contractStatus;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean hasSupplementaryCoverage;
    private List<CoverageItemInfo> coverageItems;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CoverageItemInfo {
        private String name;
        private String category;
        private Double amount;
        @JsonProperty("isCovered")
        private boolean covered;
    }
}
