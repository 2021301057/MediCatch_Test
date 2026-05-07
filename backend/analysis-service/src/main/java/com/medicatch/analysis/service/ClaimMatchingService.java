package com.medicatch.analysis.service;

import com.medicatch.analysis.client.HealthServiceClient;
import com.medicatch.analysis.client.InsuranceServiceClient;
import com.medicatch.analysis.dto.ClaimOpportunityDto;
import com.medicatch.analysis.dto.ClaimPaymentInfo;
import com.medicatch.analysis.dto.MedicalRecordInfo;
import com.medicatch.analysis.dto.PolicyInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
public class ClaimMatchingService {

    private static final String CONFIRMED    = "CONFIRMED";
    private static final String LIKELY       = "LIKELY";
    private static final String CHECK_NEEDED = "CHECK_NEEDED";
    private static final String EXCLUDED     = "EXCLUDED";

    private final HealthServiceClient healthClient;
    private final InsuranceServiceClient insuranceClient;

    public ClaimMatchingService(HealthServiceClient healthClient,
                                InsuranceServiceClient insuranceClient) {
        this.healthClient = healthClient;
        this.insuranceClient = insuranceClient;
    }

    public List<ClaimOpportunityDto> matchClaimOpportunities(Long userId) {
        List<MedicalRecordInfo> records;
        List<PolicyInfo> policies;
        List<ClaimPaymentInfo> payments;

        try {
            records = healthClient.getMedicalRecords(userId);
        } catch (Exception e) {
            log.warn("health-service 호출 실패 (userId: {}): {}", userId, e.getMessage());
            records = List.of();
        }
        try {
            policies = insuranceClient.getActivePolicies(userId);
        } catch (Exception e) {
            log.warn("insurance-service 정책 호출 실패 (userId: {}): {}", userId, e.getMessage());
            policies = List.of();
        }
        try {
            payments = insuranceClient.getClaimPayments(userId);
        } catch (Exception e) {
            log.warn("insurance-service 지급내역 호출 실패 (userId: {}): {}", userId, e.getMessage());
            payments = List.of();
        }

        Set<LocalDate> claimedDates = buildClaimedDates(payments);
        List<ClaimOpportunityDto> result = new ArrayList<>();

        for (MedicalRecordInfo record : records) {
            ClaimOpportunityDto dto = matchRecord(record, policies, claimedDates);
            result.add(dto);
        }

        return result;
    }

    private Set<LocalDate> buildClaimedDates(List<ClaimPaymentInfo> payments) {
        Set<LocalDate> dates = new HashSet<>();
        for (ClaimPaymentInfo p : payments) {
            if ("지급".equals(p.getJudgeResult()) && p.getOccurrenceDate() != null) {
                dates.add(p.getOccurrenceDate());
            }
        }
        return dates;
    }

    private ClaimOpportunityDto matchRecord(MedicalRecordInfo record,
                                             List<PolicyInfo> policies,
                                             Set<LocalDate> claimedDates) {
        String diseaseCode = resolveDiseaseCode(record);
        DiseaseClass dc = classify(diseaseCode);
        String treatType = record.getTreatmentType();  // "외래", "입원", "약국"
        Double outOfPocket = record.getPatientPayment();
        boolean hasPublicCharge = record.getInsurancePayment() != null && record.getInsurancePayment() > 0;

        boolean alreadyClaimed = "CLAIMED".equals(record.getClaimStatus())
                || (record.getVisitDate() != null && claimedDates.contains(record.getVisitDate()));

        ClaimOpportunityDto.ClaimOpportunityDtoBuilder builder = ClaimOpportunityDto.builder()
                .id(record.getId())
                .visitDate(record.getVisitDate())
                .hospitalName(record.getHospitalName())
                .treatmentType(treatType)
                .patientPayment(outOfPocket)
                .insurancePayment(record.getInsurancePayment())
                .totalCost(record.getTotalCost())
                .claimStatus(alreadyClaimed ? "CLAIMED" : record.getClaimStatus());

        if (alreadyClaimed) {
            return builder
                    .hasClaimOpportunity(false)
                    .claimAmount(0.0)
                    .confidenceLevel(CONFIRMED)
                    .build();
        }

        if (outOfPocket == null || outOfPocket <= 0) {
            return builder
                    .hasClaimOpportunity(false)
                    .claimAmount(0.0)
                    .confidenceLevel(EXCLUDED)
                    .build();
        }

        // Try to find a matching coverage
        MatchResult best = null;
        for (PolicyInfo policy : policies) {
            MatchResult mr = tryMatchPolicy(policy, dc, treatType, hasPublicCharge, diseaseCode);
            if (mr != null) {
                if (best == null || confidenceRank(mr.confidence) > confidenceRank(best.confidence)) {
                    best = mr;
                }
            }
        }

        if (best == null || best.confidence.equals(EXCLUDED)) {
            return builder
                    .hasClaimOpportunity(false)
                    .claimAmount(0.0)
                    .confidenceLevel(best != null ? best.confidence : EXCLUDED)
                    .build();
        }

        return builder
                .hasClaimOpportunity(true)
                .claimAmount(outOfPocket)
                .claimInsurance(best.companyName)
                .matchedCoverage(best.coverageName)
                .confidenceLevel(best.confidence)
                .build();
    }

