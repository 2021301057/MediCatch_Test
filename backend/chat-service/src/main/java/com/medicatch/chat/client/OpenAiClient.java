package com.medicatch.chat.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class OpenAiClient {

    @Value("${openai.api-key:}")
    private String openaiApiKey;

    @Value("${openai.model:gpt-4o}")
    private String openaiModel;

    @Value("${openai.base-url:https://api.openai.com/v1}")
    private String openaiBaseUrl;

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OpenAiClient() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                .build();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Call OpenAI Chat Completions API
     *
     * @param messages List of messages in conversation
     * @return AI response text
     */
    public String chat(List<Message> messages) {
        log.info("Calling OpenAI API with {} messages", messages.size());

        try {
            // Build request body
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", openaiModel);
            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.7);
            requestBody.put("top_p", 0.9);
            requestBody.put("max_tokens", 2000);
            requestBody.put("presence_penalty", 0.6);
            requestBody.put("frequency_penalty", 0.5);

            String jsonBody = objectMapper.writeValueAsString(requestBody);

            // Create request
            RequestBody body = RequestBody.create(jsonBody, MediaType.get("application/json; charset=utf-8"));

            Request request = new Request.Builder()
                    .url(openaiBaseUrl + "/chat/completions")
                    .header("Authorization", "Bearer " + openaiApiKey)
                    .header("Content-Type", "application/json")
                    .post(body)
                    .build();

            // Execute request
            Response response = httpClient.newCall(request).execute();

            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "Unknown error";
                log.error("OpenAI API error: {} - {}", response.code(), errorBody);
                throw new RuntimeException("OpenAI API error: " + response.code());
            }

            // Parse response
            String responseBody = response.body().string();
            log.debug("OpenAI API response received");

            return extractMessageFromResponse(responseBody);

        } catch (IOException e) {
            log.error("Failed to call OpenAI API: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to call OpenAI API", e);
        } catch (Exception e) {
            log.error("Unexpected error in OpenAI API call: {}", e.getMessage(), e);
            throw new RuntimeException("Unexpected error in OpenAI API call", e);
        }
    }

    /**
     * Extract message text from OpenAI response
     */
    private String extractMessageFromResponse(String responseJson) {
        try {
            Map<String, Object> response = objectMapper.readValue(responseJson, Map.class);

            if (response.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> firstChoice = choices.get(0);
                    if (firstChoice.containsKey("message")) {
                        Map<String, String> message = (Map<String, String>) firstChoice.get("message");
                        return message.get("content");
                    }
                }
            }

            log.warn("Could not extract message from OpenAI response");
            return "죄송합니다. 응답을 처리할 수 없었습니다.";

        } catch (Exception e) {
            log.error("Failed to parse OpenAI response: {}", e.getMessage(), e);
            return "죄송합니다. 응답 처리 중 오류가 발생했습니다.";
        }
    }

    /**
     * Represents a message in the conversation
     */
    public static class Message {
        public String role;  // "system", "user", or "assistant"
        public String content;

        public Message(String role, String content) {
            this.role = role;
            this.content = content;
        }

        // Getters for Jackson serialization
        public String getRole() {
            return role;
        }

        public String getContent() {
            return content;
        }
    }
}
