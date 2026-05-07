package com.medicatch.analysis.client;

import com.medicatch.analysis.dto.MedicalRecordInfo;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "health-service")
public interface HealthServiceClient {

    @GetMapping("/api/health/medical-records")
    List<MedicalRecordInfo> getMedicalRecords(@RequestParam("userId") Long userId);
}
