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
 * 실손 세대 코드:
 *   "1d" = 1세대 손보 (~2009.09): 급여 100%, 비급여 100%
 *   "1h" = 1세대 생보 (~2009.09): 급여 80%, 비급여 100%
 *   "2"  = 2세대 (2009.10~2017.03)
 *   "3"  = 3세대 표준 (2017.04~2021.06)
 *   "3k" = 3세대 착한실손 (2017.04~2021.06)
 *   "4"  = 4세대 (2021.07~현재)
 */
@Slf4j
@Service
public class ClaimMatchingService {

    private static final String CONFIRMED    = "CONFIRMED";
    private static final String LIKELY       = "LIKELY";
    private static final String CHECK_NEEDED = "CHECK_NEEDED";
    private static final String EXCLUDED     = "EXCLUDED";

    // 실손보험 세대 기준일 (업계 표준 4세대 체계)
    private static final LocalDate GEN2_START = LocalDate.of(2009, 10, 1);
    private static final LocalDate GEN3_START = LocalDate.of(2017,  4, 1);
    private static final LocalDate GEN4_START = LocalDate.of(2021,  7, 1);

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
        if (lower.contains("상해") && (lower.contains("통원") || lower.contains("외래")))
            return Set.of(ClaimCategory.INJURY_OUTPATIENT, ClaimCategory.PHARMACY);
        if (lower.contains("상해") && lower.contains("입원"))
            return Set.of(ClaimCategory.INJURY_INPATIENT);
        if (lower.contains("질병") && (lower.contains("통원") || lower.contains("외래")))
            return Set.of(ClaimCategory.DISEASE_OUTPATIENT, ClaimCategory.PHARMACY);
        if (lower.contains("질병") && lower.contains("입원"))
            return Set.of(ClaimCategory.DISEASE_INPATIENT);
        if (lower.contains("처방") || lower.contains("조제"))
            return Set.of(ClaimCategory.PHARMACY);
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
        TreatClass tc             = classify(diseaseCode, record.getDiagnosis());
        String     treatType      = record.getTreatmentType();
        Double     outOfPocket    = record.getPatientPayment();
        Double     nonCovered     = record.getNonCoveredAmount();
        boolean    hasPublicCharge= record.getInsurancePayment() != null
                                    && record.getInsurancePayment() > 0;
        LocalDate  visitDate      = record.getVisitDate();

