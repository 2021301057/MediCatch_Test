package com.medicatch.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Slf4j
@Service
public class InternalDeleteClient {

    private static final String HEALTH_URL   = "http://health-service:8002";
    private static final String INSURANCE_URL = "http://insurance-service:8003";
    private static final String ANALYSIS_URL  = "http://analysis-service:8004";
    private static final String CHAT_URL      = "http://chat-service:8007";

    private final WebClient webClient;

    public InternalDeleteClient(WebClient.Builder builder) {
        this.webClient = builder.build();
    }

    public void deleteHealthData(Long userId) {
        callDelete(HEALTH_URL, userId, "건강");
    }

    public void deleteInsuranceData(Long userId) {
        callDelete(INSURANCE_URL, userId, "보험");
    }

    public void deleteAnalysisData(Long userId) {
        callDelete(ANALYSIS_URL, userId, "분석");
    }

    public void deleteChatData(Long userId) {
        callDelete(CHAT_URL, userId, "채팅");
    }

    private void callDelete(String baseUrl, Long userId, String serviceName) {
        try {
            webClient.delete()
                    .uri(baseUrl + "/internal/users/{userId}", userId)
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            log.info("{} 데이터 삭제 완료 - userId: {}", serviceName, userId);
        } catch (Exception e) {
            log.warn("{} 데이터 삭제 실패 (탈퇴는 계속 진행) - userId: {}, error: {}",
                    serviceName, userId, e.getMessage());
        }
    }
}
