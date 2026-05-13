package com.medicatch.insurance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.insurance.entity.ClaimPayment;
import com.medicatch.insurance.entity.CoverageItem;
import com.medicatch.insurance.entity.Policy;
import com.medicatch.insurance.repository.ClaimPaymentRepository;
import com.medicatch.insurance.repository.PolicyRepository;
import io.codef.api.EasyCodef;
import io.codef.api.EasyCodefServiceType;
import io.codef.api.EasyCodefUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
public class CodefInsuranceSyncService {

    private static final String CONTRACT_URL = "/v1/kr/insurance/0001/credit4u/contract-info";

    @Value("${codef.api-client-id:YOUR_API_CLIENT_ID}")
    private String clientId;
    @Value("${codef.api-client-secret:YOUR_API_CLIENT_SECRET}")
    private String clientSecret;
    @Value("${codef.demo-client-id:YOUR_DEMO_CLIENT_ID}")
    private String demoClientId;
    @Value("${codef.demo-client-secret:YOUR_DEMO_CLIENT_SECRET}")
    private String demoClientSecret;
    @Value("${codef.public-key:}")
    private String publicKey;
    @Value("${codef.use-demo:true}")
    private boolean useDemo;

    private final ObjectMapper objectMapper;
    private final PolicyRepository policyRepository;
    private final ClaimPaymentRepository claimPaymentRepository;

    public CodefInsuranceSyncService(ObjectMapper objectMapper,
                                     PolicyRepository policyRepository,
                                     ClaimPaymentRepository claimPaymentRepository) {
        this.objectMapper = objectMapper;
        this.policyRepository = policyRepository;
        this.claimPaymentRepository = claimPaymentRepository;
    }

