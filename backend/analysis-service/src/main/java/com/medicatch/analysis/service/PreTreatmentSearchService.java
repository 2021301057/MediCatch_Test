package com.medicatch.analysis.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private static final String MATCH_SOURCE_DB_RULE = "DB_RULE";
    private static final String MATCH_SOURCE_NONE = "NONE";

    private final TreatmentRuleRepository treatmentRuleRepository;
    private final InsuranceBenefitRuleRepository insuranceBenefitRuleRepository;
    private final FixedBenefitMatchRuleRepository fixedBenefitMatchRuleRepository;
    private final PreTreatmentSearchRepository preTreatmentSearchRepository;
    private final ObjectMapper objectMapper;

    public PreTreatmentSearchService(TreatmentRuleRepository treatmentRuleRepository,
                                     InsuranceBenefitRuleRepository insuranceBenefitRuleRepository,
                                     FixedBenefitMatchRuleRepository fixedBenefitMatchRuleRepository,
                                     PreTreatmentSearchRepository preTreatmentSearchRepository,
                                     ObjectMapper objectMapper) {
        this.treatmentRuleRepository = treatmentRuleRepository;
        this.insuranceBenefitRuleRepository = insuranceBenefitRuleRepository;
        this.fixedBenefitMatchRuleRepository = fixedBenefitMatchRuleRepository;
        this.preTreatmentSearchRepository = preTreatmentSearchRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public PreTreatmentSearchResponse searchPreTreatment(PreTreatmentSearchRequest request) {
        String query = request != null ? normalizeInput(request.getQuery()) : "";
        if (query.isBlank()) {
            return unmatched("", "검색어를 입력해주세요.");
        }

        Optional<TreatmentRule> matchedRule = findBestTreatmentRule(query);
        if (matchedRule.isEmpty()) {
            PreTreatmentSearchResponse response = unmatched(query, "DB 룰에서 일치하는 진료/보장 기준을 찾지 못했습니다.");
            saveSearchLog(request, response);
            return response;
        }

        TreatmentRule rule = matchedRule.get();
        PreTreatmentSearchResponse.TreatmentClassificationDto classification = toClassificationDto(rule);
        PreTreatmentSearchResponse.ActualLossResultDto actualLoss = buildActualLossResult(rule);
        PreTreatmentSearchResponse.FixedBenefitResultDto fixedBenefits = buildFixedBenefitResult(rule);
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

        saveSearchLog(request, response);
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

    private Optional<TreatmentRule> findBestTreatmentRule(String query) {
        String normalizedQuery = normalizeForMatch(query);
        List<TreatmentRule> rules = treatmentRuleRepository.findByIsActiveOrderByPriorityAsc(true);

        return rules.stream()
                .filter(rule -> matchesRule(normalizedQuery, rule))
                .min(Comparator.comparingInt(this::matchRank).thenComparing(rule -> safePriority(rule.getPriority())));
    }

    private boolean matchesRule(String normalizedQuery, TreatmentRule rule) {
        String keyword = normalizeForMatch(rule.getKeyword());
        if (!keyword.isBlank() && (keyword.equals(normalizedQuery)
                || keyword.contains(normalizedQuery)
                || normalizedQuery.contains(keyword))) {
            return true;
        }

        return splitCsv(rule.getSynonyms()).stream()
                .map(this::normalizeForMatch)
                .anyMatch(synonym -> !synonym.isBlank()
                        && (synonym.equals(normalizedQuery)
                        || synonym.contains(normalizedQuery)
                        || normalizedQuery.contains(synonym)));
    }

    private int matchRank(TreatmentRule rule) {
        return safePriority(rule.getPriority());
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

    private PreTreatmentSearchResponse.ActualLossResultDto buildActualLossResult(TreatmentRule rule) {
        if (isBlank(rule.getActualLossCategory())) {
            return PreTreatmentSearchResponse.ActualLossResultDto.builder()
                    .applicable(false)
                    .reason("정액형 담보 확인 중심 검색어입니다.")
                    .candidateRuleCount(0)
                    .rules(List.of())
                    .build();
        }

        List<InsuranceBenefitRule> candidates = insuranceBenefitRuleRepository.findByIsActiveOrderByPriorityAsc(true).stream()
                .filter(benefitRule -> sameOrUnknown(rule.getCareType(), benefitRule.getCareType()))
                .filter(benefitRule -> sameOrMixed(rule.getBenefitType(), benefitRule.getBenefitType()))
                .filter(benefitRule -> sameCategory(rule.getActualLossCategory(), benefitRule.getActualLossCategory()))
                .toList();

        return PreTreatmentSearchResponse.ActualLossResultDto.builder()
                .applicable(true)
                .reason(candidates.isEmpty() ? "일치하는 실손 세대별 룰 후보가 없습니다." : "실손 세대별 후보 룰을 확인했습니다.")
                .candidateRuleCount(candidates.size())
                .rules(candidates.stream().map(this::toActualLossRuleDto).toList())
                .build();
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

    private PreTreatmentSearchResponse.FixedBenefitResultDto buildFixedBenefitResult(TreatmentRule rule) {
        if (isBlank(rule.getFixedBenefitCategory())) {
            return PreTreatmentSearchResponse.FixedBenefitResultDto.builder()
                    .applicable(false)
                    .category(null)
                    .matchRuleCount(0)
                    .rules(List.of())
                    .build();
        }

        String category = rule.getFixedBenefitCategory();
        List<FixedBenefitMatchRule> rules = fixedBenefitMatchRuleRepository.findByIsActiveOrderByPriorityAsc(true).stream()
                .filter(matchRule -> matchesFixedBenefitCategory(category, matchRule.getFixedBenefitCategory()))
                .toList();

        return PreTreatmentSearchResponse.FixedBenefitResultDto.builder()
                .applicable(true)
                .category(category)
                .matchRuleCount(rules.size())
                .rules(rules.stream().map(this::toFixedBenefitRuleDto).toList())
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

    private void saveSearchLog(PreTreatmentSearchRequest request, PreTreatmentSearchResponse response) {
        if (request == null || request.getUserId() == null) {
            return;
        }

        PreTreatmentSearch logEntry = PreTreatmentSearch.builder()
                .userId(request.getUserId())
                .conditionSearched(response.getQuery())
                .treatmentName(response.getClassification() != null ? response.getClassification().getKeyword() : null)
                .estimatedCost(request.getEstimatedCost())
                .hospitalType(request.getHospitalType())
                .ruleMatched(Boolean.TRUE.equals(response.getMatched()))
                .aiUsed(false)
                .classificationJson(toJson(response.getClassification()))
                .build();
        preTreatmentSearchRepository.save(logEntry);
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
                        .build())
                .fixedBenefits(PreTreatmentSearchResponse.FixedBenefitResultDto.builder()
                        .applicable(false)
                        .category(null)
                        .matchRuleCount(0)
                        .rules(List.of())
                        .build())
                .nextQuestions(List.of("검색어를 더 구체적으로 입력하거나, DB 룰 또는 OpenAI 분류 보강이 필요합니다."))
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
        return false;
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

    private int safePriority(Integer priority) {
        return priority != null ? priority : 100;
    }
}
