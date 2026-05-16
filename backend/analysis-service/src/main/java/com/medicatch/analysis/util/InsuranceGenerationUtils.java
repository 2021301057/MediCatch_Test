package com.medicatch.analysis.util;

import com.medicatch.analysis.dto.PolicyInfo;

import java.time.LocalDate;
import java.util.List;

/**
 * 실손보험 세대 판별 공통 유틸.
 *
 * 반환 코드 (DB insurance_benefit_rules.generation_code 기준):
 *   "1-d" = 1세대 손보  (~2009.09)
 *   "1-h" = 1세대 생보  (~2009.09)
 *   "2"   = 2세대        (2009.10~2017.03)
 *   "3-s" = 3세대 표준   (2017.04~2021.06)
 *   "3-c" = 3세대 착한실손(2017.04~2021.06)
 *   "4"   = 4세대        (2021.07~현재)
 */
public final class InsuranceGenerationUtils {

    private static final LocalDate GEN2_START = LocalDate.of(2009, 10, 1);
    private static final LocalDate GEN3_START = LocalDate.of(2017,  4, 1);
    private static final LocalDate GEN4_START = LocalDate.of(2021,  7, 1);

    private InsuranceGenerationUtils() {}

    /**
     * 정책 정보로 실손 세대를 판별하여 DB 코드를 반환한다.
     * startDate가 null이면 null 반환.
     */
    public static String detect(PolicyInfo policy) {
        LocalDate startDate = policy.getStartDate();
        if (startDate == null) return null;
        if (startDate.isBefore(GEN2_START))
            return isLifeInsurer(policy) ? "1-h" : "1-d";
        if (startDate.isBefore(GEN3_START)) return "2";
        if (startDate.isBefore(GEN4_START))
            return isKindActualLoss(policy) ? "3-c" : "3-s";
        return "4";
    }

    /**
     * 생명보험사 여부 판별.
     * companyName 또는 policyType에 "생명"/"생보"/"life" 포함 시 true.
     */
    public static boolean isLifeInsurer(PolicyInfo policy) {
        String target = normalize(
                nullToBlank(policy.getCompanyName()) + " " + nullToBlank(policy.getPolicyType()));
        return target.contains("생명") || target.contains("생보")
                || (target.contains("life") && !target.contains("nonlife") && !target.contains("non-life"));
    }

    /**
     * 3세대 착한실손 여부 판별.
     * productName/policyType 키워드 또는 비급여 3종 특약 담보 항목으로 판단.
     */
    public static boolean isKindActualLoss(PolicyInfo policy) {
        String target = normalize(
                nullToBlank(policy.getProductName()) + " " + nullToBlank(policy.getPolicyType()));
        if (target.contains("착한실손") || target.contains("착한") || target.contains("경제형")
                || target.contains("3-c")) return true;
        List<PolicyInfo.CoverageItemInfo> items = policy.getCoverageItems();
        if (items == null) return false;
        return items.stream().anyMatch(item -> {
            String itemTarget = normalize(
                    nullToBlank(item.getName()) + " " + nullToBlank(item.getCategory())
                    + " " + nullToBlank(item.getAgreementType()));
            return itemTarget.contains("도수") || itemTarget.contains("주사") || itemTarget.contains("mri");
        });
    }

    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase();
    }

    private static String nullToBlank(String s) {
        return s != null ? s : "";
    }
}
