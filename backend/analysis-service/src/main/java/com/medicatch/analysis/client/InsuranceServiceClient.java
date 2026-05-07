package com.medicatch.analysis.client;

import com.medicatch.analysis.dto.ClaimPaymentInfo;
import com.medicatch.analysis.dto.PolicyInfo;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "insurance-service")
public interface InsuranceServiceClient {

    @GetMapping("/api/insurance/policies")
    List<PolicyInfo> getActivePolicies(@RequestParam("userId") Long userId);

    @GetMapping("/api/insurance/claim-payments")
    List<ClaimPaymentInfo> getClaimPayments(@RequestParam("userId") Long userId);
}
