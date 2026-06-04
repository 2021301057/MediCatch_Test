package com.medicatch.insurance.controller;

import com.medicatch.insurance.repository.ClaimPaymentRepository;
import com.medicatch.insurance.repository.CoverageComparisonRepository;
import com.medicatch.insurance.repository.PolicyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/internal")
public class InternalController {

    private final PolicyRepository policyRepository;
    private final ClaimPaymentRepository claimPaymentRepository;
    private final CoverageComparisonRepository coverageComparisonRepository;

    public InternalController(PolicyRepository policyRepository,
                              ClaimPaymentRepository claimPaymentRepository,
                              CoverageComparisonRepository coverageComparisonRepository) {
        this.policyRepository = policyRepository;
        this.claimPaymentRepository = claimPaymentRepository;
        this.coverageComparisonRepository = coverageComparisonRepository;
    }

    @DeleteMapping("/users/{userId}")
    @Transactional
    public ResponseEntity<Map<String, String>> deleteUserData(@PathVariable Long userId) {
        log.info("DELETE /internal/users/{} - 보험 데이터 전체 삭제", userId);
        claimPaymentRepository.deleteByUserId(userId);
        coverageComparisonRepository.deleteByUserId(userId);
        policyRepository.deleteByUserId(userId);
        log.info("보험 데이터 삭제 완료 - userId: {}", userId);
        return ResponseEntity.ok(Map.of("message", "보험 데이터가 삭제되었습니다."));
    }
}
