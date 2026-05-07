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

/**
 * 진료 기록과 보험 보장 내역을 매핑하여 청구 가능 여부를 판단한다.
 *
 * 실손 세대 기준일:
 *   1세대: ~ 2009-09-30
 *   2세대: 2009-10-01 ~ 2012-12-31
 *   3세대: 2013-01-01 ~ 2017-03-31
 *   4세대: 2017-04-01 ~ 2021-06-30
 *   5세대: 2021-07-01 ~
 */
@Slf4j
@Service
public class ClaimMatchingService {

    private static final String CONFIRMED    = "CONFIRMED";
    private static final String LIKELY       = "LIKELY";
    private static final String CHECK_NEEDED = "CHECK_NEEDED";
    private static final String EXCLUDED     = "EXCLUDED";

    private static final LocalDate GEN2_START = LocalDate.of(2009, 10, 1);
    private static final LocalDate GEN3_START = LocalDate.of(2013,  1, 1);
    private static final LocalDate GEN4_START = LocalDate.of(2017,  4, 1);
    private static final LocalDate GEN5_START = LocalDate.of(2021,  7, 1);

    private final HealthServiceClient healthClient;
    private final InsuranceServiceClient insuranceClient;

    public ClaimMatchingService(HealthServiceClient healthClient,
                                InsuranceServiceClient insuranceClient) {
        this.healthClient = healthClient;
        this.insuranceClient = insuranceClient;
    }

    // ── 진입점 ──────────────────────────────────────────────────────────────

    public List<ClaimOpportunityDto> matchClaimOpportunities(Long userId) {
        List<MedicalRecordInfo> records   = safeFetch(() -> healthClient.getMedicalRecords(userId),
                "health-service 호출 실패");
        List<PolicyInfo>        policies  = safeFetch(() -> insuranceClient.getActivePolicies(userId),
                "insurance-service 정책 호출 실패");
        List<ClaimPaymentInfo>  payments  = safeFetch(() -> insuranceClient.getClaimPayments(userId),
                "insurance-service 지급내역 호출 실패");

        // 날짜별 지급 집계
        Map<LocalDate, Double> paidByDate    = new HashMap<>();
        Map<LocalDate, String> companyByDate = new HashMap<>();
        for (ClaimPaymentInfo p : payments) {
            if (!"지급".equals(p.getJudgeResult()) || p.getOccurrenceDate() == null) continue;
            double amt = p.getPaidAmount() != null ? p.getPaidAmount() : 0;
            paidByDate.merge(p.getOccurrenceDate(), amt, Double::sum);
            if (p.getCompanyName() != null)
                companyByDate.put(p.getOccurrenceDate(), p.getCompanyName());
        }

        List<ClaimOpportunityDto> result = new ArrayList<>();
        for (MedicalRecordInfo r : records)
            result.add(matchRecord(r, policies, paidByDate, companyByDate));
        return result;
    }

    // ── 레코드 1건 매핑 ──────────────────────────────────────────────────────

    private ClaimOpportunityDto matchRecord(MedicalRecordInfo record,
                                             List<PolicyInfo> policies,
                                             Map<LocalDate, Double> paidByDate,
                                             Map<LocalDate, String> companyByDate) {

        String     diseaseCode    = resolveDiseaseCode(record);
        TreatClass tc             = classify(diseaseCode, record.getDepartment());
        String     treatType      = record.getTreatmentType();   // "외래" / "입원" / "약국"
        Double     outOfPocket    = record.getPatientPayment();
        boolean    hasPublicCharge= record.getInsurancePayment() != null
                                    && record.getInsurancePayment() > 0;
        LocalDate  visitDate      = record.getVisitDate();

        Double alreadyPaid  = visitDate != null ? paidByDate.get(visitDate)    : null;
        String paidCompany  = visitDate != null ? companyByDate.get(visitDate) : null;
        boolean isClaimed   = "CLAIMED".equals(record.getClaimStatus())
                              || (alreadyPaid != null && alreadyPaid > 0);

        var builder = ClaimOpportunityDto.builder()
                .id(record.getId())
                .visitDate(visitDate)
                .hospitalName(record.getHospitalName())
                .treatmentType(treatType)
                .patientPayment(outOfPocket)
                .insurancePayment(record.getInsurancePayment())
                .totalCost(record.getTotalCost())
                .alreadyPaidAmount(alreadyPaid)
                .paidByCompany(paidCompany)
                .claimStatus(isClaimed ? "CLAIMED" : record.getClaimStatus());

        if (isClaimed)
            return builder.hasClaimOpportunity(false).claimAmount(0.0)
                          .confidenceLevel(CONFIRMED).build();

        if (outOfPocket == null || outOfPocket <= 0)
            return builder.hasClaimOpportunity(false).claimAmount(0.0)
                          .confidenceLevel(EXCLUDED).build();

        // 모든 활성 보험에서 최선 매칭
        MatchResult best = null;
        for (PolicyInfo p : policies) {
            MatchResult mr = tryMatchPolicy(p, tc, treatType, hasPublicCharge, diseaseCode);
            if (mr != null && rank(mr.confidence) > rank(best != null ? best.confidence : EXCLUDED))
                best = mr;
        }

        if (best == null || EXCLUDED.equals(best.confidence)) {
            return builder
                    .hasClaimOpportunity(false).claimAmount(0.0)
                    .confidenceLevel(best != null ? best.confidence : EXCLUDED)
                    .coverageNote(best != null ? best.note : null)
                    .supplementaryGeneration(best != null ? best.gen : 0)
                    .build();
        }

        boolean claimable = CONFIRMED.equals(best.confidence) || LIKELY.equals(best.confidence);
        return builder
                .hasClaimOpportunity(claimable)
                .claimAmount(claimable ? outOfPocket : 0.0)
                .claimInsurance(best.company)
                .matchedCoverage(best.coverageName)
                .confidenceLevel(best.confidence)
                .supplementaryGeneration(best.gen)
                .coverageNote(best.note)
                .build();
    }

