package com.medicatch.insurance.dto;

import com.medicatch.insurance.entity.CoverageItem;
import com.medicatch.insurance.entity.Policy;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class PolicyDto {

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
    private List<CoverageItemDto> coverageItems;
    private boolean hasSupplementaryCoverage;

    @Data
    @Builder
    public static class CoverageItemDto {
        private String name;
        private String category;
        private Double amount;
        private boolean isCovered;
    }

    public static PolicyDto from(Policy p) {
        List<CoverageItemDto> items = p.getCoverageItems() == null ? List.of() :
                p.getCoverageItems().stream()
                        .map(ci -> CoverageItemDto.builder()
                                .name(ci.getItemName())
                                .category(ci.getCategory())
                                .amount(ci.getMaxBenefitAmount())
                                .isCovered(ci.isCovered())
                                .build())
                        .collect(Collectors.toList());

        return PolicyDto.builder()
                .id(p.getId())
                .companyName(p.getInsurerName())
                .productName(p.getPolicyDetails())
                .policyNumber(p.getPolicyNumber())
                .policyType(p.getInsuranceType())
                .contractStatus(p.isActive() ? "ACTIVE" : "EXPIRED")
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .monthlyPremium(p.getMonthlyPremium())
                .annualPremium(p.getAnnualPremium())
                .coverageItems(items)
                .hasSupplementaryCoverage(p.isHasSupplementaryCoverage())
                .build();
    }
}