    private MatchResult tryMatchPolicy(PolicyInfo policy, DiseaseClass dc,
                                        String treatType, boolean hasPublicCharge,
                                        String diseaseCode) {
        if (policy.getCoverageItems() == null || !"ACTIVE".equals(policy.getContractStatus())) return null;

        MatchResult best = null;

        for (PolicyInfo.CoverageItemInfo item : policy.getCoverageItems()) {
            if (!item.isCovered()) continue;

            String itemName = item.getName() != null ? item.getName() : "";
            String confidence = tryMatchItem(itemName, dc, treatType, hasPublicCharge, diseaseCode);

            if (confidence != null && !confidence.equals(EXCLUDED)) {
                MatchResult mr = new MatchResult(policy.getCompanyName(), itemName, confidence);
                if (best == null || confidenceRank(mr.confidence) > confidenceRank(best.confidence)) {
                    best = mr;
                }
            }
        }

        return best;
    }

    private String tryMatchItem(String itemName, DiseaseClass dc, String treatType,
                                 boolean hasPublicCharge, String diseaseCode) {
        String lower = itemName.toLowerCase();

        // ── 실손 items (no resAgreementType → conditions is null, itemName-based matching) ──
        if (lower.contains("상해") && lower.contains("통원")) {
            if (dc == DiseaseClass.INJURY && isOutpatient(treatType)) return CONFIRMED;
        }
        if (lower.contains("상해") && lower.contains("입원")) {
            if (dc == DiseaseClass.INJURY && isInpatient(treatType)) return CONFIRMED;
        }
        if (lower.contains("질병") && lower.contains("통원")) {
            if (dc == DiseaseClass.DISEASE && isOutpatient(treatType)) {
                return hasPublicCharge ? CONFIRMED : LIKELY;
            }
        }
        if (lower.contains("질병") && lower.contains("입원")) {
            if (dc == DiseaseClass.DISEASE && isInpatient(treatType)) {
                return hasPublicCharge ? CONFIRMED : LIKELY;
            }
        }
        if (lower.contains("처방") || (lower.contains("약") && !lower.contains("의약"))) {
            if (dc == DiseaseClass.PHARMACY) return CONFIRMED;
        }

        // 치과 실손: 급여 치과는 CHECK_NEEDED, 비급여 치과는 제외
        if (dc == DiseaseClass.DENTAL) {
            if (lower.contains("질병") || lower.contains("상해")) {
                return hasPublicCharge ? CHECK_NEEDED : null;
            }
        }

        // ── 정액 items (conditions-based via itemName keywords for 정액 상품명) ──
        if (diseaseCode != null) {
            // 화상진단: AT 코드
            if (lower.contains("화상") && diseaseCode.startsWith("AT")) return CONFIRMED;
            // 암진단: C 코드
            if (lower.contains("암") && diseaseCode.startsWith("C")) return CONFIRMED;
            // 뇌혈관질환: I6 코드
            if ((lower.contains("뇌혈관") || lower.contains("뇌졸중")) && diseaseCode.startsWith("I6")) return CONFIRMED;
            // 허혈성심장질환: I2 코드
            if ((lower.contains("허혈") || lower.contains("심근경색")) && diseaseCode.startsWith("I2")) return CONFIRMED;
            // 질병입원일당: 질병 + 입원
            if (lower.contains("질병") && lower.contains("입원") && lower.contains("일당")) {
                if (dc == DiseaseClass.DISEASE && isInpatient(treatType)) return CONFIRMED;
            }
            // 상해입원일당: 상해 + 입원
            if (lower.contains("상해") && lower.contains("입원") && lower.contains("일당")) {
                if (dc == DiseaseClass.INJURY && isInpatient(treatType)) return CONFIRMED;
            }
            // 골절진단 (S 코드 상해 계열)
            if (lower.contains("골절") && (dc == DiseaseClass.INJURY || diseaseCode.startsWith("S"))) return LIKELY;
        }

        return null;
    }

    private boolean isOutpatient(String treatType) {
        return "외래".equals(treatType) || "약국".equals(treatType);
    }

    private boolean isInpatient(String treatType) {
        return "입원".equals(treatType);
    }

    private int confidenceRank(String confidence) {
        return switch (confidence) {
            case CONFIRMED    -> 3;
            case LIKELY       -> 2;
            case CHECK_NEEDED -> 1;
            default           -> 0;
        };
    }

    private String resolveDiseaseCode(MedicalRecordInfo record) {
        if (record.getDiseaseCode() != null && !record.getDiseaseCode().isBlank()) {
            return record.getDiseaseCode();
        }
        // Legacy fallback: parse "진단코드: XXX" from notes field
        if (record.getNotes() != null) {
            String notes = record.getNotes();
            int idx = notes.indexOf("진단코드: ");
            if (idx >= 0) {
                String code = notes.substring(idx + 6).trim().split("\\s")[0];
                if (!code.isBlank() && !"-".equals(code)) return code;
            }
        }
        return null;
    }

    private DiseaseClass classify(String code) {
        if (code == null || code.isBlank()) return DiseaseClass.DISEASE;
        if (code.equals("$")) return DiseaseClass.PHARMACY;
        String upper = code.toUpperCase();
        if (upper.startsWith("AK")) return DiseaseClass.DENTAL;
        if (upper.startsWith("AS") || upper.startsWith("AT")) return DiseaseClass.INJURY;
        return DiseaseClass.DISEASE;
    }

    private enum DiseaseClass {
        DISEASE, INJURY, DENTAL, PHARMACY
    }

    private static class MatchResult {
        final String companyName;
        final String coverageName;
        final String confidence;

        MatchResult(String companyName, String coverageName, String confidence) {
            this.companyName = companyName;
            this.coverageName = coverageName;
            this.confidence = confidence;
        }
    }
}
