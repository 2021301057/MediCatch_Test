package com.medicatch.health.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class CodefHealthService {

    @Value("${codef.api-url:https://api.codef.io/v1}")
    private String codefApiUrl;

    private final WebClient webClient;

    public CodefHealthService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    /**
     * Get health information from CODEF (medical records)
     */
    public Map<String, Object> getHealthInfoFromCodef(Long userId, String connectedId, String accessToken) {
        log.info("Fetching health info from CODEF for userId: {}", userId);

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("connectedId", connectedId);

            // Call CODEF API for health data
            String response = webClient.get()
                    .uri(codefApiUrl + "/health/medical-records")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.debug("CODEF health data retrieved");
            return parseCodefResponse(response);

        } catch (Exception e) {
            log.error("Failed to get health info from CODEF: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch CODEF health data", e);
        }
    }

    /**
     * Get checkup results from CODEF
     */
    public Map<String, Object> getCheckupDataFromCodef(Long userId, String connectedId, String accessToken) {
        log.info("Fetching checkup data from CODEF for userId: {}", userId);

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("connectedId", connectedId);

            String response = webClient.get()
                    .uri(codefApiUrl + "/health/checkup-results")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.debug("CODEF checkup data retrieved");
            return parseCodefResponse(response);

        } catch (Exception e) {
            log.error("Failed to get checkup data from CODEF: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch CODEF checkup data", e);
        }
    }

    /**
     * Sync health data from CODEF
     */
    public void syncHealthDataFromCodef(Long userId, String connectedId, String accessToken) {
        log.info("Syncing health data from CODEF for userId: {}", userId);

        try {
            // Fetch and process medical records
            Map<String, Object> healthData = getHealthInfoFromCodef(userId, connectedId, accessToken);
            log.info("Synced medical records for userId: {}", userId);

            // Fetch and process checkup results
            Map<String, Object> checkupData = getCheckupDataFromCodef(userId, connectedId, accessToken);
            log.info("Synced checkup results for userId: {}", userId);

        } catch (Exception e) {
            log.error("Failed to sync health data from CODEF: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to sync CODEF health data", e);
        }
    }

    private Map<String, Object> parseCodefResponse(String response) {
        Map<String, Object> result = new HashMap<>();
        try {
            // In production, use ObjectMapper to parse JSON response
            result.put("data", response);
            result.put("status", "success");
        } catch (Exception e) {
            log.error("Failed to parse CODEF response: {}", e.getMessage());
            result.put("status", "failed");
        }
        return result;
    }
}
