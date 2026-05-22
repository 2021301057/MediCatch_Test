package com.medicatch.chat.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "analysis-service", path = "/api/analysis")
public interface AnalysisServiceClient {

    @PostMapping("/pre-treatment-search")
    Map<String, Object> searchPreTreatment(@RequestBody Map<String, Object> body);
}
