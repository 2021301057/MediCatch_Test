package com.medicatch.analysis.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.analysis.client.InsuranceServiceClient;
import com.medicatch.analysis.dto.PolicyInfo;
import com.medicatch.analysis.dto.PreTreatmentSearchRequest;
import com.medicatch.analysis.dto.PreTreatmentSearchResponse;
import com.medicatch.analysis.entity.FixedBenefitMatchRule;
import com.medicatch.analysis.entity.InsuranceBenefitRule;
import com.medicatch.analysis.entity.PreTreatmentSearch;
import com.medicatch.analysis.entity.TreatmentRule;
import com.medicatch.analysis.repository.FixedBenefitMatchRuleRepository;
import com.medicatch.analysis.repository.InsuranceBenefitRuleRepository;
import com.medicatch.analysis.repository.PreTreatmentSearchRepository;
import com.medicatch.analysis.repository.TreatmentRuleRepository;
import com.medicatch.analysis.dto.AiClassificationResult;
import com.medicatch.analysis.util.InsuranceGenerationUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
public class PreTreatmentSearchService {

    private static final String MATCH_SOURCE_DB_RULE  = "DB_RULE";
    private static final String MATCH_SOURCE_AI       = "AI_CLASSIFICATION";
    private static final String MATCH_SOURCE_HEURISTIC = "HEURISTIC";
    private static final String MATCH_SOURCE_NONE     = "NONE";

    private final TreatmentRuleRepository treatmentRuleRepository;
    private final InsuranceBenefitRuleRepository insuranceBenefitRuleRepository;
    private final FixedBenefitMatchRuleRepository fixedBenefitMatchRuleRepository;
    private final PreTreatmentSearchRepository preTreatmentSearchRepository;
    private final InsuranceServiceClient insuranceServiceClient;
    private final AiClassificationService aiClassificationService;
    private final ObjectMapper objectMapper;

    public PreTreatmentSearchService(TreatmentRuleRepository treatmentRuleRepository,
                                     InsuranceBenefitRuleRepository insuranceBenefitRuleRepository,
                                     FixedBenefitMatchRuleRepository fixedBenefitMatchRuleRepository,
                                     PreTreatmentSearchRepository preTreatmentSearchRepository,
                                     InsuranceServiceClient insuranceServiceClient,
                                     AiClassificationService aiClassificationService,
                                     ObjectMapper objectMapper) {
        this.treatmentRuleRepository = treatmentRuleRepository;
        this.insuranceBenefitRuleRepository = insuranceBenefitRuleRepository;
        this.fixedBenefitMatchRuleRepository = fixedBenefitMatchRuleRepository;
        this.preTreatmentSearchRepository = preTreatmentSearchRepository;
        this.insuranceServiceClient = insuranceServiceClient;
        this.aiClassificationService = aiClassificationService;
        this.objectMapper = objectMapper;
    }

    public PreTreatmentSearchResponse searchPreTreatment(PreTreatmentSearchRequest request) {
        String query = request != null ? normalizeInput(request.getQuery()) : "";
        if (query.isBlank()) {
            return unmatched("", "검색어를 입력해주세요.");
        }

        if (isObviouslyNonMedical(query)) {
            return unmatched(query, "의료 또는 보험 관련 검색어를 입력해주세요.");
        }

        Optional<TreatmentRule> matchedRule = findBestTreatmentRule(query);
        Long userId = request != null ? request.getUserId() : null;

        if (matchedRule.isEmpty()) {
            AiClassificationResult aiResult = aiClassificationService.classify(query);
            if (aiResult != null) {
                if (!aiResult.isValidMedicalQuery()) {
                    return unmatched(query, "의료 또는 보험 관련 검색어를 입력해주세요.");
                }
                boolean isHeuristic = "HEURISTIC".equals(aiResult.getSource());
                List<PolicyInfo> activePolicies = loadActivePolicies(userId);
                TreatmentRule syntheticRule = toSyntheticRule(query, aiResult);
                PreTreatmentSearchResponse.TreatmentClassificationDto classification = toClassificationDto(syntheticRule);
                PreTreatmentSearchResponse.ActualLossResultDto actualLoss = buildActualLossResult(syntheticRule, activePolicies);
                PreTreatmentSearchResponse.FixedBenefitResultDto fixedBenefits = buildFixedBenefitResult(syntheticRule, activePolicies);
                List<String> nextQuestions = (aiResult.getNextQuestions() != null && !aiResult.getNextQuestions().isEmpty())
                        ? aiResult.getNextQuestions()
                        : buildNextQuestions(syntheticRule, actualLoss, fixedBenefits);

                String matchSource = isHeuristic ? MATCH_SOURCE_HEURISTIC : MATCH_SOURCE_AI;
                String message = isHeuristic
                        ? "키워드 기반으로 분류했습니다. 정확도가 낮을 수 있으니 실제 보장 여부는 보험 약관을 확인해주세요."
                        : "AI가 검색어를 분류했습니다. 실제 보장 여부는 보험 약관 기준으로 확인이 필요합니다.";

                PreTreatmentSearchResponse aiResponse = PreTreatmentSearchResponse.builder()
                        .query(query)
                        .matched(true)
                        .matchSource(matchSource)
                        .confidence(aiResult.getConfidence())
                        .classification(classification)
                        .actualLoss(actualLoss)
                        .fixedBenefits(fixedBenefits)
                        .nextQuestions(nextQuestions)
                        .message(message)
                        .build();
                saveSearchLog(request, aiResponse, !isHeuristic);
                return aiResponse;
            }

            PreTreatmentSearchResponse response = unmatched(query, "DB 룰에서 일치하는 진료/보장 기준을 찾지 못했습니다.");
            saveSearchLog(request, response, false);
            return response;
        }

        TreatmentRule rule = matchedRule.get();
        List<PolicyInfo> activePolicies = loadActivePolicies(userId);
        PreTreatmentSearchResponse.TreatmentClassificationDto classification = toClassificationDto(rule);
        PreTreatmentSearchResponse.ActualLossResultDto actualLoss = buildActualLossResult(rule, activePolicies);
        PreTreatmentSearchResponse.FixedBenefitResultDto fixedBenefits = buildFixedBenefitResult(rule, activePolicies);
        List<String> nextQuestions = buildNextQuestions(rule, actualLoss, fixedBenefits);

        PreTreatmentSearchResponse response = PreTreatmentSearchResponse.builder()
                .query(query)
                .matched(true)
                .matchSource(MATCH_SOURCE_DB_RULE)
                .confidence(resolveConfidence(query, rule))
                .classification(classification)
                .actualLoss(actualLoss)
                .fixedBenefits(fixedBenefits)
                .nextQuestions(nextQuestions)
                .message(buildMessage(rule, actualLoss, fixedBenefits))
                .build();

        saveSearchLog(request, response, false);
        return response;
    }

