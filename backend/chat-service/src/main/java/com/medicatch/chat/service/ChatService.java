package com.medicatch.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.chat.client.OpenAiClient;
import com.medicatch.chat.dto.ChatResponse;
import com.medicatch.chat.entity.ChatHistory;
import com.medicatch.chat.repository.ChatHistoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@Transactional
public class ChatService {

    private final ChatHistoryRepository chatHistoryRepository;
    private final OpenAiClient openAiClient;
    private final ObjectMapper objectMapper;

    public ChatService(ChatHistoryRepository chatHistoryRepository,
                       OpenAiClient openAiClient,
                       ObjectMapper objectMapper) {
        this.chatHistoryRepository = chatHistoryRepository;
        this.openAiClient = openAiClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Send message and get AI response
     * Complete flow:
     * 1. Load chat history
     * 2. Build system prompt with user context
     * 3. Call OpenAI API
     * 4. Save to database
     * 5. Return response
     */
    public ChatResponse sendMessage(Long userId, String userMessage) {
        log.info("Processing chat message for userId: {}", userId);

        try {
            // Step 1: Load chat history (last 10 messages)
            List<ChatHistory> history = loadChatHistory(userId, 10);
            log.debug("Loaded {} messages from chat history", history.size());

            // Step 2: Load user context (health, insurance)
            Map<String, String> userContext = buildUserContext(userId);

            // Step 3: Build system prompt with user context
            String systemPrompt = buildSystemPrompt(userContext);

            // Step 4: Build messages for OpenAI
            List<OpenAiClient.Message> messages = buildMessageList(systemPrompt, history, userMessage);

            // Step 5: Call OpenAI API
            log.info("Calling OpenAI API");
            String aiResponse = openAiClient.chat(messages);

            // Step 6: Detect intent from user message
            String intentType = detectIntent(userMessage);

            // Step 7: Save user message to history
            ChatHistory userChatHistory = ChatHistory.builder()
                    .userId(userId)
                    .role(ChatHistory.Role.USER)
                    .message(userMessage)
                    .intentType(intentType)
                    .build();
            chatHistoryRepository.save(userChatHistory);
            log.debug("Saved user message to history");

            // Step 8: Save AI response to history
            ChatHistory assistantChatHistory = ChatHistory.builder()
                    .userId(userId)
                    .role(ChatHistory.Role.ASSISTANT)
                    .message(aiResponse)
                    .intentType(intentType)
                    .contextJson(objectMapper.writeValueAsString(userContext))
                    .build();
            ChatHistory savedAssistantMessage = chatHistoryRepository.save(assistantChatHistory);
            log.debug("Saved assistant message to history: {}", savedAssistantMessage.getId());

            // Step 9: Build response
            Map<String, Object> relatedData = buildRelatedData(userId, intentType, userContext);

            ChatResponse response = ChatResponse.builder()
                    .chatId(savedAssistantMessage.getId())
                    .message(aiResponse)
                    .intentType(intentType)
                    .relatedData(relatedData)
                    .createdAt(savedAssistantMessage.getCreatedAt())
                    .language("ko")
                    .build();

            log.info("Chat response generated successfully");
            return response;

        } catch (Exception e) {
            log.error("Error processing chat message: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to process chat message", e);
        }
    }

    /**
     * Get chat history for user
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getChatHistory(Long userId, int limit) {
        log.info("Retrieving chat history for userId: {}, limit: {}", userId, limit);

        List<ChatHistory> history = chatHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (history.size() > limit) {
            history = history.subList(0, limit);
        }

        // Reverse to get chronological order
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

    /**
     * Delete chat history
     */
    public void deleteChatHistory(Long userId) {
        log.info("Deleting all chat history for userId: {}", userId);
        chatHistoryRepository.deleteByUserIdAndCreatedAtBefore(userId, LocalDateTime.of(2099, 12, 31, 23, 59));
    }

    /**
     * Load chat history from database
     */
    private List<ChatHistory> loadChatHistory(Long userId, int limit) {
        List<ChatHistory> history = chatHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (history.size() > limit) {
            history = history.subList(0, limit);
        }
        Collections.reverse(history);
        return history;
    }

    /**
     * Build user context (mock implementation)
     * In production, would call health-service and insurance-service via Feign
     */
    private Map<String, String> buildUserContext(Long userId) {
        Map<String, String> context = new HashMap<>();
        context.put("name", "김건강");
        context.put("age", "35");
        context.put("healthAge", "32");
        context.put("insuranceSummary", "국민건강보험 가입자, 월 보험료 약 150,000원");
        context.put("riskSummary", "혈당 위험도 중간 (Glucose: 110 mg/dL), 콜레스테롤 정상");

        return context;
    }

    /**
     * Build system prompt with user context
     */
    private String buildSystemPrompt(Map<String, String> userContext) {
        return """
                당신은 MediCatch의 건강보험 전문 AI 어시스턴트입니다.
                한국의 건강보험 제도, 보장 범위, 청구 절차에 대해 전문 지식을 가지고 있습니다.

                사용자 정보:
                - 이름: %s
                - 나이: %s세
                - 건강나이: %s세
                - 가입 보험: %s
                - 건강 위험도: %s

                다음 규칙을 따르세요:
                1. 항상 한국어로 답변하세요
                2. 보험 보장 여부를 물어보면 구체적인 금액과 조건을 안내하세요
                3. 의료 서비스 이용 시 받을 수 있는 보험금을 설명해주세요
                4. 의학적 진단이나 치료 권고는 하지 마세요
                5. 답변은 간결하고(200자 이내), 친근하고 따뜻하게 작성하세요
                6. 구체적인 금액이나 비율은 항상 예시임을 명시하세요

                사용자의 개인 정보 보호를 최우선으로 합니다.
                """.formatted(
                userContext.get("name"),
                userContext.get("age"),
                userContext.get("healthAge"),
                userContext.get("insuranceSummary"),
                userContext.get("riskSummary")
        );
    }

    /**
     * Build message list for OpenAI API
     */
    private List<OpenAiClient.Message> buildMessageList(String systemPrompt,
                                                        List<ChatHistory> history,
                                                        String userMessage) {
        List<OpenAiClient.Message> messages = new ArrayList<>();

        // Add system prompt
        messages.add(new OpenAiClient.Message("system", systemPrompt));

        // Add conversation history
        for (ChatHistory chat : history) {
            String role = chat.getRole() == ChatHistory.Role.USER ? "user" : "assistant";
            messages.add(new OpenAiClient.Message(role, chat.getMessage()));
        }

        // Add current user message
        messages.add(new OpenAiClient.Message("user", userMessage));

        return messages;
    }

    /**
     * Detect intent from user message
     */
    private String detectIntent(String message) {
        String lowerMessage = message.toLowerCase();

        if (lowerMessage.contains("보장") || lowerMessage.contains("coverage") ||
                lowerMessage.contains("커버") || lowerMessage.contains("보험금")) {
            return "INSURANCE_COVERAGE";
        } else if (lowerMessage.contains("건강") || lowerMessage.contains("health") ||
                lowerMessage.contains("증상") || lowerMessage.contains("질병")) {
            return "HEALTH_INFO";
        } else if (lowerMessage.contains("청구") || lowerMessage.contains("claim") ||
                lowerMessage.contains("비용") || lowerMessage.contains("의료비")) {
            return "CLAIM_PROCESS";
        } else if (lowerMessage.contains("검진") || lowerMessage.contains("검사") ||
                lowerMessage.contains("screening")) {
            return "CHECKUP_INFO";
        } else if (lowerMessage.contains("약") || lowerMessage.contains("약물") ||
                lowerMessage.contains("medication")) {
            return "MEDICATION_INFO";
        }

        return "GENERAL_INQUIRY";
    }

    /**
     * Build related data to return with response
     */
    private Map<String, Object> buildRelatedData(Long userId, String intentType, Map<String, String> userContext) {
        Map<String, Object> relatedData = new HashMap<>();

        switch (intentType) {
            case "INSURANCE_COVERAGE" -> {
                relatedData.put("coverageItems", List.of(
                        Map.of("item", "외래 진료", "coverage", "80%"),
                        Map.of("item", "입원", "coverage", "90%"),
                        Map.of("item", "약물", "coverage", "70%")
                ));
                relatedData.put("lastUpdated", LocalDateTime.now());
            }
            case "HEALTH_INFO" -> {
                relatedData.put("riskLevel", "MEDIUM");
                relatedData.put("recommendations", List.of("정기적인 혈당 검사", "운동 습관 개선"));
            }
            case "CLAIM_PROCESS" -> {
                relatedData.put("steps", List.of(
                        "1. 병원 방문 및 진료",
                        "2. 의료비 영수증 보관",
                        "3. 청구서 작성",
                        "4. 보험사 제출"
                ));
            }
            default -> {
                relatedData.put("type", intentType);
            }
        }

        return relatedData;
    }
}
