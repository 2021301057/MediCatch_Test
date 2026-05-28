package com.medicatch.insurance.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
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
    private Double premiumAmount;
    private String paymentCycle;
    private String paymentPeriod;
    private List<CoverageItemDto> coverageItems;
    private boolean hasSupplementaryCoverage;
    private String actualLossGeneration;

    @Data
    @Builder
    public static class CoverageItemDto {
        private String name;
        private String category;
        private Double amount;
        @JsonProperty("isCovered")
        private boolean isCovered;
        private String agreementType;
    }

    public static PolicyDto from(Policy p) {
        List<CoverageItemDto> items = p.getCoverageItems() == null ? List.of() :
                p.getCoverageItems().stream()
                        .map(ci -> CoverageItemDto.builder()
                                .name(ci.getItemName())
                                .category(ci.getCategory())
                                .amount(ci.getMaxBenefitAmount())
                                .isCovered(ci.isCovered())
                                .agreementType(ci.getConditions())
                                .build())
                        .collect(Collectors.toList());

        boolean isActualLoss = "SUPPLEMENTARY".equals(p.getInsuranceType()) || p.isHasSupplementaryCoverage();
        String generation = isActualLoss ? computeActualLossGeneration(p) : null;

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
                .premiumAmount(p.getPremiumAmount())
                .paymentCycle(p.getPaymentCycle())
                .paymentPeriod(p.getPaymentPeriod())
                .coverageItems(items)
                .hasSupplementaryCoverage(p.isHasSupplementaryCoverage())
                .actualLossGeneration(generation)
                .build();
    }

    // 실손 세대 경계 (analysis-service InsuranceGenerationUtils와 동일 기준)
    private static final LocalDate GEN2_START = LocalDate.of(2009, 10, 1);
    private static final LocalDate GEN3_START = LocalDate.of(2017,  4, 1);
    private static final LocalDate GEN4_START = LocalDate.of(2021,  7, 1);

    private static String computeActualLossGeneration(Policy p) {
        LocalDate startDate = p.getStartDate();
        if (startDate == null) return null;
        if (startDate.isBefore(GEN2_START)) {
            return isLifeInsurer(p) ? "1세대(생보)" : "1세대(손보)";
        }
        if (startDate.isBefore(GEN3_START)) return "2세대";
        if (startDate.isBefore(GEN4_START)) {
            return isKindActualLoss(p) ? "3세대(착한실손)" : "3세대(표준형)";
        }
        return "4세대";
    }

    private static boolean isLifeInsurer(Policy p) {
        String target = lower(nullToBlank(p.getInsurerName()) + " " + nullToBlank(p.getInsuranceType()));
        return target.contains("생명") || target.contains("생보")
                || (target.contains("life") && !target.contains("nonlife") && !target.contains("non-life"));
    }

    private static boolean isKindActualLoss(Policy p) {
        String target = lower(nullToBlank(p.getPolicyDetails()) + " " + nullToBlank(p.getInsuranceType()));
        if (target.contains("착한실손") || target.contains("착한") || target.contains("경제형")
                || target.contains("3-c")) return true;
        List<CoverageItem> items = p.getCoverageItems();
        if (items == null) return false;
        return items.stream().anyMatch(ci -> {
            String t = lower(nullToBlank(ci.getItemName()) + " "
                    + nullToBlank(ci.getCategory()) + " "
                    + nullToBlank(ci.getConditions()));
            return t.contains("도수") || t.contains("주사") || t.contains("mri");
        });
    }

    private static String lower(String s) {
        return s == null ? "" : s.toLowerCase();
    }

    private static String nullToBlank(String s) {
        return s != null ? s : "";
    }
}