    // ── 보험 정책 → 보장 항목 순회 ───────────────────────────────────────────

    private MatchResult tryMatchPolicy(PolicyInfo policy, TreatClass tc,
                                        String treatType, boolean hasPublicCharge,
                                        String diseaseCode) {
        if (policy.getCoverageItems() == null || !"ACTIVE".equals(policy.getContractStatus()))
            return null;

        int gen = detectGeneration(policy.getStartDate());
        MatchResult best = null;

        for (PolicyInfo.CoverageItemInfo item : policy.getCoverageItems()) {
            if (!item.isCovered()) continue;
            String itemName = item.getName() != null ? item.getName() : "";
            MatchResult mr  = tryMatchItem(policy.getCompanyName(), itemName,
                                           tc, treatType, hasPublicCharge, diseaseCode, gen);
            if (mr != null && rank(mr.confidence) > rank(best != null ? best.confidence : EXCLUDED))
                best = mr;
        }
        return best;
    }

    // ── 보장 항목 1건 매칭 ───────────────────────────────────────────────────

    private MatchResult tryMatchItem(String company, String itemName,
                                      TreatClass tc, String treatType,
                                      boolean hasPublicCharge, String diseaseCode,
                                      int gen) {
        String lower = itemName.toLowerCase();

        // ── 치과 ─────────────────────────────────────────────────────────
        if (tc == TreatClass.DENTAL && (lower.contains("질병") || lower.contains("상해"))) {
            return matchDental(company, itemName, hasPublicCharge, gen);
        }

        // ── 한방 ─────────────────────────────────────────────────────────
        if (tc == TreatClass.ORIENTAL && (lower.contains("질병") || lower.contains("상해"))) {
            return matchOriental(company, itemName, hasPublicCharge, gen, treatType);
        }

        // ── 실손 통원/입원 ────────────────────────────────────────────────
        if (lower.contains("상해") && lower.contains("통원")) {
            if (tc == TreatClass.INJURY && isOutpatient(treatType))
                return matchInjury(company, itemName, gen, false);
        }
        if (lower.contains("상해") && lower.contains("입원")) {
            if (tc == TreatClass.INJURY && isInpatient(treatType))
                return matchInjury(company, itemName, gen, true);
        }
        if (lower.contains("질병") && lower.contains("통원")) {
            if ((tc == TreatClass.DISEASE || tc == TreatClass.DENTAL || tc == TreatClass.ORIENTAL)
                    && isOutpatient(treatType))
                return matchDisease(company, itemName, hasPublicCharge, gen, false);
        }
        if (lower.contains("질병") && lower.contains("입원")) {
            if ((tc == TreatClass.DISEASE || tc == TreatClass.DENTAL || tc == TreatClass.ORIENTAL)
                    && isInpatient(treatType))
                return matchDisease(company, itemName, hasPublicCharge, gen, true);
        }

        // ── 처방약 ────────────────────────────────────────────────────────
        if (lower.contains("처방") || (lower.contains("약") && !lower.contains("의약"))) {
            if (tc == TreatClass.PHARMACY)
                return new MR(company, itemName, CONFIRMED, gen,
                        gl(gen) + " · 처방약 보장");
        }

        // ── 정액 (진단코드 직접 매핑) ─────────────────────────────────────
        if (diseaseCode != null) {
            if (lower.contains("화상") && diseaseCode.startsWith("AT"))
                return new MR(company, itemName, CONFIRMED, 0, "화상진단 정액 보장");
            if (lower.contains("암") && diseaseCode.startsWith("C"))
                return new MR(company, itemName, CONFIRMED, 0, "암진단 정액 보장");
            if ((lower.contains("뇌혈관") || lower.contains("뇌졸중")) && diseaseCode.startsWith("I6"))
                return new MR(company, itemName, CONFIRMED, 0, "뇌혈관질환 정액 보장");
            if ((lower.contains("허혈") || lower.contains("심근경색")) && diseaseCode.startsWith("I2"))
                return new MR(company, itemName, CONFIRMED, 0, "허혈성심장질환 정액 보장");
            if (lower.contains("골절") && (tc == TreatClass.INJURY || diseaseCode.startsWith("S")))
                return new MR(company, itemName, LIKELY, 0, "골절진단 정액 (약관 확인)");
            if (lower.contains("질병") && lower.contains("입원") && lower.contains("일당")
                    && tc == TreatClass.DISEASE && isInpatient(treatType))
                return new MR(company, itemName, CONFIRMED, gen, gl(gen) + " · 질병입원일당");
            if (lower.contains("상해") && lower.contains("입원") && lower.contains("일당")
                    && tc == TreatClass.INJURY && isInpatient(treatType))
                return new MR(company, itemName, CONFIRMED, gen, gl(gen) + " · 상해입원일당");
        }

        return null;
    }

