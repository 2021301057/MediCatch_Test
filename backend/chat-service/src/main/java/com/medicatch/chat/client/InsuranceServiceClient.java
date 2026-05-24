package com.medicatch.chat.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

@FeignClient(name = "insurance-service", path = "/api/insurance")
public interface InsuranceServiceClient {

    @GetMapping("/policies")
    List<Map<String, Object>> getActivePolicies(@RequestParam("userId") Long userId);

    @GetMapping("/coverage-comparison")
    List<Map<String, Object>> getCoverageComparison(@RequestParam("userId") Long userId);
}
