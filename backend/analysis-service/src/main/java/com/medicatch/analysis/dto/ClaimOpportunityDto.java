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
     * CHECK_NEEDED – 확인 필요 (세대별 치과 등)
     * EXCLUDED    – 보장 제외
     */
    private String confidenceLevel;

    /** 실손 세대 코드: "1" / "2" / "3" / "3k"(착한실손) / "4". null = 해당 없음 */
    private String supplementaryGeneration;

    /** 세대·약관 기반 설명 메시지 (예: "2세대 실손 · 치과 급여 보장 가능") */
    private String coverageNote;

    /** 동일 청구 건 묶음 키. null = 청구 없음. 같은 키를 가진 레코드는 하나의 청구 그룹으로 표시 */
    private String claimGroupKey;

    /** 이미 지급 받은 금액 (resActualLossPaymentList 기준). null = 없음 */
    private Double alreadyPaidAmount;

    /** 지급 보험사 이름 (CLAIMED 시) */
    private String paidByCompany;

    /** 비급여 금액 (연말정산 resAmount - HIRA resDeductibleAmt). null = 미조회 */
    private Double nonCoveredAmount;
}
