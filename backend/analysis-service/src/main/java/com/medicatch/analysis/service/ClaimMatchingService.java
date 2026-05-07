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

        List<PolicyInfo> activePolicies = policies;
        return records.stream()
                .map(r -> buildOpportunity(r, activePolicies))
                .sorted(Comparator.comparing(ClaimOpportunityDto::getVisitDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    private ClaimOpportunityDto buildOpportunity(MedicalRecordInfo record, List<PolicyInfo> policies) {
        boolean hasCost = record.getPatientPayment() != null && record.getPatientPayment() > 0;
        List<MatchedPolicyDto> matched = hasCost ? matchPolicies(record, policies) : List.of();

        boolean hasOpportunity = !matched.isEmpty();
        double claimAmount = matched.stream()
                .mapToDouble(m -> m.getEstimatedAmount() != null ? m.getEstimatedAmount() : 0)
                .sum();
        if (claimAmount == 0 && hasCost) claimAmount = record.getPatientPayment();

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
                .hasClaimOpportunity(hasOpportunity)
                .claimAmount(hasOpportunity ? claimAmount : 0.0)
                .claimInsurance(claimInsurance)
                .matchedPolicies(matched)
                .build();
    }

    private List<MatchedPolicyDto> matchPolicies(MedicalRecordInfo record, List<PolicyInfo> policies) {
        List<MatchedPolicyDto> result = new ArrayList<>();
        for (PolicyInfo policy : policies) {
            if (!"ACTIVE".equals(policy.getContractStatus())) continue;

            // 실손(supplementary) matching
            if (policy.isHasSupplementaryCoverage()) {
                String matchedItem = findSupplementaryMatch(record, policy);
                if (matchedItem != null) {
                    result.add(MatchedPolicyDto.builder()
                            .policyId(policy.getId())
                            .policyName(policy.getProductName())
                            .companyName(policy.getCompanyName())
                            .coverageType("실손")
                            .estimatedAmount(record.getPatientPayment())
                            .coverageItemName(matchedItem)
                            .build());
                }
            }

            // 정액(lump-sum) matching via disease code
            if (policy.getCoverageItems() == null) continue;
            for (CoverageItemInfo item : policy.getCoverageItems()) {
                if (!item.isCovered() || item.getAgreementType() == null) continue;
                if (matchesDiagnosisCondition(record.getDiseaseCode(), item.getAgreementType())) {
                    result.add(MatchedPolicyDto.builder()
                            .policyId(policy.getId())
                            .policyName(policy.getProductName())
                            .companyName(policy.getCompanyName())
                            .coverageType("정액")
                            .estimatedAmount(item.getAmount())
                            .coverageItemName(item.getName())
                            .build());
                }
            }
        }
        return result;
    }

    private String findSupplementaryMatch(MedicalRecordInfo record, PolicyInfo policy) {
        String treatType = record.getTreatmentType();
        if (treatType == null || policy.getCoverageItems() == null) return null;

        for (CoverageItemInfo item : policy.getCoverageItems()) {
            if (!item.isCovered() || item.getCategory() == null) continue;
            String cat = item.getCategory();
            if (isOutpatient(treatType) && "OUTPATIENT".equals(cat)) return item.getName();
            if (isInpatient(treatType) && "INPATIENT".equals(cat)) return item.getName();
            if (isPharmacy(treatType) && "MEDICATION".equals(cat)) return item.getName();
        }
        // fallback: any covered item if treatType unmapped
        return policy.getCoverageItems().stream()
                .filter(CoverageItemInfo::isCovered)
                .map(CoverageItemInfo::getName)
                .findFirst()
                .orElse("실손의료비");
    }

    private boolean isOutpatient(String t) {
        return t.contains("외래") || t.contains("통원") || t.equals("2");
    }

    private boolean isInpatient(String t) {
        return t.contains("입원") || t.equals("1");
    }

    private boolean isPharmacy(String t) {
        return t.contains("약국") || t.equals("3");
    }

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
        // S40–S99: fractures/injuries; AT* used in CODEF demo
        if (dc.startsWith("AT")) return true;
        if (dc.length() >= 2 && dc.charAt(0) == 'S') {
            char second = dc.charAt(1);
            return second >= '4' && second <= '9';
        }
        return false;
    }

    private boolean isBurnCode(String dc) {
        // T20–T32: burns
        if (dc.length() >= 2 && dc.charAt(0) == 'T') {
            char second = dc.charAt(1);
            return second == '2' || second == '3';
        }
        return false;
    }
}
