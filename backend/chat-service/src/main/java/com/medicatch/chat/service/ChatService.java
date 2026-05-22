package com.medicatch.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.chat.client.AnalysisServiceClient;
import com.medicatch.chat.client.HealthServiceClient;
import com.medicatch.chat.client.InsuranceServiceClient;
import com.medicatch.chat.client.OpenAiClient;
import com.medicatch.chat.dto.ChatResponse;
import com.medicatch.chat.entity.ChatHistory;
import com.medicatch.chat.repository.ChatHistoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
public class ChatService {

    private final ChatHistoryRepository chatHistoryRepository;
    private final OpenAiClient openAiClient;
    private final ObjectMapper objectMapper;
    private final HealthServiceClient healthServiceClient;
    private final InsuranceServiceClient insuranceServiceClient;
    private final AnalysisServiceClient analysisServiceClient;

    public ChatService(ChatHistoryRepository chatHistoryRepository,
                       OpenAiClient openAiClient,
                       ObjectMapper objectMapper,
                       HealthServiceClient healthServiceClient,
                       InsuranceServiceClient insuranceServiceClient,
                       AnalysisServiceClient analysisServiceClient) {
        this.chatHistoryRepository = chatHistoryRepository;
        this.openAiClient = openAiClient;
        this.objectMapper = objectMapper;
        this.healthServiceClient = healthServiceClient;
        this.insuranceServiceClient = insuranceServiceClient;
        this.analysisServiceClient = analysisServiceClient;
    }

    public ChatResponse sendMessage(Long userId, String userMessage) {
        log.info("Processing chat message for userId: {}", userId);

        String intentType = detectIntent(userMessage);
        log.info("Detected intent: {}", intentType);

        IntentContext intentContext = buildIntentContext(intentType, userMessage, userId);
        log.debug("Built context for intent {}: dataKeys={}", intentType, intentContext.data.keySet());

        List<ChatHistory> history = loadChatHistory(userId, 10);

        String systemPrompt = buildSystemPrompt(intentContext);
        List<OpenAiClient.Message> messages = buildMessageList(systemPrompt, history, userMessage);

        String aiResponse;
        try {
            aiResponse = openAiClient.chat(messages);
        } catch (Exception e) {
            log.error("AI call failed: {}", e.getMessage());
            aiResponse = "죄송해요. 지금은 AI 응답을 받지 못했어요. 잠시 후 다시 시도해주세요.";
        }

        ChatHistory userChatHistory = ChatHistory.builder()
                .userId(userId)
                .role(ChatHistory.Role.USER)
                .message(userMessage)
                .intentType(intentType)
                .build();
        chatHistoryRepository.save(userChatHistory);

        ChatHistory assistantChatHistory = ChatHistory.builder()
                .userId(userId)
                .role(ChatHistory.Role.ASSISTANT)
                .message(aiResponse)
                .intentType(intentType)
                .contextJson(safeToJson(intentContext.data))
                .build();
        ChatHistory saved = chatHistoryRepository.save(assistantChatHistory);

        return ChatResponse.builder()
                .chatId(saved.getId())
                .message(aiResponse)
                .intentType(intentType)
                .sources(intentContext.sources)
                .relatedData(intentContext.data)
                .createdAt(saved.getCreatedAt())
                .language("ko")
                .build();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getChatHistory(Long userId, int limit) {
        List<ChatHistory> history = chatHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (history.size() > limit) {
            history = history.subList(0, limit);
        }
        Collections.reverse(history);

        List<Map<String, Object>> result = new ArrayList<>();
        for (ChatHistory chat : history) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", chat.getId());
            item.put("role", chat.getRole().toString());
            item.put("message", chat.getMessage());
            item.put("intentType", chat.getIntentType());
            item.put("createdAt", chat.getCreatedAt());
            result.add(item);
        }
        return result;
    }

    public void deleteChatHistory(Long userId) {
        chatHistoryRepository.deleteByUserIdAndCreatedAtBefore(
                userId, LocalDateTime.of(2099, 12, 31, 23, 59));
    }

    private List<ChatHistory> loadChatHistory(Long userId, int limit) {
        List<ChatHistory> history = chatHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (history.size() > limit) {
            history = history.subList(0, limit);
        }
        Collections.reverse(history);
        return history;
    }