    /**
     * Legacy GET endpoint support. The new pre-treatment API should be used for DB-rule results.
     */
    public List<Map<String, Object>> searchTreatments(String condition) {
        PreTreatmentSearchResponse response = searchPreTreatment(
                PreTreatmentSearchRequest.builder().query(condition).build()
        );
        return List.of(Map.of(
                "query", response.getQuery(),
                "matched", response.getMatched(),
                "matchSource", response.getMatchSource(),
                "classification", response.getClassification() != null ? response.getClassification() : Map.of(),
                "actualLoss", response.getActualLoss() != null ? response.getActualLoss() : Map.of(),
                "fixedBenefits", response.getFixedBenefits() != null ? response.getFixedBenefits() : Map.of(),
                "nextQuestions", response.getNextQuestions(),
                "message", response.getMessage()
        ));
    }

    public Map<String, Object> getTreatmentDetails(String treatmentId) {
        return Map.of(
                "treatmentId", treatmentId,
                "message", "진료 상세 정보는 DB 룰 기반 검색 API에서 classification/rules 형태로 제공합니다."
        );
    }

    public List<String> getAvailableConditions() {
        return treatmentRuleRepository.findByIsActiveOrderByPriorityAsc(true).stream()
                .map(TreatmentRule::getKeyword)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Map<String, Object>> searchHospitals(String condition, String location) {
        return List.of(Map.of(
                "condition", condition,
                "location", location != null ? location : "",
                "message", "병원 검색은 현재 진료 전 보장 룰 검색과 분리되어 있습니다."
        ));
    }

    private TreatmentRule toSyntheticRule(String query, AiClassificationResult ai) {
        return TreatmentRule.builder()
                .keyword(ai.getNormalizedQuery() != null ? ai.getNormalizedQuery() : query)
                .injuryDiseaseType(ai.getInjuryDiseaseType())
                .careType(ai.getCareType())
                .benefitType(ai.getBenefitType())
                .treatmentCategory(ai.getTreatmentCategory())
                .actualLossCategory(ai.getActualLossCategory())
                .fixedBenefitCategory(ai.getFixedBenefitCategory())
                .needsUserConfirmation(ai.isNeedsUserConfirmation())
                .cautionMessage(buildAiCautionMessage(ai))
                .build();
    }

    private String buildAiCautionMessage(AiClassificationResult ai) {
        String injuryDisease = ai.getInjuryDiseaseType();
        String careType = ai.getCareType();
        String treatmentCategory = ai.getTreatmentCategory();
        String actualLossCategory = ai.getActualLossCategory();

        if ("NON_COVERED_THREE".equals(actualLossCategory)) {
            return "비급여 항목으로, 세대별 특약 가입 여부에 따라 보장 여부와 한도가 달라질 수 있습니다.";
        }
        if ("CANCER".equals(treatmentCategory)) {
            return "암 진단·치료 관련으로, 암 종류와 면책기간·감액기간에 따라 보장 여부가 크게 달라질 수 있습니다.";
        }
        if ("REHAB".equals(treatmentCategory)) {
            return "재활치료는 급여/비급여 여부와 특약 가입 여부에 따라 보장 기준이 달라질 수 있습니다.";
        }
        if ("IMAGING".equals(treatmentCategory)) {
            return "영상 검사는 급여 인정 여부에 따라 실손 보장 기준이 달라질 수 있습니다.";
        }
        if ("INJECTION".equals(treatmentCategory)) {
            return "주사 치료는 급여/비급여 여부와 특약 가입 여부에 따라 보장 기준이 달라질 수 있습니다.";
        }
        if ("DENTAL".equals(treatmentCategory)) {
            return "치과 치료는 상해/질병 구분과 급여/비급여 여부에 따라 보장 범위가 달라질 수 있습니다.";
        }
        if ("KOREAN_MEDICINE".equals(treatmentCategory)) {
            return "한방 치료는 급여/비급여 여부와 세대별 면책 조건 확인이 필요합니다.";
        }
        if ("SURGERY".equals(careType)) {
            return "수술 여부와 상해/질병 구분에 따라 실손 및 수술비 담보 보장 기준이 달라질 수 있습니다.";
        }
        if ("INPATIENT".equals(careType)) {
            return "입원 치료의 경우 상해/질병 구분에 따라 적용 담보와 보장 기준이 달라질 수 있습니다.";
        }
        if ("INJURY".equals(injuryDisease)) {
            return "상해 치료로, 급여/비급여 항목과 치료 방법에 따라 실손 보장 기준이 달라질 수 있습니다.";
        }
        if ("DISEASE".equals(injuryDisease)) {
            return "질병 치료로, 급여/비급여 항목 구분에 따라 실손 보장 기준이 달라질 수 있습니다.";
        }
        return "상해/질병 구분과 급여/비급여 여부에 따라 실손 보장 기준이 달라질 수 있습니다.";
    }

    // 명백한 비의료 쿼리를 AI 호출 전에 차단 (순수 숫자, 1자, 특수문자/이모지만 있는 경우)
    private boolean isObviouslyNonMedical(String query) {
        String normalized = normalizeForMatch(query);
        if (normalized.length() < 2) return true;
        if (normalized.matches("[0-9]+")) return true;
        if (normalized.matches("[^가-힣a-zA-Z0-9]+")) return true;
        return false;
    }

    private Optional<TreatmentRule> findBestTreatmentRule(String query) {
        String normalizedQuery = normalizeForMatch(query);
        List<TreatmentRule> rules = treatmentRuleRepository.findByIsActiveOrderByPriorityAsc(true);

        return rules.stream()
                .filter(rule -> matchesRule(normalizedQuery, rule))
                .min(Comparator.comparingInt((TreatmentRule rule) -> matchScore(normalizedQuery, rule))
                        .thenComparing(rule -> safePriority(rule.getPriority())));
    }

    private boolean matchesRule(String normalizedQuery, TreatmentRule rule) {
        return matchScore(normalizedQuery, rule) < Integer.MAX_VALUE;
    }

    private int matchScore(String normalizedQuery, TreatmentRule rule) {
        String keyword = normalizeForMatch(rule.getKeyword());
        int keywordScore = scoreSearchTerm(normalizedQuery, keyword, 0, 2);
        if (keywordScore < Integer.MAX_VALUE) {
            return keywordScore;
        }

        return splitCsv(rule.getSynonyms()).stream()
                .map(this::normalizeForMatch)
                .mapToInt(synonym -> scoreSearchTerm(normalizedQuery, synonym, 1, 3))
                .min()
                .orElse(Integer.MAX_VALUE);
    }

    private int scoreSearchTerm(String normalizedQuery, String normalizedTerm, int exactScore, int partialScore) {
        if (normalizedQuery.isBlank() || normalizedTerm.isBlank()) {
            return Integer.MAX_VALUE;
        }
        if (normalizedTerm.equals(normalizedQuery)) {
            return exactScore;
        }
        if (normalizedTerm.length() < 2) {
            return Integer.MAX_VALUE;
        }
        if (normalizedQuery.contains(normalizedTerm) || normalizedTerm.contains(normalizedQuery)) {
            int covered = Math.min(normalizedTerm.length(), normalizedQuery.length());
            int coveragePct = covered * 100 / normalizedQuery.length();
            // Coverage-weighted: longer relative match scores better (lower).
            // Exact matches (scores 0, 1) are always preferred over partials (100+).
            return 100 + (100 - coveragePct);
        }
        return Integer.MAX_VALUE;
    }

    private PreTreatmentSearchResponse.TreatmentClassificationDto toClassificationDto(TreatmentRule rule) {
        return PreTreatmentSearchResponse.TreatmentClassificationDto.builder()
                .keyword(rule.getKeyword())
                .synonyms(splitCsv(rule.getSynonyms()))
                .injuryDiseaseType(rule.getInjuryDiseaseType())
                .careType(rule.getCareType())
                .benefitType(rule.getBenefitType())
                .treatmentCategory(rule.getTreatmentCategory())
                .actualLossCategory(rule.getActualLossCategory())
                .fixedBenefitCategory(rule.getFixedBenefitCategory())
                .needsUserConfirmation(Boolean.TRUE.equals(rule.getNeedsUserConfirmation()))
                .cautionMessage(rule.getCautionMessage())
                .build();
    }

    private PreTreatmentSearchResponse.ActualLossResultDto buildActualLossResult(TreatmentRule rule, List<PolicyInfo> policies) {
        List<PreTreatmentSearchResponse.ActualLossPolicyDto> actualLossPolicies = findActualLossPolicies(policies);
        List<String> selectedGenerationCodes = actualLossPolicies.stream()
                .map(PreTreatmentSearchResponse.ActualLossPolicyDto::getEstimatedGenerationCode)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (isBlank(rule.getActualLossCategory())) {
            return PreTreatmentSearchResponse.ActualLossResultDto.builder()
                    .applicable(false)
                    .reason("정액형 담보 확인 중심 검색어입니다.")
                    .candidateRuleCount(0)
                    .rules(List.of())
                    .ownedPolicies(actualLossPolicies)
                    .selectedGenerationCodes(selectedGenerationCodes)
                    .selectedRules(List.of())
                    .needsGenerationConfirmation(needsGenerationConfirmation(actualLossPolicies))
                    .build();
        }

        List<InsuranceBenefitRule> candidates = insuranceBenefitRuleRepository.findByIsActiveOrderByPriorityAsc(true).stream()
                .filter(benefitRule -> sameOrUnknown(rule.getCareType(), benefitRule.getCareType()))
                .filter(benefitRule -> sameOrMixed(rule.getBenefitType(), benefitRule.getBenefitType()))
                .filter(benefitRule -> sameCategory(rule.getActualLossCategory(), benefitRule.getActualLossCategory()))
                .filter(benefitRule -> sameTreatmentCategory(rule.getTreatmentCategory(), benefitRule))
                .toList();
        List<InsuranceBenefitRule> selectedRules = candidates.stream()
                .filter(candidate -> selectedGenerationCodes.contains(candidate.getGenerationCode()))
                .toList();

        return PreTreatmentSearchResponse.ActualLossResultDto.builder()
                .applicable(true)
                .reason(buildActualLossReason(candidates, selectedRules, actualLossPolicies))
                .candidateRuleCount(candidates.size())
                .rules(candidates.stream().map(this::toActualLossRuleDto).toList())
                .ownedPolicies(actualLossPolicies)
                .selectedGenerationCodes(selectedGenerationCodes)
                .selectedRules(selectedRules.stream().map(this::toActualLossRuleDto).toList())
                .needsGenerationConfirmation(needsGenerationConfirmation(actualLossPolicies))
                .build();
    }

    private List<PreTreatmentSearchResponse.ActualLossPolicyDto> findActualLossPolicies(List<PolicyInfo> policies) {
        return policies.stream()
                .filter(Objects::nonNull)
                .map(policy -> {
                    List<PreTreatmentSearchResponse.ActualLossCoverageItemDto> matchedCoverageItems = safeCoverageItems(policy).stream()
                            .filter(PolicyInfo.CoverageItemInfo::isCovered)
                            .filter(this::isActualLossCoverageItem)
                            .map(this::toActualLossCoverageItemDto)
                            .toList();
                    List<String> matchedCoverageNames = matchedCoverageItems.stream()
                            .map(PreTreatmentSearchResponse.ActualLossCoverageItemDto::getName)
                            .filter(Objects::nonNull)
                            .distinct()
                            .toList();
                    boolean hasActualLossCoverage = !matchedCoverageNames.isEmpty() || isActualLossPolicyType(policy);
                    if (!hasActualLossCoverage) {
                        return null;
                    }
                    String generationCode = estimateActualLossGeneration(policy);
                    return PreTreatmentSearchResponse.ActualLossPolicyDto.builder()
                            .policyId(policy.getId())
                            .policyName(policy.getProductName())
                            .insurerName(policy.getCompanyName())
                            .policyType(policy.getPolicyType())
                            .startDate(policy.getStartDate())
                            .endDate(policy.getEndDate())
                            .estimatedGenerationCode(generationCode)
                            .generationLabel(generationLabel(generationCode))
                            .generationConfidence(generationConfidence(generationCode))
                            .hasActualLossCoverage(true)
                            .matchedCoverageNames(matchedCoverageNames)
                            .matchedCoverageItems(matchedCoverageItems)
                            .build();
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private PreTreatmentSearchResponse.ActualLossCoverageItemDto toActualLossCoverageItemDto(PolicyInfo.CoverageItemInfo item) {
        return PreTreatmentSearchResponse.ActualLossCoverageItemDto.builder()
                .name(item.getName())
                .category(item.getCategory())
                .agreementType(item.getAgreementType())
                .amount(item.getAmount())
                .build();
    }

    private boolean isActualLossPolicyType(PolicyInfo policy) {
        String target = normalizeForMatch(String.join(" ",
                nullToBlank(policy.getPolicyType()),
                nullToBlank(policy.getProductName()),
                nullToBlank(policy.getCompanyName())
        ));
        return policy.isHasSupplementaryCoverage()
                || "SUPPLEMENTARY".equalsIgnoreCase(nullToBlank(policy.getPolicyType()))
                || target.contains("실손")
                || target.contains("actualloss")
                || target.contains("actual_loss");
    }

    private boolean isActualLossCoverageItem(PolicyInfo.CoverageItemInfo item) {
        String target = normalizeForMatch(String.join(" ",
                nullToBlank(item.getName()),
                nullToBlank(item.getCategory()),
                nullToBlank(item.getAgreementType())
        ));
        if (containsAny(target,
                "입원일당", "중환자실입원일당", "입원비", "입원수술비", "수술비",
                "암통원", "통원일당", "진단비", "후유장해", "사망", "위로금")) {
            return false;
        }
        return containsAny(target,
                "실손", "실손의료비", "입원의료비", "통원의료비",
                "상해입원의료비", "상해통원의료비", "질병입원의료비", "질병통원의료비",
                "actual_loss", "actualloss");
    }

    private String estimateActualLossGeneration(PolicyInfo policy) {
        return InsuranceGenerationUtils.detect(policy);
    }

    private String generationLabel(String generationCode) {
        if (generationCode == null) {
            return null;
        }
        return switch (generationCode) {
            case "1-d" -> "1세대 손해보험";
            case "1-h" -> "1세대 생명보험";
            case "2" -> "2세대";
            case "3-s" -> "3세대 표준";
            case "3-c" -> "3세대 착한실손";
            case "4" -> "4세대";
            default -> generationCode;
        };
    }

    private String generationConfidence(String generationCode) {
        if (generationCode == null) {
            return "UNKNOWN";
        }
        return "3-s".equals(generationCode) || "3-c".equals(generationCode) ? "ESTIMATED" : "HIGH";
    }

    private boolean needsGenerationConfirmation(List<PreTreatmentSearchResponse.ActualLossPolicyDto> actualLossPolicies) {
        return actualLossPolicies.stream()
                .anyMatch(policy -> !"HIGH".equals(policy.getGenerationConfidence()));
    }

    private String buildActualLossReason(List<InsuranceBenefitRule> candidates,
                                         List<InsuranceBenefitRule> selectedRules,
                                         List<PreTreatmentSearchResponse.ActualLossPolicyDto> actualLossPolicies) {
        if (candidates.isEmpty()) {
            return "일치하는 실손 세대별 룰 후보가 없습니다.";
        }
        if (actualLossPolicies.isEmpty()) {
            return "현재 조회된 보험에서 실손 담보를 찾지 못했습니다. 후보 룰만 참고용으로 제공합니다.";
        }
        if (selectedRules.isEmpty()) {
            return "실손 계약은 찾았지만 추정 세대와 일치하는 룰이 아직 없습니다. 후보 룰만 참고용으로 제공합니다.";
        }
        return "사용자 실손 세대 기준으로 적용 가능한 후보 룰을 확인했습니다.";
    }

    private PreTreatmentSearchResponse.ActualLossRuleDto toActualLossRuleDto(InsuranceBenefitRule rule) {
        return PreTreatmentSearchResponse.ActualLossRuleDto.builder()
                .generationCode(rule.getGenerationCode())
                .careType(rule.getCareType())
                .benefitType(rule.getBenefitType())
                .treatmentCategory(rule.getTreatmentCategory())
                .actualLossCategory(rule.getActualLossCategory())
                .reimbursementRate(rule.getReimbursementRate())
                .patientCopayRate(rule.getPatientCopayRate())
                .fixedDeductible(rule.getFixedDeductible())
                .deductibleMethod(rule.getDeductibleMethod())
                .limitAmount(rule.getLimitAmount())
                .limitCount(rule.getLimitCount())
                .requiresRider(Boolean.TRUE.equals(rule.getRequiresRider()))
                .isExcluded(Boolean.TRUE.equals(rule.getIsExcluded()))
                .note(rule.getNote())
                .build();
    }

    private PreTreatmentSearchResponse.FixedBenefitResultDto buildFixedBenefitResult(TreatmentRule rule, List<PolicyInfo> policies) {
        if (isBlank(rule.getFixedBenefitCategory())) {
            return PreTreatmentSearchResponse.FixedBenefitResultDto.builder()
                    .applicable(false)
                    .category(null)
                    .matchRuleCount(0)
                    .rules(List.of())
                    .ownedGroups(List.of())
                    .build();
        }

        String category = rule.getFixedBenefitCategory();
        List<FixedBenefitMatchRule> rules = fixedBenefitMatchRuleRepository
                .findByCategoryOrPrefixAndIsActive(category, category + "_%", true);
        List<String> contextTerms = rule.getKeyword() != null ? List.of(rule.getKeyword()) : List.of();
        List<PreTreatmentSearchResponse.FixedBenefitOwnedGroupDto> ownedGroups = rules.stream()
                .map(matchRule -> buildOwnedGroup(matchRule, policies, contextTerms))
                .toList();

        return PreTreatmentSearchResponse.FixedBenefitResultDto.builder()
                .applicable(true)
                .category(category)
                .matchRuleCount(rules.size())
                .rules(rules.stream().map(this::toFixedBenefitRuleDto).toList())
                .ownedGroups(ownedGroups)
                .build();
    }

    private PreTreatmentSearchResponse.FixedBenefitResultDto buildFixedBenefitResult(TreatmentRule rule, Long userId) {
        return buildFixedBenefitResult(rule, loadActivePolicies(userId));
    }

    private List<PolicyInfo> loadActivePolicies(Long userId) {
        if (userId == null) {
            return List.of();
        }
        try {
            List<PolicyInfo> policies = insuranceServiceClient.getActivePolicies(userId);
            return policies != null ? policies : List.of();
        } catch (Exception e) {
            log.warn("Failed to load active policies for pre-treatment matching. userId={}, error={}", userId, e.getMessage());
            return List.of();
        }
    }

    private PreTreatmentSearchResponse.FixedBenefitOwnedGroupDto buildOwnedGroup(
            FixedBenefitMatchRule rule, List<PolicyInfo> policies, List<String> contextTerms) {
        List<String> matchKeywords = splitCsv(rule.getMatchKeywords());
        List<String> excludeKeywords = splitCsv(rule.getExcludeKeywords());
        List<PreTreatmentSearchResponse.MatchedCoverageItemDto> matchedItems = policies.stream()
                .filter(Objects::nonNull)
                .flatMap(policy -> safeCoverageItems(policy).stream()
                        .filter(PolicyInfo.CoverageItemInfo::isCovered)
                        .filter(item -> matchesCoverageItem(item, matchKeywords, excludeKeywords))
                        .filter(item -> !isContextTermExcluded(item, contextTerms))
                        .map(item -> toMatchedCoverageItem(policy, item)))
                .toList();

        double totalAmount = matchedItems.stream()
                .map(PreTreatmentSearchResponse.MatchedCoverageItemDto::getCoverageAmount)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();

        return PreTreatmentSearchResponse.FixedBenefitOwnedGroupDto.builder()
                .category(rule.getFixedBenefitCategory())
                .displayName(rule.getDisplayName())
                .owned(!matchedItems.isEmpty())
                .matchedItemCount(matchedItems.size())
                .totalCoverageAmount(totalAmount)
                .matchedItems(matchedItems)
                .build();
    }

    private List<PolicyInfo.CoverageItemInfo> safeCoverageItems(PolicyInfo policy) {
        return policy.getCoverageItems() != null ? policy.getCoverageItems() : List.of();
    }

    private boolean matchesCoverageItem(PolicyInfo.CoverageItemInfo item, List<String> matchKeywords, List<String> excludeKeywords) {
        String target = normalizeForMatch(String.join(" ",
                nullToBlank(item.getName()),
                nullToBlank(item.getCategory()),
                nullToBlank(item.getAgreementType())
        ));

        boolean matched = matchKeywords.stream()
                .map(this::normalizeForMatch)
                .anyMatch(keyword -> !keyword.isBlank()
                        && target.contains(keyword)
                        && !isExcludedByItemName(target, keyword));
        if (!matched) {
            return false;
        }

        return excludeKeywords.stream()
                .map(this::normalizeForMatch)
                .noneMatch(keyword -> !keyword.isBlank() && target.contains(keyword));
    }

    /**
     * 검색 문맥 키워드(치료 룰의 keyword)가 담보명에서 제외 문구와 함께 나오면 true.
     * 예: "치아파절" 검색 → "[골절진단비(치아파절 제외)]" → true (이 담보는 치아파절을 보장하지 않음)
     */
    private boolean isContextTermExcluded(PolicyInfo.CoverageItemInfo item, List<String> contextTerms) {
        if (contextTerms == null || contextTerms.isEmpty()) return false;
        String target = normalizeForMatch(String.join(" ",
                nullToBlank(item.getName()),
                nullToBlank(item.getCategory()),
                nullToBlank(item.getAgreementType())
        ));
        return contextTerms.stream()
                .map(this::normalizeForMatch)
                .filter(t -> !t.isBlank())
                .anyMatch(term -> isExcludedByItemName(target, term));
    }

    /**
     * 담보명에 "[keyword] (설명) 제외/면책/해당없음" 패턴이 있으면 true.
     * 중첩 괄호도 처리: "치아파절(깨짐(조각포함), 부러짐) 제외" → true
     * "골절진단비(치아파절 제외)"에서 "골절" 검색 시 → false (골절 바로 뒤는 진단비)
     */
    private boolean isExcludedByItemName(String normalizedTarget, String normalizedKeyword) {
        // 선행 태그 제거: [건강], [상해] 등
        String cleaned = normalizedTarget.replaceAll("^\\[[^\\]]*\\]", "");
        int idx = cleaned.indexOf(normalizedKeyword);
        while (idx >= 0) {
            String after = cleaned.substring(idx + normalizedKeyword.length());
            String afterSkipped = skipParenthetical(after);
            if (afterSkipped.startsWith("제외")
                    || afterSkipped.startsWith("면책")
                    || afterSkipped.startsWith("해당없음")) {
                return true;
            }
            idx = cleaned.indexOf(normalizedKeyword, idx + 1);
        }
        return false;
    }

    /** "(" 로 시작하는 괄호 블록(중첩 포함)을 건너뛰고 그 이후 문자열 반환. */
    private String skipParenthetical(String s) {
        if (s.isEmpty() || s.charAt(0) != '(') {
            return s;
        }
        int depth = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '(') depth++;
            else if (s.charAt(i) == ')') {
                depth--;
                if (depth == 0) return s.substring(i + 1);
            }
        }
        return s;
    }

    private PreTreatmentSearchResponse.MatchedCoverageItemDto toMatchedCoverageItem(PolicyInfo policy, PolicyInfo.CoverageItemInfo item) {
        return PreTreatmentSearchResponse.MatchedCoverageItemDto.builder()
                .policyId(policy.getId())
                .policyName(policy.getProductName())
                .insurerName(policy.getCompanyName())
                .policyType(policy.getPolicyType())
                .itemName(item.getName())
                .category(item.getCategory())
                .agreementType(item.getAgreementType())
                .coverageAmount(item.getAmount())
                .build();
    }

    private PreTreatmentSearchResponse.FixedBenefitRuleDto toFixedBenefitRuleDto(FixedBenefitMatchRule rule) {
        return PreTreatmentSearchResponse.FixedBenefitRuleDto.builder()
                .category(rule.getFixedBenefitCategory())
                .displayName(rule.getDisplayName())
                .matchKeywords(splitCsv(rule.getMatchKeywords()))
                .excludeKeywords(splitCsv(rule.getExcludeKeywords()))
                .description(rule.getDescription())
                .build();
    }

    private boolean matchesFixedBenefitCategory(String treatmentCategory, String ruleCategory) {
        if (isBlank(treatmentCategory) || isBlank(ruleCategory)) {
            return false;
        }
        return ruleCategory.equals(treatmentCategory) || ruleCategory.startsWith(treatmentCategory + "_");
    }

    private List<String> buildNextQuestions(TreatmentRule rule,
                                            PreTreatmentSearchResponse.ActualLossResultDto actualLoss,
                                            PreTreatmentSearchResponse.FixedBenefitResultDto fixedBenefits) {
        List<String> questions = new ArrayList<>();
        if (Boolean.TRUE.equals(rule.getNeedsUserConfirmation())) {
            if ("UNKNOWN".equals(rule.getInjuryDiseaseType())) {
                questions.add("상해 치료인가요, 질병 치료인가요?");
            }
            if ("UNKNOWN".equals(rule.getBenefitType()) || "MIXED".equals(rule.getBenefitType())) {
                questions.add("급여 항목인가요, 비급여 항목인가요?");
            }
        }
        if (Boolean.TRUE.equals(actualLoss.getApplicable()) && actualLoss.getRules().stream().anyMatch(PreTreatmentSearchResponse.ActualLossRuleDto::getRequiresRider)) {
            questions.add("비급여 특약 또는 해당 담보 특약에 가입되어 있나요?");
        }
        if (Boolean.TRUE.equals(actualLoss.getNeedsGenerationConfirmation())) {
            questions.add("실손 세대 추정이 필요합니다. 가입 시점과 착한실손/비급여 특약 분리 여부를 확인해주세요.");
        }
        if (Boolean.TRUE.equals(fixedBenefits.getApplicable()) && fixedBenefits.getMatchRuleCount() == 0) {
            questions.add("정액형 담보명에 사용할 추가 키워드가 필요합니다.");
        }
        return questions;
    }

    private String buildMessage(TreatmentRule rule,
                                PreTreatmentSearchResponse.ActualLossResultDto actualLoss,
                                PreTreatmentSearchResponse.FixedBenefitResultDto fixedBenefits) {
        if (Boolean.TRUE.equals(actualLoss.getApplicable()) && Boolean.TRUE.equals(fixedBenefits.getApplicable())) {
            return "실손 후보 룰과 정액형 담보 매칭 기준을 함께 확인했습니다.";
        }
        if (Boolean.TRUE.equals(actualLoss.getApplicable())) {
            return "실손 보장 후보 룰을 확인했습니다.";
        }
        if (Boolean.TRUE.equals(fixedBenefits.getApplicable())) {
            return "정액형 담보 매칭 기준을 확인했습니다.";
        }
        return rule.getCautionMessage() != null ? rule.getCautionMessage() : "검색어 분류를 확인했습니다.";
    }

    private String resolveConfidence(String query, TreatmentRule rule) {
        String normalizedQuery = normalizeForMatch(query);
        if (normalizeForMatch(rule.getKeyword()).equals(normalizedQuery)) {
            return "HIGH";
        }
        boolean synonymExact = splitCsv(rule.getSynonyms()).stream()
                .map(this::normalizeForMatch)
                .anyMatch(synonym -> synonym.equals(normalizedQuery));
        return synonymExact ? "HIGH" : "MEDIUM";
    }

    private void saveSearchLog(PreTreatmentSearchRequest request, PreTreatmentSearchResponse response, boolean aiUsed) {
        if (request == null || request.getUserId() == null) {
            return;
        }
        try {
            PreTreatmentSearch logEntry = PreTreatmentSearch.builder()
                    .userId(request.getUserId())
                    .conditionSearched(response.getQuery())
                    .treatmentName(response.getClassification() != null ? response.getClassification().getKeyword() : null)
                    .estimatedCost(request.getEstimatedCost())
                    .hospitalType(request.getHospitalType())
                    .ruleMatched(Boolean.TRUE.equals(response.getMatched()))
                    .aiUsed(aiUsed)
                    .classificationJson(toJson(response.getClassification()))
                    .build();
            preTreatmentSearchRepository.save(logEntry);
        } catch (Exception e) {
            log.warn("Failed to save pre-treatment search log. userId={}, query={}, error={}",
                    request.getUserId(), response.getQuery(), e.getMessage());
        }
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize pre-treatment classification: {}", e.getMessage());
            return null;
        }
    }

    private PreTreatmentSearchResponse unmatched(String query, String message) {
        return PreTreatmentSearchResponse.builder()
                .query(query)
                .matched(false)
                .matchSource(MATCH_SOURCE_NONE)
                .confidence("NONE")
                .classification(null)
                .actualLoss(PreTreatmentSearchResponse.ActualLossResultDto.builder()
                        .applicable(false)
                        .reason("검색어와 일치하는 DB 룰이 없습니다.")
                        .candidateRuleCount(0)
                        .rules(List.of())
                        .ownedPolicies(List.of())
                        .selectedGenerationCodes(List.of())
                        .selectedRules(List.of())
                        .needsGenerationConfirmation(false)
                        .build())
                .fixedBenefits(PreTreatmentSearchResponse.FixedBenefitResultDto.builder()
                        .applicable(false)
                        .category(null)
                        .matchRuleCount(0)
                        .rules(List.of())
                        .ownedGroups(List.of())
                        .build())
                .nextQuestions(List.of("검색어를 더 구체적으로 입력하거나, 정확한 진단명으로 다시 검색해보세요."))
                .message(message)
                .build();
    }

    private List<String> splitCsv(String value) {
        if (isBlank(value)) {
            return List.of();
        }
        return List.of(value.split(",")).stream()
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
    }

    private boolean sameOrUnknown(String treatmentValue, String ruleValue) {
        return "UNKNOWN".equals(treatmentValue) || Objects.equals(treatmentValue, ruleValue);
    }

    private boolean sameOrMixed(String treatmentValue, String ruleValue) {
        return "UNKNOWN".equals(treatmentValue) || "MIXED".equals(treatmentValue) || Objects.equals(treatmentValue, ruleValue);
    }

    private boolean sameCategory(String treatmentValue, String ruleValue) {
        if (Objects.equals(treatmentValue, ruleValue)) {
            return true;
        }
        if ("NON_COVERED_THREE".equals(treatmentValue)) {
            return "NON_COVERED_THREE".equals(ruleValue);
        }
        if ("DENTAL".equals(treatmentValue)) {
            return ruleValue != null && ruleValue.startsWith("DENTAL");
        }
        if ("KOREAN_MEDICINE".equals(treatmentValue)) {
            return ruleValue != null && ruleValue.startsWith("KOREAN_MEDICINE");
        }
        return false;
    }

    private boolean sameTreatmentCategory(String treatmentCategory, InsuranceBenefitRule benefitRule) {
        String ruleCategory = benefitRule.getTreatmentCategory();
        if (isBlank(treatmentCategory) || "UNKNOWN".equals(treatmentCategory)) {
            return true;
        }
        if ("NON_COVERED_THREE".equals(benefitRule.getActualLossCategory())) {
            return Objects.equals(treatmentCategory, ruleCategory);
        }
        return isBlank(ruleCategory) || "GENERAL".equals(ruleCategory) || Objects.equals(treatmentCategory, ruleCategory);
    }

    private String normalizeInput(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeForMatch(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean containsAny(String target, String... keywords) {
        if (target == null || keywords == null) {
            return false;
        }
        for (String keyword : keywords) {
            String normalizedKeyword = normalizeForMatch(keyword);
            if (!normalizedKeyword.isBlank() && target.contains(normalizedKeyword)) {
                return true;
            }
        }
        return false;
    }

    private String nullToBlank(String value) {
        return value != null ? value : "";
    }

    private int safePriority(Integer priority) {
        return priority != null ? priority : 100;
    }
}
