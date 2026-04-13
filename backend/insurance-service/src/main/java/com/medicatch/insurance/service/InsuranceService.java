package com.medicatch.insurance.service;

import com.medicatch.insurance.entity.CoverageItem;
import com.medicatch.insurance.entity.Policy;
import com.medicatch.insurance.repository.CoverageItemRepository;
import com.medicatch.insurance.repository.PolicyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Transactional
public class InsuranceService {

    private final PolicyRepository policyRepository;
    private final CoverageItemRepository coverageItemRepository;

    public InsuranceService(PolicyRepository policyRepository,
                            CoverageItemRepository coverageItemRepository) {
        this.policyRepository = policyRepository;
        this.coverageItemRepository = coverageItemRepository;
    }

    /**
     * Get active policies for user
     */
    @Transactional(readOnly = true)
    public List<Policy> getActivePolicies(Long userId) {
        log.info("Getting active policies for userId: {}", userId);
        return policyRepository.findByUserIdAndIsActive(userId, true);
    }

    /**
     * Get all policies for user
     */
    @Transactional(readOnly = true)
    public List<Policy> getAllPolicies(Long userId) {
        log.info("Getting all policies for userId: {}", userId);
        return policyRepository.findByUserId(userId);
    }

    /**
     * Get policy by ID
     */
    @Transactional(readOnly = true)
    public Policy getPolicyById(Long policyId) {
        log.info("Getting policy: {}", policyId);
        return policyRepository.findById(policyId)
                .orElseThrow(() -> new IllegalArgumentException("Policy not found"));
    }

    /**
     * Get coverage items for policy
     */
    @Transactional(readOnly = true)
    public List<CoverageItem> getCoverageItems(Long policyId) {
        log.info("Getting coverage items for policy: {}", policyId);
        Policy policy = getPolicyById(policyId);
        return coverageItemRepository.findByPolicyOrderByPriority(policy);
    }

    /**
     * Check coverage for specific service
     */
    @Transactional(readOnly = true)
    public Map<String, Object> checkCoverage(Long policyId, String serviceCategory) {
        log.info("Checking coverage for policy: {}, category: {}", policyId, serviceCategory);

        Policy policy = getPolicyById(policyId);
        List<CoverageItem> items = coverageItemRepository.findByPolicyAndIsCovered(policy, true);

        Map<String, Object> result = new HashMap<>();
        result.put("policyId", policyId);
        result.put("serviceCategory", serviceCategory);
        result.put("isCovered", false);
        result.put("coverageDetails", null);

        for (CoverageItem item : items) {
            if (item.getCategory().equals(serviceCategory)) {
                result.put("isCovered", true);
                result.put("coverageDetails", Map.of(
                        "coverageRate", item.getCoverageRate(),
                        "maxBenefit", item.getMaxBenefitAmount(),
                        "deductible", item.getDeductible(),
                        "copay", item.getCopay(),
                        "conditions", item.getConditions()
                ));
                break;
            }
        }

        return result;
    }

    /**
     * Calculate estimated coverage amount
     */
    @Transactional(readOnly = true)
    public Map<String, Double> calculateEstimatedCoverage(Long policyId, String serviceCategory, Double serviceAmount) {
        log.info("Calculating coverage for policy: {}, amount: {}", policyId, serviceAmount);

        Map<String, Object> coverage = checkCoverage(policyId, serviceCategory);

        Map<String, Double> result = new HashMap<>();
        result.put("serviceAmount", serviceAmount);

        if ((Boolean) coverage.get("isCovered")) {
            Map<String, Object> details = (Map<String, Object>) coverage.get("coverageDetails");
            Double coverageRate = (Double) details.getOrDefault("coverageRate", 0.0);

            Double coveredAmount = serviceAmount * (coverageRate / 100);
            Double deductible = (Double) details.getOrDefault("deductible", 0.0);

            if (coveredAmount > deductible) {
                coveredAmount -= deductible;
            } else {
                coveredAmount = 0.0;
            }

            Double maxBenefit = (Double) details.getOrDefault("maxBenefit", Double.MAX_VALUE);
            coveredAmount = Math.min(coveredAmount, maxBenefit);

            result.put("coveredAmount", coveredAmount);
            result.put("userResponsibility", serviceAmount - coveredAmount);
        } else {
            result.put("coveredAmount", 0.0);
            result.put("userResponsibility", serviceAmount);
        }

        return result;
    }

    /**
     * Get insurance summary for user
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getInsuranceSummary(Long userId) {
        log.info("Getting insurance summary for userId: {}", userId);

        List<Policy> activePolicies = getActivePolicies(userId);

        Map<String, Object> summary = new HashMap<>();
        summary.put("userId", userId);
        summary.put("activePolicyCount", activePolicies.size());
        summary.put("policies", activePolicies);

        if (!activePolicies.isEmpty()) {
            Policy primaryPolicy = activePolicies.get(0);
            summary.put("primaryPolicy", primaryPolicy.getInsuranceType());
            summary.put("monthlyPremium", primaryPolicy.getMonthlyPremium());
        }

        return summary;
    }
}
