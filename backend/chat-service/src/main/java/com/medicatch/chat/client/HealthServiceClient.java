package com.medicatch.chat.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

@FeignClient(name = "health-service", path = "/api/health")
public interface HealthServiceClient {

    @GetMapping("/medical-records")
    List<Map<String, Object>> getMedicalRecords(@RequestParam("userId") Long userId);

    @GetMapping("/checkup-results")
    List<Map<String, Object>> getCheckupResults(@RequestParam("userId") Long userId);

    @GetMapping("/disease-predictions")
    List<Map<String, Object>> getDiseasePredictions(@RequestParam("userId") Long userId);

    @GetMapping("/health-age")
    Map<String, Object> getHealthAge(@RequestParam("userId") Long userId);
}