    // ── 분류별 보장 규칙 ─────────────────────────────────────────────────────

    /**
     * 상해 (AS*/AT*): 모든 세대에서 비급여 포함 보장.
     * 5세대는 비급여 할증이 있지만 기본 보장은 유지.
     */
    private MatchResult matchInjury(String company, String itemName, int gen, boolean inpatient) {
        String place = inpatient ? "입원" : "통원";
        return switch (gen) {
            case 1, 2, 3 -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 상해 " + place + " 급여+비급여 보장");
            case 4       -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 상해 " + place + " 보장 (비급여 30% 자기부담)");
            case 5       -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 상해 " + place + " 보장 (비급여 할증 적용)");
            default      -> new MR(company, itemName, LIKELY, gen, gl(gen) + " · 상해 보장 확인");
        };
    }

    /**
     * 질병 (일반): 급여는 전 세대 CONFIRMED.
     * 비급여는 세대가 높을수록 자기부담 증가 및 제한.
     */
    private MatchResult matchDisease(String company, String itemName,
                                      boolean hasPublicCharge, int gen, boolean inpatient) {
        String place = inpatient ? "입원" : "통원";
        if (hasPublicCharge) {
            // 급여: 전 세대 보장
            return new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 질병 " + place + " 급여 보장");
        }
        // 비급여
        return switch (gen) {
            case 1, 2, 3 -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 질병 " + place + " 급여+비급여 보장");
            case 4       -> new MR(company, itemName, LIKELY, gen,
                    gl(gen) + " · 비급여 30% 자기부담 (도수치료 등 특약 확인)");
            case 5       -> new MR(company, itemName, CHECK_NEEDED, gen,
                    gl(gen) + " · 비급여 할증제 적용 · 보험사 확인 권장");
            default      -> new MR(company, itemName, LIKELY, gen, gl(gen) + " · 약관 확인");
        };
    }

    /**
     * 치과 (AK*): 세대별 급여/비급여 보장 여부 상이.
     */
    private MatchResult matchDental(String company, String itemName,
                                     boolean hasPublicCharge, int gen) {
        if (hasPublicCharge) {
            // 급여 치과
            return switch (gen) {
                case 1       -> new MR(company, itemName, CONFIRMED, gen,
                        gl(gen) + " · 치과 급여 보장");
                case 2, 3    -> new MR(company, itemName, LIKELY, gen,
                        gl(gen) + " · 치과 급여 보장 가능 (약관 확인)");
                case 4       -> new MR(company, itemName, CHECK_NEEDED, gen,
                        gl(gen) + " · 치과 급여 보장 여부 보험사 확인");
                case 5       -> new MR(company, itemName, EXCLUDED, gen,
                        gl(gen) + " · 치과 보장 제외");
                default      -> new MR(company, itemName, CHECK_NEEDED, gen,
                        gl(gen) + " · 치과 약관 확인");
            };
        } else {
            // 비급여 치과
            return switch (gen) {
                case 1       -> new MR(company, itemName, LIKELY, gen,
                        gl(gen) + " · 치과 비급여 일부 보장 가능");
                case 2       -> new MR(company, itemName, CHECK_NEEDED, gen,
                        gl(gen) + " · 치과 비급여 약관 확인");
                case 3, 4, 5 -> new MR(company, itemName, EXCLUDED, gen,
                        gl(gen) + " · 치과 비급여 제외");
                default      -> null;
            };
        }
    }

    /**
     * 한방 (oriental medicine, department 기준 분류):
     * 세대가 높을수록 한방 비급여 보장 축소.
     */
    private MatchResult matchOriental(String company, String itemName,
                                       boolean hasPublicCharge, int gen, String treatType) {
        String place = isInpatient(treatType) ? "입원" : "통원";
        if (hasPublicCharge) {
            // 급여 한방: 전 세대 기본 보장
            return new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 한방 " + place + " 급여 보장");
        }
        // 비급여 한방
        return switch (gen) {
            case 1       -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 한방 비급여 포함 보장");
            case 2, 3    -> new MR(company, itemName, LIKELY, gen,
                    gl(gen) + " · 한방 비급여 약관 확인");
            case 4, 5    -> new MR(company, itemName, EXCLUDED, gen,
                    gl(gen) + " · 한방 비급여 제외");
            default      -> new MR(company, itemName, CHECK_NEEDED, gen,
                    gl(gen) + " · 한방 약관 확인");
        };
    }

    // ── 세대 판별 ────────────────────────────────────────────────────────────

    /** 실손보험 세대 판별 (가입일 기준) */
    private int detectGeneration(LocalDate startDate) {
        if (startDate == null) return 0;
        if (startDate.isBefore(GEN2_START)) return 1;
        if (startDate.isBefore(GEN3_START)) return 2;
        if (startDate.isBefore(GEN4_START)) return 3;
        if (startDate.isBefore(GEN5_START)) return 4;
        return 5;
    }

    /** 세대 레이블 */
    private String gl(int gen) {
        return gen > 0 ? gen + "세대 실손" : "실손";
    }

    // ── 분류 ────────────────────────────────────────────────────────────────

    private TreatClass classify(String code, String department) {
        if ("$".equals(code)) return TreatClass.PHARMACY;
        String upper = code != null ? code.toUpperCase() : "";
        if (upper.startsWith("AK")) return TreatClass.DENTAL;
        if (upper.startsWith("AS") || upper.startsWith("AT")) return TreatClass.INJURY;
        if (department != null && (department.contains("한방") || department.contains("침구")))
            return TreatClass.ORIENTAL;
        return TreatClass.DISEASE;
    }

    private boolean isOutpatient(String t) { return "외래".equals(t) || "약국".equals(t); }
    private boolean isInpatient(String t)  { return "입원".equals(t); }

    private int rank(String c) {
        return switch (c) {
            case CONFIRMED    -> 3;
            case LIKELY       -> 2;
            case CHECK_NEEDED -> 1;
            default           -> 0;
        };
    }

    // ── 유틸 ─────────────────────────────────────────────────────────────────

    private String resolveDiseaseCode(MedicalRecordInfo record) {
        if (record.getDiseaseCode() != null && !record.getDiseaseCode().isBlank())
            return record.getDiseaseCode();
        if (record.getNotes() != null) {
            int idx = record.getNotes().indexOf("진단코드: ");
            if (idx >= 0) {
                String code = record.getNotes().substring(idx + 6).trim().split("\\s")[0];
                if (!code.isBlank() && !"-".equals(code)) return code;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> safeFetch(java.util.function.Supplier<List<T>> fn, String msg) {
        try { return fn.get(); }
        catch (Exception e) { log.warn("{}: {}", msg, e.getMessage()); return List.of(); }
    }

    // ── 내부 타입 ─────────────────────────────────────────────────────────────

    private enum TreatClass { DISEASE, INJURY, DENTAL, PHARMACY, ORIENTAL }

    /** MatchResult 축약형 */
    private static class MR extends MatchResult {
        MR(String c, String cn, String conf, int gen, String note) {
            super(c, cn, conf, gen, note);
        }
    }

    private static class MatchResult {
        final String company;
        final String coverageName;
        final String confidence;
        final int    gen;
        final String note;

        MatchResult(String company, String coverageName, String confidence,
                    int gen, String note) {
            this.company      = company;
            this.coverageName = coverageName;
            this.confidence   = confidence;
            this.gen          = gen;
            this.note         = note;
        }
    }
}