    @Transactional
    public int syncInsuranceData(Long userId, String codefId, String codefPassword) {
        try {
            if (publicKey == null || publicKey.isBlank()) {
                throw new RuntimeException("CODEF 공개키가 설정되지 않았습니다.");
            }
            String rsaPassword = EasyCodefUtil.encryptRSA(codefPassword, publicKey);

            HashMap<String, Object> params = new HashMap<>();
            params.put("organization", "0001");
            params.put("id",          codefId);
            params.put("password",    rsaPassword);
            params.put("type",        "0");

            EasyCodef codef = createCodef();
            log.info("CODEF 보험 계약 정보 조회 - codefId: {}", codefId);
            String result = codef.requestProduct(CONTRACT_URL, serviceType(), params);
            log.debug("보험 계약 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(responseMap.get("result"));
            String code = (String) resultField.get("code");

            if (!"CF-00000".equals(code) && !"CF-03002".equals(code)) {
                String msg = (String) resultField.getOrDefault("message", "보험 정보 조회에 실패했습니다.");
                throw new RuntimeException(msg);
            }

            Map<String, Object> data = toMap(responseMap.get("data"));
            return savePolicies(userId, codefId, data);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("보험 데이터 동기화 실패: {}", e.getMessage(), e);
            throw new RuntimeException("보험 데이터 동기화 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private int savePolicies(Long userId, String codefId, Map<String, Object> data) {
        policyRepository.deleteByCodefId(codefId);

        List<Policy> toSave = new ArrayList<>();

        // 실손보장형 → SUPPLEMENTARY
        toSave.addAll(parseContracts(userId, codefId, data, "resActualLossContractList", "SUPPLEMENTARY"));
        // 정액형 보장은 화면에서 "건강"으로 표시
        toSave.addAll(parseContracts(userId, codefId, data, "resFlatRateContractList", "HEALTH"));
        // 저축성
        toSave.addAll(parseContracts(userId, codefId, data, "resSavingsContractList", "SAVINGS"));
        // 자동차
        toSave.addAll(parseContracts(userId, codefId, data, "resCarContractList", "CAR"));
        // 화재특종/재물성
        toSave.addAll(parseContracts(userId, codefId, data, "resPropertyContractList", "PROPERTY"));

        // 어떤 리스트에 속했는지 기록
        Set<String> supplementaryKeys = new java.util.HashSet<>();
        Set<String> otherTypeKeys = new java.util.HashSet<>();
        for (Policy p : toSave) {
            Set<String> keys = "SUPPLEMENTARY".equals(p.getInsuranceType()) ? supplementaryKeys : otherTypeKeys;
            String numberKey = policyNumberKey(p);
            String identityKey = policyIdentityKey(p);
            if (numberKey != null) keys.add(numberKey);
            if (identityKey != null) keys.add(identityKey);
        }

        // policyNumber 기준 중복 병합 (보험료 있는 버전 우선)
        Map<String, Policy> deduped = new java.util.LinkedHashMap<>();
        Map<String, String> numberIndex = new java.util.HashMap<>();
        Map<String, String> identityIndex = new java.util.HashMap<>();
        for (Policy p : toSave) {
            String existingKey = findExistingPolicyKey(p, numberIndex, identityIndex);
            if (existingKey == null) {
                String primaryKey = Optional.ofNullable(policyNumberKey(p)).orElse(policyIdentityKey(p));
                if (primaryKey == null) continue;
                deduped.put(primaryKey, p);
                indexPolicy(p, primaryKey, numberIndex, identityIndex);
                continue;
            }

            Policy existing = deduped.get(existingKey);
            if (shouldPreferPolicy(p, existing)) {
                mergePolicy(p, existing);
                deduped.put(existingKey, p);
                indexPolicy(p, existingKey, numberIndex, identityIndex);
            } else {
                mergePolicy(existing, p);
                indexPolicy(existing, existingKey, numberIndex, identityIndex);
            }
        }

        // 최종 타입 및 실손보장 포함 플래그 결정
        // - 실손 리스트에만 있는 경우: SUPPLEMENTARY
        // - 실손 + 다른 리스트 동시 존재(복합 상품): 다른 리스트 타입 유지 + hasSupplementaryCoverage = true
        deduped.values().forEach(p -> {
            String numberKey = policyNumberKey(p);
            String identityKey = policyIdentityKey(p);
            boolean inSupplementary = (numberKey != null && supplementaryKeys.contains(numberKey))
                    || (identityKey != null && supplementaryKeys.contains(identityKey));
            boolean inOther = (numberKey != null && otherTypeKeys.contains(numberKey))
                    || (identityKey != null && otherTypeKeys.contains(identityKey));
            if (inSupplementary && !inOther) {
                p.setInsuranceType("SUPPLEMENTARY");
            }
            p.setHasSupplementaryCoverage(inSupplementary);
        });

        List<Policy> unique = new ArrayList<>(deduped.values());
        policyRepository.saveAll(unique);
        log.info("보험 데이터 저장 완료 - codefId: {}, policies: {}", codefId, unique.size());

        saveClaimPayments(userId, codefId, data);

        return unique.size();
    }

    @SuppressWarnings("unchecked")
    private void saveClaimPayments(Long userId, String codefId, Map<String, Object> data) {
        claimPaymentRepository.deleteByCodefId(codefId);

        List<Map<String, Object>> paymentList =
                (List<Map<String, Object>>) data.getOrDefault("resActualLossPaymentList", List.of());

        List<ClaimPayment> payments = new ArrayList<>();
        for (Map<String, Object> payment : paymentList) {
            String occurStr = str(payment.get("resOccurDateTime"));
            LocalDate occurrenceDate = parseDateOrNull(occurStr);
            if (occurrenceDate == null) continue;

            String companyName = str(payment.get("resCompanyNm"));

            List<Map<String, Object>> details =
                    (List<Map<String, Object>>) payment.getOrDefault("resDetailList", List.of());

            if (details.isEmpty()) {
                payments.add(ClaimPayment.builder()
                        .userId(userId)
                        .codefId(codefId)
                        .occurrenceDate(occurrenceDate)
                        .companyName(companyName)
                        .paidAmount(parseDouble(payment.get("resTotalAmount")))
                        .judgeResult("지급")
                        .build());
            } else {
                for (Map<String, Object> detail : details) {
                    String payDateStr = str(detail.get("resPaymentDate"));
                    payments.add(ClaimPayment.builder()
                            .userId(userId)
                            .codefId(codefId)
                            .occurrenceDate(occurrenceDate)
                            .paymentDate(parseDateOrNull(payDateStr))
                            .companyName(companyName)
                            .reasonForPayment(str(detail.get("resReasonForPayment")))
                            .judgeResult(str(detail.get("resJudgeResult")))
                            .paidAmount(parseDouble(detail.get("resPaidAmount")))
                            .build());
                }
            }
        }

        claimPaymentRepository.saveAll(payments);
        log.info("보험금 지급 내역 저장 완료 - codefId: {}, payments: {}", codefId, payments.size());
    }

    private boolean isNonLifeCompany(String companyName) {
        if (companyName == null) return false;
        String lower = companyName.toLowerCase();
        return lower.contains("화재") || lower.contains("손보") || lower.contains("해상") || lower.contains("손해");
    }

    private String findExistingPolicyKey(Policy policy, Map<String, String> numberIndex,
                                         Map<String, String> identityIndex) {
        String numberKey = policyNumberKey(policy);
        if (numberKey != null && numberIndex.containsKey(numberKey)) {
            return numberIndex.get(numberKey);
        }

        String identityKey = policyIdentityKey(policy);
        if (identityKey != null && identityIndex.containsKey(identityKey)) {
            return identityIndex.get(identityKey);
        }

        return null;
    }

    private void indexPolicy(Policy policy, String primaryKey, Map<String, String> numberIndex,
                             Map<String, String> identityIndex) {
        String numberKey = policyNumberKey(policy);
        String identityKey = policyIdentityKey(policy);
        if (numberKey != null) numberIndex.put(numberKey, primaryKey);
        if (identityKey != null) identityIndex.put(identityKey, primaryKey);
    }

    private boolean shouldPreferPolicy(Policy candidate, Policy current) {
        boolean candidateHasPremium = candidate.getMonthlyPremium() != null && candidate.getMonthlyPremium() > 0;
        boolean currentHasPremium = current.getMonthlyPremium() != null && current.getMonthlyPremium() > 0;
        if (candidateHasPremium != currentHasPremium) return candidateHasPremium;

        boolean candidateIsSupplementary = "SUPPLEMENTARY".equals(candidate.getInsuranceType());
        boolean currentIsSupplementary = "SUPPLEMENTARY".equals(current.getInsuranceType());
        if (candidateIsSupplementary != currentIsSupplementary) return !candidateIsSupplementary;

        return false;
    }

    private void mergePolicy(Policy target, Policy source) {
        if (target.getStartDate() == null && source.getStartDate() != null)
            target.setStartDate(source.getStartDate());
        if (target.getEndDate() == null && source.getEndDate() != null)
            target.setEndDate(source.getEndDate());
        if ((target.getMonthlyPremium() == null || target.getMonthlyPremium() <= 0)
                && source.getMonthlyPremium() != null && source.getMonthlyPremium() > 0) {
            target.setMonthlyPremium(source.getMonthlyPremium());
            target.setAnnualPremium(source.getAnnualPremium());
            target.setPremiumAmount(source.getPremiumAmount());
            target.setPaymentCycle(source.getPaymentCycle());
            target.setPaymentPeriod(source.getPaymentPeriod());
        } else if (target.getPremiumAmount() == null && source.getPremiumAmount() != null) {
            target.setPremiumAmount(source.getPremiumAmount());
            target.setPaymentCycle(source.getPaymentCycle());
            target.setPaymentPeriod(source.getPaymentPeriod());
        }
        if ((target.getPolicyDetails() == null || target.getPolicyDetails().isBlank())
                && source.getPolicyDetails() != null) {
            target.setPolicyDetails(source.getPolicyDetails());
        }
        target.setActive(target.isActive() || source.isActive());
        target.setHasSupplementaryCoverage(target.isHasSupplementaryCoverage()
                || source.isHasSupplementaryCoverage()
                || "SUPPLEMENTARY".equals(source.getInsuranceType()));
        mergeCoverageItems(target, source.getCoverageItems());
    }

    private void mergeCoverageItems(Policy target, List<CoverageItem> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) return;

        List<CoverageItem> targetItems = target.getCoverageItems();
        if (targetItems == null) {
            targetItems = new ArrayList<>();
            target.setCoverageItems(targetItems);
        }

        Set<String> existingKeys = new HashSet<>();
        for (CoverageItem item : targetItems) {
            existingKeys.add(coverageItemKey(item));
        }

        int nextPriority = targetItems.stream()
                .map(CoverageItem::getPriority)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;

        for (CoverageItem item : sourceItems) {
            String key = coverageItemKey(item);
            if (existingKeys.contains(key)) continue;
            item.setPolicy(target);
            if (item.getPriority() == null) item.setPriority(nextPriority++);
            targetItems.add(item);
            existingKeys.add(key);
        }
    }

    private String coverageItemKey(CoverageItem item) {
        return normalizeKey(item.getItemName()) + "|"
                + normalizeKey(item.getConditions()) + "|"
                + (item.getMaxBenefitAmount() != null ? item.getMaxBenefitAmount() : "");
    }

    private String policyNumberKey(Policy policy) {
        return keyWithPrefix("N", policy.getPolicyNumber());
    }

    private String policyIdentityKey(Policy policy) {
        String company = normalizeKey(policy.getInsurerName());
        String product = normalizeKey(policy.getPolicyDetails());
        if (company == null || product == null) return null;
        return "I:" + company + "|" + product;
    }

    private String keyWithPrefix(String prefix, String value) {
        String normalized = normalizeKey(value);
        return normalized == null ? null : prefix + ":" + normalized;
    }

    private String normalizeKey(String value) {
        if (value == null) return null;
        String normalized = value.replaceAll("\\s+", "").trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

    private List<Policy> parseContracts(Long userId, String codefId, Map<String, Object> data,
                                         String key, String insuranceType) {
        return parseContracts(userId, codefId, data, key, item -> insuranceType);
    }

    @SuppressWarnings("unchecked")
    private List<Policy> parseContracts(Long userId, String codefId, Map<String, Object> data,
                                         String key, java.util.function.Function<Map<String, Object>, String> typeResolver) {
        List<Map<String, Object>> list =
                (List<Map<String, Object>>) data.getOrDefault(key, List.of());
        List<Policy> policies = new ArrayList<>();

        for (Map<String, Object> item : list) {
            String policyNumber = str(item.get("resPolicyNumber"));
            if (policyNumber == null || policyNumber.isBlank()) continue;

            // 날짜: 실손의료비 담보 중 가장 이른 commStartDate 우선 사용 (세대 정확 판별)
            // 삼성화재처럼 첫 담보가 "기타실손"(최근 날짜)인 경우 오판 방지
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> covListForDate =
                    (List<Map<String, Object>>) item.getOrDefault("resCoverageLists", List.of());
            String startStr = null;
            String endStr   = null;
            for (Map<String, Object> cov : covListForDate) {
                if (!"실손의료비".equals(str(cov.get("resType")))) continue;
                String s = str(cov.get("commStartDate"));
                String e = str(cov.get("commEndDate"));
                if (s != null && (startStr == null || s.compareTo(startStr) < 0)) startStr = s;
                if (e != null && (endStr   == null || e.compareTo(endStr)   > 0)) endStr   = e;
            }
            // 실손의료비 담보가 없으면 최상위 → resCoverageLists[0] 순으로 fallback
            if (startStr == null) startStr = str(item.get("commStartDate"));
            if (endStr   == null) endStr   = str(item.get("commEndDate"));
            if (startStr == null && !covListForDate.isEmpty())
                startStr = str(covListForDate.get(0).get("commStartDate"));
            if (endStr   == null && !covListForDate.isEmpty())
                endStr   = str(covListForDate.get(0).get("commEndDate"));
            LocalDate startDate = parseDateOrNull(startStr);
            LocalDate endDate   = parseDateOrNull(endStr);

            // SUPPLEMENTARY(실손보장형)인데 실손의료비 담보가 하나도 없으면 제외
            String resolvedType = typeResolver.apply(item);
            if ("SUPPLEMENTARY".equals(resolvedType)) {
                boolean hasActualLoss = covListForDate.stream()
                        .anyMatch(cov -> "실손의료비".equals(str(cov.get("resType"))));
                if (!hasActualLoss) {
                    log.info("실손의료비 담보 없음, 실손 제외: {} ({})",
                            policyNumber, str(item.get("resInsuranceName")));
                    continue;
                }
            }

            String contractStatus = str(item.get("resContractStatus"));
            boolean isActive = isActiveStatus(contractStatus)
                    || (contractStatus == null && endDate != null && endDate.isAfter(LocalDate.now()));

            String premiumStr = str(item.get("resPremium"));
            String paymentCycle = str(item.get("resPaymentCycle"));
            String paymentPeriod = str(item.get("resPaymentPeriod"));
            Double premiumAmount = parseDouble(premiumStr);
            Double monthly = calculateMonthlyPremium(premiumAmount, paymentCycle);
            Double annual = calculateAnnualPremium(premiumAmount, monthly, paymentCycle);

            List<CoverageItem> coverageItems = parseCoverageItems(item);

            Policy policy = Policy.builder()
                    .userId(userId)
                    .codefId(codefId)
                    .policyNumber(policyNumber)
                    .insurerName(strOrDefault(item.get("resCompanyNm"), "미상"))
                    .insuranceType(resolvedType)
                    .startDate(startDate)
                    .endDate(endDate)
                    .isActive(isActive)
                    .monthlyPremium(monthly)
                    .annualPremium(annual)
                    .premiumAmount(premiumAmount)
                    .paymentCycle(paymentCycle)
                    .paymentPeriod(paymentPeriod)
                    .policyDetails(str(item.get("resInsuranceName")))
                    .coverageItems(coverageItems)
                    .build();

            // CoverageItem에 policy 참조 설정
            if (coverageItems != null) {
                coverageItems.forEach(ci -> ci.setPolicy(policy));
            }
            policies.add(policy);
        }
        return policies;
    }

    @SuppressWarnings("unchecked")
    private List<CoverageItem> parseCoverageItems(Map<String, Object> contractItem) {
        List<Map<String, Object>> covList =
                (List<Map<String, Object>>) contractItem.getOrDefault("resCoverageLists", List.of());
        List<CoverageItem> items = new ArrayList<>();
        int priority = 1;

        for (Map<String, Object> cov : covList) {
            String name = str(cov.get("resCoverageName"));
            if (name == null || name.isBlank()) continue;

            // 현재 유효한 보장 항목만 저장
            String covStatus = str(cov.get("resCoverageStatus"));
            if (!isActiveStatus(covStatus)) continue;

            items.add(CoverageItem.builder()
                    .itemName(name)
                    .category(resolveCoverageCategory(name))
                    .maxBenefitAmount(parseDouble(cov.get("resCoverageAmount")))
                    .isCovered(true)
                    .conditions(str(cov.get("resAgreementType")))
                    .priority(priority++)
                    .build());
        }
        return items;
    }

    private String resolveCoverageCategory(String name) {
        if (name == null) return "OUTPATIENT";
        String lower = name.toLowerCase();
        if (lower.contains("입원"))  return "INPATIENT";
        if (lower.contains("수술"))  return "SURGERY";
        if (lower.contains("약"))    return "MEDICATION";
        return "OUTPATIENT";
    }

    private EasyCodef createCodef() {
        EasyCodef codef = new EasyCodef();
        codef.setClientInfoForDemo(demoClientId, demoClientSecret);
        codef.setClientInfo(clientId, clientSecret);
        codef.setPublicKey(publicKey);
        return codef;
    }

    private EasyCodefServiceType serviceType() {
        return useDemo ? EasyCodefServiceType.DEMO : EasyCodefServiceType.API;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object obj) {
        if (obj instanceof Map) return (Map<String, Object>) obj;
        return new HashMap<>();
    }

    private String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private String strOrDefault(Object o, String def) {
        String s = str(o);
        return s == null ? def : s;
    }

    private Double parseDouble(Object o) {
        if (o == null) return null;
        String s = o.toString().trim().replaceAll("[^0-9.]", "");
        if (s.isEmpty()) return null;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
    }

    private Double calculateMonthlyPremium(Double premiumAmount, String paymentCycle) {
        if (premiumAmount == null || premiumAmount <= 0) return null;
        if (isOneTimePayment(paymentCycle)) return null;
        if (isAnnualPayment(paymentCycle)) return premiumAmount / 12.0;
        return premiumAmount;
    }

    private Double calculateAnnualPremium(Double premiumAmount, Double monthlyPremium, String paymentCycle) {
        if (premiumAmount == null || premiumAmount <= 0) return null;
        if (isOneTimePayment(paymentCycle)) return null;
        if (isAnnualPayment(paymentCycle)) return premiumAmount;
        return monthlyPremium != null ? monthlyPremium * 12.0 : null;
    }

    private boolean isOneTimePayment(String paymentCycle) {
        return paymentCycle != null && paymentCycle.contains("일시");
    }

    private boolean isAnnualPayment(String paymentCycle) {
        if (paymentCycle == null) return false;
        return paymentCycle.contains("년") || paymentCycle.contains("연");
    }

    private boolean isActiveStatus(String status) {
        return "정상".equals(status) || "계약부활".equals(status);
    }

    private LocalDate parseDate8(String s) {
        if (s == null || s.length() < 8) return LocalDate.now();
        try {
            return LocalDate.parse(s.substring(0, 8), DateTimeFormatter.ofPattern("yyyyMMdd"));
        } catch (Exception e) {
            return LocalDate.now();
        }
    }

    private LocalDate parseDateOrNull(String s) {
        if (s == null || s.length() < 8) return null;
        try {
            return LocalDate.parse(s.substring(0, 8), DateTimeFormatter.ofPattern("yyyyMMdd"));
        } catch (Exception e) {
            return null;
        }
    }
}