    // ── 의도 분류 ─────────────────────────────────────────────────
    private String detectIntent(String message) {
        String m = message.toLowerCase();

        if (m.contains("도수치료") || m.contains("mri") || m.contains("치아") ||
                m.contains("주사") || m.contains("수술") || m.contains("치료") && m.contains("보장")) {
            return "PRE_TREATMENT";
        }
        if (m.contains("보장") || m.contains("보험") || m.contains("공백") ||
                m.contains("부족") || m.contains("실손") || m.contains("청구") || m.contains("보험금")) {
            return "COVERAGE";
        }
        if (m.contains("위험") || m.contains("건강나이") || m.contains("질병") ||
                m.contains("당뇨") || m.contains("뇌졸중") || m.contains("심뇌혈관")) {
            return "HEALTH_RISK";
        }
        if (m.contains("검진") || m.contains("검사") || m.contains("혈압") ||
                m.contains("콜레스테롤") || m.contains("혈당")) {
            return "CHECKUP";
        }
        if (m.contains("진료") || m.contains("병원") || m.contains("처방") || m.contains("약")) {
            return "MEDICAL_RECORD";
        }
        return "GENERAL";
    }

    // ── 의도별 컨텍스트 빌드 (DB/API가 먼저 "판정") ────────────────
    private IntentContext buildIntentContext(String intentType, String userMessage, Long userId) {
        IntentContext ctx = new IntentContext();
        try {
            switch (intentType) {
                case "PRE_TREATMENT" -> {
                    Map<String, Object> result = analysisServiceClient.searchPreTreatment(
                            Map.of("query", userMessage));
                    ctx.data.put("preTreatmentResult", result);
                    ctx.sources.add("진료 전 검색 룰");
                    addPoliciesContext(ctx);
                }
                case "COVERAGE" -> {
                    addPoliciesContext(ctx);
                    addCoverageGapsContext(ctx);
                }
                case "HEALTH_RISK" -> {
                    safeCall(() -> ctx.data.put("diseasePredictions",
                            summarizePredictions(healthServiceClient.getDiseasePredictions(userId))));
                    safeCall(() -> ctx.data.put("healthAge",
                            summarizeHealthAge(healthServiceClient.getHealthAge(userId))));
                    ctx.sources.add("질병 위험 예측");
                    ctx.sources.add("건강나이 데이터");
                }
                case "CHECKUP" -> {
                    safeCall(() -> ctx.data.put("checkupResults",
                            summarizeCheckups(healthServiceClient.getCheckupResults(userId))));
                    ctx.sources.add("건강검진 데이터");
                }
                case "MEDICAL_RECORD" -> {
                    safeCall(() -> ctx.data.put("medicalRecords",
                            summarizeRecords(healthServiceClient.getMedicalRecords(userId))));
                    ctx.sources.add("진료 기록");
                }
                default -> {
                    addPoliciesContext(ctx);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to build context for intent {}: {}", intentType, e.getMessage());
        }
        return ctx;
    }

    private void addPoliciesContext(IntentContext ctx) {
        safeCall(() -> {
            List<Map<String, Object>> policies = insuranceServiceClient.getActivePolicies();
            ctx.data.put("policies", summarizePolicies(policies));
            ctx.sources.add("내 보험 데이터");
        });
    }

    private void addCoverageGapsContext(IntentContext ctx) {
        safeCall(() -> {
            List<Map<String, Object>> comparison = insuranceServiceClient.getCoverageComparison();
            List<Map<String, Object>> gaps = comparison.stream()
                    .filter(this::isGap)
                    .limit(10)
                    .collect(Collectors.toList());
            ctx.data.put("coverageGaps", gaps);
            ctx.sources.add("보장 비교 결과");
        });
    }

    private boolean isGap(Map<String, Object> row) {
        double self = toDouble(row.getOrDefault("selfCoverageAmount", row.get("self_coverage_amount")));
        double avg = toDouble(row.getOrDefault("avgGroupCoverageAmount", row.get("avg_group_coverage_amount")));
        if (avg <= 0) return false;
        return self < avg * 0.8;
    }

    private double toDouble(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return 0; }
    }

    // ── 데이터 요약 (토큰 절약 + 핵심 추출) ──────────────────────
    private List<Map<String, Object>> summarizePolicies(List<Map<String, Object>> policies) {
        if (policies == null) return List.of();
        return policies.stream().limit(10).map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("회사", p.getOrDefault("companyName", p.get("insurer_name")));
            m.put("상품", p.getOrDefault("productName", p.get("policy_details")));
            m.put("유형", p.getOrDefault("policyType", p.get("insurance_type")));
            m.put("월보험료", p.getOrDefault("monthlyPremium", p.get("monthly_premium")));
            return m;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> summarizePredictions(List<Map<String, Object>> preds) {
        if (preds == null) return List.of();
        Map<String, Map<String, Object>> latest = new HashMap<>();
        for (Map<String, Object> p : preds) {
            String type = String.valueOf(p.get("predictionType"));
            Object date = p.get("checkupDate");
            Map<String, Object> existing = latest.get(type);
            if (existing == null || (date != null && date.toString().compareTo(
                    String.valueOf(existing.get("checkupDate"))) > 0)) {
                latest.put(type, p);
            }
        }
        return latest.values().stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", p.get("predictionType"));
            m.put("grade", p.getOrDefault("riskGrade", p.get("grade")));
            m.put("ratio", p.get("riskRatio"));
            return m;
        }).collect(Collectors.toList());
    }

