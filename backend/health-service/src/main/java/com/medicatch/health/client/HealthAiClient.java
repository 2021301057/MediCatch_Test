package com.medicatch.health.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class HealthAiClient {
    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:llama-3.3-70b-versatile}")
    private String model;

    @Value("${ai.base-url:https://api.groq.com/openai/v1}")
    private String baseUrl;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper;

    public HealthAiClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String completeJson(String systemPrompt, String userPrompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("AI API key is not configured");
        }
        try {
            String url = baseUrl.replaceAll("/+$", "") + "/chat/completions";
            String body = objectMapper.writeValueAsString(Map.of(
                    "model", model,
                    "temperature", 0.3,
                    "max_tokens", 900,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            ));
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(35))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("AI provider returned HTTP " + response.statusCode());
            }
            JsonNode content = objectMapper.readTree(response.body()).path("choices").path(0)
                    .path("message").path("content");
            if (!content.isTextual() || content.asText().isBlank()) {
                throw new IllegalStateException("AI provider returned an empty response");
            }
            return content.asText();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("AI request was interrupted", e);
        } catch (Exception e) {
            throw new IllegalStateException("Could not generate health guidance", e);
        }
    }

    public String getModel() {
        return model;
    }
}