        // occurrenceDate ≤ visitDate ≤ paymentDate 범위에서 동일 카테고리 지급 건 탐색
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
            MatchResult mr = tryMatchPolicy(p, tc, treatType, hasPublicCharge, diseaseCode, visitDate);
            if (mr != null && rank(mr.confidence) > rank(best != null ? best.confidence : EXCLUDED))
                best = mr;
        }
        String gen = best != null ? best.gen : null;

        if (best == null || EXCLUDED.equals(best.confidence)) {
            return builder
                    .hasClaimOpportunity(false).claimAmount(0.0)
                    .confidenceLevel(best != null ? best.confidence : EXCLUDED)
                    .coverageNote(best != null ? best.note : null)
                    .supplementaryGeneration(gen)
                    .build();
        }

        boolean claimable = CONFIRMED.equals(best.confidence) || LIKELY.equals(best.confidence);
        double claimAmt = 0.0;
        if (claimable) {
            double publicCharge = outOfPocket != null ? outOfPocket : 0.0;
            double nonCoveredExpense = eligibleNonCoveredExpense(nonCovered, tc);
            claimAmt = calculateClaimAmount(publicCharge, nonCoveredExpense, gen, treatType);
        }
        return builder
                .hasClaimOpportunity(claimable)
                .claimAmount(claimAmt)
                .claimInsurance(best.company)
                .matchedCoverage(best.coverageName)
                .confidenceLevel(best.confidence)
                .supplementaryGeneration(gen)
                .coverageNote(buildCoverageNote(best.note, nonCovered, gen, tc))
                .build();
    }

    /**
     * 세대별 비급여 보장 가능 금액.
     * 1d/1h: 비급여 100%, 2/3세대: 80%, 3k/4세대: 70%
     */
    private double eligibleNonCovered(Double nonCovered, String gen, TreatClass tc) {
        double expense = eligibleNonCoveredExpense(nonCovered, tc);
        return expense * (1 - nonCoveredSelfPayRatio(gen));
    }

    private double eligibleNonCoveredExpense(Double nonCovered, TreatClass tc) {
        if (nonCovered == null || nonCovered <= 0) return 0.0;
        if (tc == TreatClass.DENTAL || tc == TreatClass.PHARMACY) return 0.0;
        return nonCovered;
    }

    /**
     * 세대별 급여 자기부담금 보상 비율.
     * 1d: 100%, 1h: 80%(생보 특성), 2세대: 90%, 3/3k/4세대: 80%
     */
    private double publicChargeRatio(String gen) {
        return switch (gen != null ? gen : "") {
            case "1d"           -> 1.0;
            case "1h"           -> 0.8;
            case "2"            -> 0.9;
            case "3", "3k", "4" -> 0.8;
            default             -> 1.0;
        };
    }

    private double calculateClaimAmount(double publicCharge, double nonCoveredExpense,
                                        String gen, String treatType) {
        if (!isOutpatient(treatType)) {
            return publicCharge * publicChargeRatio(gen)
                    + nonCoveredExpense * (1 - nonCoveredSelfPayRatio(gen));
        }

        double medicalExpense = publicCharge + nonCoveredExpense;
        if (medicalExpense <= 0) return 0.0;

        double fixedDeductible = outpatientFixedDeductible(gen, nonCoveredExpense);
        if (isFirstGeneration(gen)) {
            return Math.max(0.0, medicalExpense - fixedDeductible);
        }

        double selfPayAmount = publicCharge * publicSelfPayRatio(gen)
                + nonCoveredExpense * nonCoveredSelfPayRatio(gen);
        return Math.max(0.0, medicalExpense - Math.max(fixedDeductible, selfPayAmount));
    }

    private boolean isFirstGeneration(String gen) {
        return "1d".equals(gen) || "1h".equals(gen);
    }

    private double outpatientFixedDeductible(String gen, double nonCoveredExpense) {
        return switch (gen != null ? gen : "") {
            case "1d", "1h" -> 5000.0;
            case "4" -> nonCoveredExpense > 0 ? 30000.0 : 10000.0;
            case "2", "3", "3k" -> 10000.0;
            default -> 10000.0;
        };
    }

    private double publicSelfPayRatio(String gen) {
        return 1 - publicChargeRatio(gen);
    }

    private double nonCoveredSelfPayRatio(String gen) {
        return switch (gen != null ? gen : "") {
            case "1d", "1h" -> 0.0;
            case "2", "3" -> 0.2;
            case "3k", "4" -> 0.3;
            default -> 0.2;
        };
    }

    /** coverageNote에 비급여 정보 보충 */
    private String buildCoverageNote(String baseNote, Double nonCovered, String gen, TreatClass tc) {
        if (nonCovered == null || nonCovered <= 0 || tc == TreatClass.DENTAL || tc == TreatClass.PHARMACY)
            return baseNote;
        String ncInfo = switch (gen != null ? gen : "") {
            case "1d"       -> " · 비급여 전액 포함";
            case "1h"       -> " · 급여 80% · 비급여 전액 포함";
            case "2", "3"   -> " · 비급여 20% 자기부담";
            case "3k"       -> " · 비급여 특약 30% 자기부담";
            case "4"        -> " · 비급여 30% 자기부담";
            default         -> "";
        };
        return baseNote != null ? baseNote + ncInfo : ncInfo.trim();
    }

    // ── 보험 정책 → 보장 항목 순회 ───────────────────────────────────────────

    private MatchResult tryMatchPolicy(PolicyInfo policy, TreatClass tc,
                                        String treatType, boolean hasPublicCharge,
                                        String diseaseCode, LocalDate visitDate) {
        if (policy.getCoverageItems() == null || !"ACTIVE".equals(policy.getContractStatus()))
            return null;

        // 방문일이 보험 유효기간 밖이면 제외
        if (visitDate != null) {
            if (policy.getStartDate() != null && visitDate.isBefore(policy.getStartDate()))
                return null;
            if (policy.getEndDate() != null && visitDate.isAfter(policy.getEndDate()))
                return null;
        }

        String gen = detectGeneration(policy);
        boolean isSuppl = policy.isHasSupplementaryCoverage();
        MatchResult best = null;

        for (PolicyInfo.CoverageItemInfo item : policy.getCoverageItems()) {
            if (!item.isCovered()) continue;
            String itemName = item.getName() != null ? item.getName() : "";
            MatchResult mr  = tryMatchItem(policy.getCompanyName(), itemName,
                                           tc, treatType, hasPublicCharge, diseaseCode, gen, isSuppl);
            if (mr != null && rank(mr.confidence) > rank(best != null ? best.confidence : EXCLUDED))
                best = mr;
        }
        return best;
    }

    // ── 보장 항목 1건 매칭 ───────────────────────────────────────────────────

    private MatchResult tryMatchItem(String company, String itemName,
                                      TreatClass tc, String treatType,
                                      boolean hasPublicCharge, String diseaseCode,
                                      String gen, boolean isSuppl) {
        String lower = itemName.toLowerCase();

        // ── 치과 ─────────────────────────────────────────────────────────
        // AK* = 치과 질병 코드: 1세대 완전 면책, 2세대+ 급여만 보상
        // AS* = 치과 상해 → TreatClass.INJURY로 분류되어 상해 항목에서 처리됨
        if (tc == TreatClass.DENTAL) {
            if (!isSuppl) return null;
            if (lower.contains("질병") && (lower.contains("통원") || lower.contains("입원")))
                return matchDentalDisease(company, itemName, hasPublicCharge, gen);
            return null;
        }

        // ── 한방 ─────────────────────────────────────────────────────────
        if (tc == TreatClass.ORIENTAL && (lower.contains("질병") || lower.contains("상해"))) {
            if (!isSuppl) return null;
            return matchOriental(company, itemName, hasPublicCharge, gen, treatType);
        }

        // ── 실손 통원/입원 ────────────────────────────────────────────────
        if (lower.contains("상해") && lower.contains("통원")) {
            if (tc == TreatClass.INJURY && isOutpatient(treatType))
                return isSuppl ? matchInjury(company, itemName, gen, false) : null;
        }
        if (lower.contains("상해") && lower.contains("입원")) {
            if (tc == TreatClass.INJURY && isInpatient(treatType))
                return isSuppl ? matchInjury(company, itemName, gen, true) : null;
        }
        if (lower.contains("질병") && lower.contains("통원")) {
            if ((tc == TreatClass.DISEASE || tc == TreatClass.DENTAL || tc == TreatClass.ORIENTAL)
                    && isOutpatient(treatType))
                return isSuppl ? matchDisease(company, itemName, hasPublicCharge, gen, false) : null;
        }
        if (lower.contains("질병") && lower.contains("입원")) {
            if ((tc == TreatClass.DISEASE || tc == TreatClass.DENTAL || tc == TreatClass.ORIENTAL)
                    && isInpatient(treatType))
                return isSuppl ? matchDisease(company, itemName, hasPublicCharge, gen, true) : null;
        }

        // ── 처방약 ────────────────────────────────────────────────────────
        if (lower.contains("처방") || (lower.contains("약") && !lower.contains("의약"))) {
            if (tc == TreatClass.PHARMACY)
                return isSuppl ? new MR(company, itemName, CONFIRMED, gen,
                        gl(gen) + " · 처방약 보장") : null;
        }

        // ── 정액 (진단코드 직접 매핑) ─────────────────────────────────────
        if (diseaseCode != null) {
            if (lower.contains("화상") && diseaseCode.startsWith("AT"))
                return new MR(company, itemName, CONFIRMED, null, "화상진단 정액 보장");
            if (lower.contains("암") && diseaseCode.startsWith("C"))
                return new MR(company, itemName, CONFIRMED, null, "암진단 정액 보장");
            if ((lower.contains("뇌혈관") || lower.contains("뇌졸중")) && diseaseCode.startsWith("I6"))
                return new MR(company, itemName, CONFIRMED, null, "뇌혈관질환 정액 보장");
            if ((lower.contains("허혈") || lower.contains("심근경색")) && diseaseCode.startsWith("I2"))
                return new MR(company, itemName, CONFIRMED, null, "허혈성심장질환 정액 보장");
            if (lower.contains("골절") && (tc == TreatClass.INJURY || diseaseCode.startsWith("S")))
                return new MR(company, itemName, LIKELY, null, "골절진단 정액 (약관 확인)");
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

    // 상해: 모든 세대에서 비급여 포함 보장. 4세대는 비급여 30% 자기부담.
    private MatchResult matchInjury(String company, String itemName, String gen, boolean inpatient) {
        String place = inpatient ? "입원" : "통원";
        return switch (gen != null ? gen : "") {
            case "1d", "1h", "2", "3", "3k" -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 상해 " + place + " 급여+비급여 보장");
            case "4" -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 상해 " + place + " 보장 (비급여 30% 자기부담)");
            default  -> new MR(company, itemName, LIKELY, gen, gl(gen) + " · 상해 보장 확인");
        };
    }

    /**
     * 질병 (일반): 급여는 전 세대 CONFIRMED.
     * 비급여는 세대가 높을수록 자기부담 증가 및 제한.
     */
    private MatchResult matchDisease(String company, String itemName,
                                      boolean hasPublicCharge, String gen, boolean inpatient) {
        String place = inpatient ? "입원" : "통원";
        if (hasPublicCharge) {
            return new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 질병 " + place + " 급여 보장");
        }
        return switch (gen != null ? gen : "") {
            case "1d", "1h", "2", "3" -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 질병 " + place + " 급여+비급여 보장");
            case "3k" -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 질병 " + place + " 보장 (비급여 특약 별도)");
            case "4"  -> new MR(company, itemName, LIKELY, gen,
                    gl(gen) + " · 비급여 30% 자기부담 (도수치료 등 특약 확인)");
            default   -> new MR(company, itemName, LIKELY, gen, gl(gen) + " · 약관 확인");
        };
    }

    /**
     * 치과 질병 (AK*): 1세대 완전 면책, 2세대 이후 급여 자기부담금만 보상.
     */
    private MatchResult matchDentalDisease(String company, String itemName,
                                            boolean hasPublicCharge, String gen) {
        if ("1d".equals(gen) || "1h".equals(gen))
            return new MR(company, itemName, EXCLUDED, gen, gl(gen) + " · 치과 질병 면책");
        if (hasPublicCharge)
            return new MR(company, itemName, CONFIRMED, gen, gl(gen) + " · 치과 질병 급여만 보상");
        return new MR(company, itemName, EXCLUDED, gen, gl(gen) + " · 치과 질병 비급여 제외");
    }

    /**
     * 한방: 세대가 높을수록 비급여 보장 축소.
     */
    private MatchResult matchOriental(String company, String itemName,
                                       boolean hasPublicCharge, String gen, String treatType) {
        String place = isInpatient(treatType) ? "입원" : "통원";
        if (hasPublicCharge) {
            return new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 한방 " + place + " 급여 보장");
        }
        return switch (gen != null ? gen : "") {
            case "1d", "1h" -> new MR(company, itemName, CONFIRMED, gen,
                    gl(gen) + " · 한방 비급여 포함 보장");
            case "2", "3", "3k" -> new MR(company, itemName, LIKELY, gen,
                    gl(gen) + " · 한방 비급여 약관 확인");
            case "4" -> new MR(company, itemName, EXCLUDED, gen,
                    gl(gen) + " · 한방 비급여 제외");
            default  -> new MR(company, itemName, CHECK_NEEDED, gen,
                    gl(gen) + " · 한방 약관 확인");
        };
    }

    // ── 세대 판별 ────────────────────────────────────────────────────────────

    /**
     * 실손보험 세대 판별.
     * - 1세대: 손보(1d) vs 생보(1h) 구분 (companyName에 "생명" 포함 여부)
     * - 3세대: 착한실손(3k) 여부 (productName에 "착한" 또는 "경제형" 포함)
     */
    private String detectGeneration(PolicyInfo policy) {
        LocalDate startDate = policy.getStartDate();
        if (startDate == null) return null;
        if (startDate.isBefore(GEN2_START)) {
            String company = policy.getCompanyName();
            if (company != null && company.contains("생명")) return "1h";
            return "1d";
        }
        if (startDate.isBefore(GEN3_START)) return "2";
        if (startDate.isBefore(GEN4_START)) {
            String product = policy.getProductName();
            if (product != null && (product.contains("착한") || product.contains("경제형")))
                return "3k";
            return "3";
        }
        return "4";
    }

    /** 세대 코드 → 표시 레이블 */
    private String gl(String gen) {
        if (gen == null) return "실손";
        return switch (gen) {
            case "1d" -> "1세대 손보 실손";
            case "1h" -> "1세대 생보 실손";
            case "2"  -> "2세대 실손";
            case "3"  -> "3세대 실손";
            case "3k" -> "3세대 착한실손";
            case "4"  -> "4세대 실손";
            default   -> "실손";
        };
    }

    // ── 분류 ────────────────────────────────────────────────────────────────

    private TreatClass classify(String code, String diagnosis) {
        if ("$".equals(code)) return TreatClass.PHARMACY;
        if (diagnosis != null && diagnosis.contains("(한방)")) return TreatClass.ORIENTAL;
        String upper = code != null ? code.toUpperCase() : "";
        if (upper.startsWith("AS") || upper.startsWith("AT")) return TreatClass.INJURY;
        if (upper.startsWith("AK")) {
            int k = parseKCategory(upper);
            if (k >= 0 && k <= 8) return TreatClass.DENTAL;
        }
        return TreatClass.DISEASE;
    }

    // AK코드에서 K 카테고리 번호 추출 (AK021 → 2, AK0119 → 1, AK14xx → 14, AK25 → 25)
    private int parseKCategory(String upper) {
        StringBuilder digits = new StringBuilder();
        for (int i = 2; i < upper.length(); i++) {
            char c = upper.charAt(i);
            if (Character.isDigit(c)) digits.append(c);
            else break;
        }
        if (digits.length() == 0) return -1;
        String s = digits.length() >= 2 ? digits.substring(0, 2) : digits.toString();
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return -1; }
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
        return null;
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> safeFetch(java.util.function.Supplier<List<T>> fn, String msg) {
        try { return fn.get(); }
        catch (Exception e) { log.warn("{}: {}", msg, e.getMessage()); return List.of(); }
    }

    // ── 내부 타입 ─────────────────────────────────────────────────────────────

    private enum TreatClass { DISEASE, INJURY, DENTAL, PHARMACY, ORIENTAL }

    private enum ClaimCategory {
        INJURY_OUTPATIENT, INJURY_INPATIENT,
        DISEASE_OUTPATIENT, DISEASE_INPATIENT,
        PHARMACY, LUMP_SUM, ALL
    }

    private ClaimCategory toClaimCategory(TreatClass tc, String treatType) {
        if (tc == TreatClass.PHARMACY) return ClaimCategory.PHARMACY;
        boolean inpatient = isInpatient(treatType);
        if (tc == TreatClass.INJURY)
            return inpatient ? ClaimCategory.INJURY_INPATIENT : ClaimCategory.INJURY_OUTPATIENT;
        return inpatient ? ClaimCategory.DISEASE_INPATIENT : ClaimCategory.DISEASE_OUTPATIENT;
    }

    private static class MR extends MatchResult {
        MR(String c, String cn, String conf, String gen, String note) {
            super(c, cn, conf, gen, note);
        }
    }

    private static class MatchResult {
        final String company;
        final String coverageName;
        final String confidence;
        final String gen;
        final String note;

        MatchResult(String company, String coverageName, String confidence,
                    String gen, String note) {
            this.company      = company;
            this.coverageName = coverageName;
            this.confidence   = confidence;
            this.gen          = gen;
            this.note         = note;
        }
    }
}