    private Map<String, Object> summarizeHealthAge(Map<String, Object> hAge) {
        if (hAge == null) return Map.of();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("건강나이", hAge.get("biologicalAge"));
        m.put("실제나이", hAge.get("chronologicalAge"));
        m.put("요약", hAge.get("summaryNote"));
        return m;
    }

    private List<Map<String, Object>> summarizeCheckups(List<Map<String, Object>> checkups) {
        if (checkups == null) return List.of();
        return checkups.stream().limit(3).map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("검진일", c.get("checkupDate"));
            m.put("이상소견", c.get("abnormalFindings"));
            m.put("권고사항", c.get("recommendations"));
            return m;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> summarizeRecords(List<Map<String, Object>> records) {
        if (records == null) return List.of();
        return records.stream().limit(15).map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("일자", r.getOrDefault("visitDate", r.get("visit_date")));
            m.put("병원", r.getOrDefault("hospitalName", r.get("hospital")));
            m.put("진료과", r.get("department"));
            m.put("진단", r.get("diagnosis"));
            return m;
        }).collect(Collectors.toList());
    }

    // ── 시스템 프롬프트 ─────────────────────────────────────────
    private String buildSystemPrompt(IntentContext ctx) {
        String dataBlock = ctx.data.isEmpty()
                ? "(첨부된 사용자 데이터 없음)"
                : safeToJson(ctx.data);

        return """
                당신은 MediCatch의 건강·보험 데이터 안내 어시스턴트입니다.

                규칙:
                1. 아래 첨부된 사용자 데이터(JSON)에 있는 사실만 인용하세요.
                2. 데이터에 없는 보험사명, 보장 한도, 금액, 보장 가능 여부는 절대 만들어내지 마세요.
                3. 의학적 진단·치료 권고를 하지 마세요. ("증상이 있다면 전문의와 상의" 정도까지 OK)
                4. 보험 상품을 추천하거나 가입을 유도하지 마세요.
                5. 데이터로 알 수 없는 부분은 "확인이 필요해요" 또는 "데이터가 부족합니다"로 안내하세요.
                6. 답변은 한국어, 200~400자 정도로 친근하고 간결하게.
                7. 금액·보장 비율 등 숫자는 첨부 데이터에 있는 수치만 사용하세요.

                === 첨부된 사용자 데이터 ===
                %s
                === 데이터 끝 ===

                위 데이터를 사용자가 이해하기 쉬운 자연어로 설명하세요.
                """.formatted(dataBlock);
    }

    private List<OpenAiClient.Message> buildMessageList(String systemPrompt,
                                                       List<ChatHistory> history,
                                                       String userMessage) {
        List<OpenAiClient.Message> messages = new ArrayList<>();
        messages.add(new OpenAiClient.Message("system", systemPrompt));
        for (ChatHistory chat : history) {
            String role = chat.getRole() == ChatHistory.Role.USER ? "user" : "assistant";
            messages.add(new OpenAiClient.Message(role, chat.getMessage()));
        }
        messages.add(new OpenAiClient.Message("user", userMessage));
        return messages;
    }

    private String safeToJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); }
        catch (Exception e) { return "{}"; }
    }

    private void safeCall(Runnable r) {
        try { r.run(); }
        catch (Exception e) { log.warn("Feign call failed: {}", e.getMessage()); }
    }

    // ── 내부 컨텍스트 객체 ────────────────────────────────────────
    private static class IntentContext {
        final Map<String, Object> data = new LinkedHashMap<>();
        final List<String> sources = new ArrayList<>();
    }
}
