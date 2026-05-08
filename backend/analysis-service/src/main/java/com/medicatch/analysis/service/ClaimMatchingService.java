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
import java.util.stream.Collectors;

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

        // 지급 확정 건만 필터링 (날짜 범위 매칭에 사용)
        List<ClaimPaymentInfo> paidPayments = payments.stream()
                .filter(p -> "지급".equals(p.getJudgeResult()) && p.getOccurrenceDate() != null)
                .toList();

        List<ClaimOpportunityDto> result = new ArrayList<>();
        for (MedicalRecordInfo r : records)
            result.add(matchRecord(r, policies, paidPayments));
        return result;
    }

    /**
     * resReasonForPayment → 지급된 ClaimCategory 집합으로 파싱.
     * 예) "상해통원의료비(실손)" → {INJURY_OUTPATIENT, PHARMACY}
     *     "질병입원의료비"       → {DISEASE_INPATIENT}
     *     알 수 없는 사유        → {ALL}  (모든 유형에 해당)
     */
    private Set<ClaimCategory> parsePaymentCategories(String reason) {
        if (reason == null || reason.isBlank()) return Set.of(ClaimCategory.ALL);
        String lower = reason.toLowerCase();
        // 상해 통원: 병원 외래 + 약국(처방) 모두 포함
        if (lower.contains("상해") && (lower.contains("통원") || lower.contains("외래")))
            return Set.of(ClaimCategory.INJURY_OUTPATIENT, ClaimCategory.PHARMACY);
        if (lower.contains("상해") && lower.contains("입원"))
            return Set.of(ClaimCategory.INJURY_INPATIENT);
        // 질병 통원: 병원 외래 + 약국 포함
        if (lower.contains("질병") && (lower.contains("통원") || lower.contains("외래")))
            return Set.of(ClaimCategory.DISEASE_OUTPATIENT, ClaimCategory.PHARMACY);
        if (lower.contains("질병") && lower.contains("입원"))
            return Set.of(ClaimCategory.DISEASE_INPATIENT);
        if (lower.contains("처방") || lower.contains("조제"))
            return Set.of(ClaimCategory.PHARMACY);
        // 암, 뇌혈관 등 정액 지급
        if (lower.contains("암") || lower.contains("뇌혈관") || lower.contains("허혈")
                || lower.contains("골절") || lower.contains("화상"))
            return Set.of(ClaimCategory.LUMP_SUM);
        return Set.of(ClaimCategory.ALL);
    }

    // ── 레코드 1건 매핑 ──────────────────────────────────────────────────────

    private ClaimOpportunityDto matchRecord(MedicalRecordInfo record,
                                             List<PolicyInfo> policies,
                                             List<ClaimPaymentInfo> paidPayments) {

        String     diseaseCode    = resolveDiseaseCode(record);
        TreatClass tc             = classify(diseaseCode, record.getDepartment());
        String     treatType      = record.getTreatmentType();   // "외래" / "입원" / "약국"
        Double     outOfPocket    = record.getPatientPayment();
        Double     nonCovered     = record.getNonCoveredAmount();
        boolean    hasPublicCharge= record.getInsurancePayment() != null
                                    && record.getInsurancePayment() > 0;
        LocalDate  visitDate      = record.getVisitDate();

        // occurrenceDate ≤ visitDate ≤ paymentDate 범위에서 동일 카테고리 지급 건 탐색
        // 한 사고로 인한 여러 날짜 방문이 모두 동일 청구 건으로 처리될 수 있음
        ClaimCategory recCat = toClaimCategory(tc, treatType);
        ClaimPaymentInfo matchedPayment = null;
        if (visitDate != null) {
            for (ClaimPaymentInfo p : paidPayments) {
                if (visitDate.isBefore(p.getOccurrenceDate())) continue;
                if (p.getPaymentDate() != null && visitDate.isAfter(p.getPaymentDate())) continue;
                Set<ClaimCategory> cats = parsePaymentCategories(p.getReasonForPayment());
                if (cats.contains(ClaimCategory.ALL) || cats.contains(recCat)) {
                    matchedPayment = p;
                    break;
                }
            }
        }

        boolean isClaimed  = "CLAIMED".equals(record.getClaimStatus()) || matchedPayment != null;
        Double alreadyPaid = matchedPayment != null ? matchedPayment.getPaidAmount() : null;
        String paidCompany = matchedPayment != null ? matchedPayment.getCompanyName() : null;
        String claimGroupKey = matchedPayment != null
                ? matchedPayment.getCompanyName() + "_" + matchedPayment.getOccurrenceDate() : null;

        var builder = ClaimOpportunityDto.builder()
                .id(record.getId())
                .visitDate(visitDate)
                .hospitalName(record.getHospitalName())
                .treatmentType(treatType)
                .patientPayment(outOfPocket)
                .insurancePayment(record.getInsurancePayment())
                .totalCost(record.getTotalCost())
                .nonCoveredAmount(nonCovered)
                .alreadyPaidAmount(alreadyPaid)
                .paidByCompany(paidCompany)
                .claimGroupKey(claimGroupKey)
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
        // 급여 자기부담 + 세대별 비급여 보장 가능 금액
        double claimAmt = 0.0;
        if (claimable) {
            claimAmt = (outOfPocket != null ? outOfPocket : 0.0)
                     + eligibleNonCovered(nonCovered, best.gen, tc);
        }
        return builder
                .hasClaimOpportunity(claimable)
                .claimAmount(claimAmt)
                .claimInsurance(best.company)
                .matchedCoverage(best.coverageName)
                .confidenceLevel(best.confidence)
                .supplementaryGeneration(best.gen)
                .coverageNote(buildCoverageNote(best.note, nonCovered, best.gen, tc))
                .build();
    }

    /**
     * 세대별 비급여 보장 가능 금액.
     * 1세대: 100%, 2~3세대: 80%, 4세대: 70% (일부 제외), 5세대: 0% (급여전환 특약 한정)
     * 치과 비급여: 모든 세대 0% (이미 matchDental에서 EXCLUDED 처리됨)
     */
    private double eligibleNonCovered(Double nonCovered, int gen, TreatClass tc) {
        if (nonCovered == null || nonCovered <= 0) return 0.0;
        if (tc == TreatClass.DENTAL || tc == TreatClass.PHARMACY) return 0.0;
        return switch (gen) {
            case 1       -> nonCovered;
            case 2, 3    -> nonCovered * 0.8;
            case 4       -> nonCovered * 0.7;
            case 5       -> 0.0;
            default      -> nonCovered * 0.8;
        };
    }

    /** coverageNote에 비급여 정보 보충 */
    private String buildCoverageNote(String baseNote, Double nonCovered, int gen, TreatClass tc) {
        if (nonCovered == null || nonCovered <= 0 || tc == TreatClass.DENTAL || tc == TreatClass.PHARMACY)
            return baseNote;
        String ncInfo = switch (gen) {
            case 1    -> " · 비급여 전액 포함";
            case 2, 3 -> " · 비급여 20% 자기부담";
            case 4    -> " · 비급여 30% 자기부담";
            case 5    -> " · 비급여 미보장";
            default   -> "";
        };
        return baseNote != null ? baseNote + ncInfo : ncInfo.trim();
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
        // AK* = 치과 질병 코드 / AS* = 치과 상해 → TreatClass.INJURY로 분류되어 상해 항목에서 처리됨
        // 치과 질병: 1세대 완전 면책, 2세대 이후 급여 자기부담금만 보상 (비급여 제외)
        if (tc == TreatClass.DENTAL) {
            if (lower.contains("질병") && (lower.contains("통원") || lower.contains("입원")))
                return matchDentalDisease(company, itemName, hasPublicCharge, gen);
            return null; // 상해 커버리지는 AS*(INJURY)에서 처리
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

    // 상해 (AS코드/AT코드): 모든 세대에서 비급여 포함 보장. 5세대는 비급여 할증 적용.
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
     * 치과 질병 (AK*): 1세대 완전 면책, 2세대 이후 급여 자기부담금만 보상.
     * 비급여 치과 질병은 전 세대 제외.
     */
    private MatchResult matchDentalDisease(String company, String itemName,
                                            boolean hasPublicCharge, int gen) {
        if (gen == 1)
            return new MR(company, itemName, EXCLUDED, gen, gl(gen) + " · 치과 질병 면책");
        // 2세대 이후: 급여 자기부담금만 보상, 비급여 제외
        if (hasPublicCharge)
            return new MR(company, itemName, CONFIRMED, gen, gl(gen) + " · 치과 질병 급여만 보상");
        return new MR(company, itemName, EXCLUDED, gen, gl(gen) + " · 치과 질병 비급여 제외");
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

    /** resReasonForPayment → 파싱된 지급 분류 */
    private enum ClaimCategory {
        INJURY_OUTPATIENT,   // 상해 통원
        INJURY_INPATIENT,    // 상해 입원
        DISEASE_OUTPATIENT,  // 질병 통원
        DISEASE_INPATIENT,   // 질병 입원
        PHARMACY,            // 처방조제비
        LUMP_SUM,            // 정액 지급 (암/골절 등)
        ALL                  // 사유 불명 → 전체 해당
    }

    /** TreatClass + treatType → ClaimCategory 변환 */
    private ClaimCategory toClaimCategory(TreatClass tc, String treatType) {
        if (tc == TreatClass.PHARMACY) return ClaimCategory.PHARMACY;
        boolean inpatient = isInpatient(treatType);
        if (tc == TreatClass.INJURY)
            return inpatient ? ClaimCategory.INJURY_INPATIENT : ClaimCategory.INJURY_OUTPATIENT;
        // DISEASE, DENTAL, ORIENTAL 모두 질병 카테고리로 매핑
        return inpatient ? ClaimCategory.DISEASE_INPATIENT : ClaimCategory.DISEASE_OUTPATIENT;
    }

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
