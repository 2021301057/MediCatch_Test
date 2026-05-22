package com.medicatch.chat.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;
import java.util.Map;

@FeignClient(name = "health-service", path = "/api/health")
public interface HealthServiceClient {

    @GetMapping("/medical-records")
    List<Map<String, Object>> getMedicalRecords();

    @GetMapping("/checkup-results")
    List<Map<String, Object>> getCheckupResults();

    @GetMapping("/disease-predictions")
    List<Map<String, Object>> getDiseasePredictions();

    @GetMapping("/health-age")
    Map<String, Object> getHealthAge();
}
