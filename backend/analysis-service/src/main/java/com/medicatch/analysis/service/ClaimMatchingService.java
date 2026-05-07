package com.medicatch.analysis.service;

import com.medicatch.analysis.client.HealthServiceClient;
import com.medicatch.analysis.client.InsuranceServiceClient;
import com.medicatch.analysis.dto.ClaimOpportunityDto;
import com.medicatch.analysis.dto.ClaimOpportunityDto.MatchedPolicyDto;
import com.medicatch.analysis.dto.MedicalRecordInfo;
import com.medicatch.analysis.dto.PolicyInfo;
import com.medicatch.analysis.dto.PolicyInfo.CoverageItemInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClaimMatchingService {

    private final HealthServiceClient healthClient;
    private final InsuranceServiceClient insuranceClient;

    public List<ClaimOpportunityDto> findClaimOpportunities(Long userId) {
        List<MedicalRecordInfo> records;
        List<PolicyInfo> policies;

        try {
            records = healthClient.getMedicalRecords(userId);
        } catch (Exception e) {
            log.warn("health-service 조회 실패 userId={}: {}", userId, e.getMessage());
            records = List.of();
        }

        try {
            policies = insuranceClient.getActivePolicies(userId);
        } catch (Exception e) {
            log.warn("insurance-service 조회 실패 userId={}: {}", userId, e.getMessage());
            policies = List.of();
        }

        List<PolicyInfo> activePolicies = policies.stream()
                .filter(p -> "ACTIVE".equals(p.getContractStatus()))
                .collect(Collectors.toList());

        return records.stream()
                .map(r -> buildOpportunity(r, activePolicies))
                .sorted(Comparator.comparing(ClaimOpportunityDto::getVisitDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    private ClaimOpportunityDto buildOpportunity(MedicalRecordInfo record, List<PolicyInfo> policies) {
        // 본인부담금이 있어야 청구 검토 대상
        boolean hasCost = record.getPatientPayment() != null && record.getPatientPayment() > 0;
        List<MatchedPolicyDto> matched = hasCost ? matchAgainstCoverageItems(record, policies) : List.of();

        double totalClaimable = matched.stream()
                .mapToDouble(m -> m.getEstimatedAmount() != null ? m.getEstimatedAmount() : 0)
                .sum();

        String claimInsurance = matched.isEmpty() ? null :
                matched.stream()
                        .map(m -> m.getCompanyName() + " " + m.getCoverageType())
                        .distinct()
                        .collect(Collectors.joining(", "));

        return ClaimOpportunityDto.builder()
                .id(record.getId())
                .visitDate(record.getVisitDate())
                .hospitalName(record.getHospitalName())
                .department(record.getDepartment())
                .diagnosis(record.getDiagnosis())
                .diseaseCode(record.getDiseaseCode())
                .treatmentType(record.getTreatmentType())
                .patientPayment(record.getPatientPayment())
                .insurancePayment(record.getInsurancePayment())
                .totalCost(record.getTotalCost())
                .claimStatus("UNCLAIMED")
                .hasClaimOpportunity(!matched.isEmpty())
                .claimAmount(totalClaimable)
                .claimInsurance(claimInsurance)
                .matchedPolicies(matched)
                .build();
    }

    /**
     * 보험 계약의 보장 항목(agreementType) 하나하나와 진료 기록을 비교한다.
     *
     * agreementType 예시:
     *   실손계열: "질병통원의료비", "상해통원의료비", "질병입원의료비", "상해입원의료비", "질병처방조제비"
     *   정액계열: "암진단", "골절진단", "화상진단", "뇌혈관질환진단", "허혈성심장질환진단",
     *             "질병입원일당", "상해입원일당", "질병수술급여", "상해수술급여"
     */
    private List<MatchedPolicyDto> matchAgainstCoverageItems(MedicalRecordInfo record, List<PolicyInfo> policies) {
        List<MatchedPolicyDto> result = new ArrayList<>();
        for (PolicyInfo policy : policies) {
            if (policy.getCoverageItems() == null) continue;
            for (CoverageItemInfo item : policy.getCoverageItems()) {
                if (!item.isCovered()) continue;

                Double claimable = estimateClaimable(record, item);
                if (claimable == null || claimable <= 0) continue;

                String agreementType = item.getAgreementType();
                String coverageType = isSupplementaryItem(agreementType) ? "실손" : "정액";

                result.add(MatchedPolicyDto.builder()
                        .policyId(policy.getId())
                        .policyName(policy.getProductName())
                        .companyName(policy.getCompanyName())
                        .coverageType(coverageType)
                        .estimatedAmount(claimable)
                        .coverageItemName(item.getName())
                        .build());
            }
        }
        return result;
    }

    /**
     * 보장 항목 하나에 대해 청구 가능 금액을 계산한다.
     * 매칭 안 되면 null 반환.
     *
     * 실손: 본인부담금(patientPayment) 전액이 청구 대상
     * 정액: 보장 항목의 약정 금액(item.amount)이 청구 대상
     */
    private Double estimateClaimable(MedicalRecordInfo record, CoverageItemInfo item) {
        String agreementType = item.getAgreementType();

        // agreementType이 없으면 category로 폴백
        if (agreementType == null || agreementType.isBlank()) {
            return matchByCategory(record, item) ? record.getPatientPayment() : null;
        }

        // ── 실손 ──
        if (isOutpatientItem(agreementType) && isOutpatient(record.getTreatmentType())) {
            return record.getPatientPayment();
        }
        if (isInpatientItem(agreementType) && isInpatient(record.getTreatmentType())) {
            return record.getPatientPayment();
        }
        if (isPharmacyItem(agreementType) && isPharmacy(record.getTreatmentType())) {
            return record.getPatientPayment();
        }

        // ── 정액 ──
        if (matchesDiagnosisCondition(record.getDiseaseCode(), agreementType)) {
            return item.getAmount() != null ? item.getAmount() : record.getPatientPayment();
        }

        return null;
    }

    // ── agreementType 분류 ────────────────────────────────────────

    private boolean isSupplementaryItem(String agreementType) {
        if (agreementType == null) return false;
        return agreementType.contains("통원의료비")
                || agreementType.contains("입원의료비")
                || agreementType.contains("처방조제비");
    }

    private boolean isOutpatientItem(String t) {
        return t.contains("통원의료비");
    }

    private boolean isInpatientItem(String t) {
        return t.contains("입원의료비");
    }

    private boolean isPharmacyItem(String t) {
        return t.contains("처방조제비");
    }

    // ── 치료 유형 판별 (resTreatType 값) ─────────────────────────────

    private boolean isOutpatient(String t) {
        if (t == null) return false;
        return t.contains("외래") || t.contains("통원") || t.equals("2");
    }

    private boolean isInpatient(String t) {
        if (t == null) return false;
        return t.contains("입원") || t.equals("1");
    }

    private boolean isPharmacy(String t) {
        if (t == null) return false;
        return t.contains("약국") || t.equals("3");
    }

    // ── category 폴백 (agreementType 없을 때) ─────────────────────────

    private boolean matchByCategory(MedicalRecordInfo record, CoverageItemInfo item) {
        String cat = item.getCategory();
        if (cat == null) return false;
        return ("OUTPATIENT".equals(cat) && isOutpatient(record.getTreatmentType()))
                || ("INPATIENT".equals(cat) && isInpatient(record.getTreatmentType()))
                || ("MEDICATION".equals(cat) && isPharmacy(record.getTreatmentType()));
    }

    // ── KCD 진단코드 → 정액 보장 조건 매핑 ──────────────────────────────

    private boolean matchesDiagnosisCondition(String diseaseCode, String agreementType) {
        if (diseaseCode == null || diseaseCode.isBlank()) return false;
        String dc = diseaseCode.toUpperCase().trim();

        if (agreementType.contains("암") && dc.startsWith("C")) return true;
        if (agreementType.contains("허혈성심장") && dc.startsWith("I2")) return true;
        if (agreementType.contains("뇌혈관") && dc.startsWith("I6")) return true;
        if (agreementType.contains("골절") && isFractureCode(dc)) return true;
        if (agreementType.contains("화상") && isBurnCode(dc)) return true;

        return false;
    }

    private boolean isFractureCode(String dc) {
        if (dc.startsWith("AT")) return true;
        return dc.length() >= 2 && dc.charAt(0) == 'S'
                && dc.charAt(1) >= '4' && dc.charAt(1) <= '9';
    }

    private boolean isBurnCode(String dc) {
        return dc.length() >= 2 && dc.charAt(0) == 'T'
                && (dc.charAt(1) == '2' || dc.charAt(1) == '3');
    }
}
