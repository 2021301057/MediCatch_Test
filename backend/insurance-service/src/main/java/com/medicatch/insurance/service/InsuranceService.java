package com.medicatch.insurance.service;

import com.medicatch.insurance.dto.PeerPremiumBenchmarkDto;
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

    private static final List<AgePremiumBenchmark> PEER_PREMIUM_BENCHMARKS = List.of(
            new AgePremiumBenchmark(0, 9, "10대 이하", 110000.0),
            new AgePremiumBenchmark(10, 19, "10대", 135000.0),
            new AgePremiumBenchmark(20, 29, "20대", 185650.0),
            new AgePremiumBenchmark(30, 39, "30대", 278935.0),
            new AgePremiumBenchmark(40, 49, "40대", 395661.0),
            new AgePremiumBenchmark(50, 59, "50대", 481036.0),
            new AgePremiumBenchmark(60, 69, "60대", 356019.0),
            new AgePremiumBenchmark(70, 79, "70대", 310000.0),
            new AgePremiumBenchmark(80, 89, "80대", 260000.0),
            new AgePremiumBenchmark(90, 99, "90대", 210000.0)
    );

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

    @Transactional(readOnly = true)
    public List<Policy> getActivePoliciesByCodefId(String codefId) {
        log.info("Getting active policies for codefId: {}", codefId);
        return policyRepository.findByCodefIdAndIsActive(codefId, true);
    }

    @Transactional(readOnly = true)
    public List<Policy> getAllPoliciesByCodefId(String codefId) {
        log.info("Getting all policies for codefId: {}", codefId);
        return policyRepository.findByCodefId(codefId);
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
                Map<String, Object> details = new HashMap<>();
                details.put("maxBenefit", item.getMaxBenefitAmount());
                details.put("conditions", item.getConditions());
                result.put("isCovered", true);
                result.put("coverageDetails", details);
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
            Double maxBenefit = (Double) details.getOrDefault("maxBenefit", serviceAmount);
            Double coveredAmount = Math.min(serviceAmount, maxBenefit != null ? maxBenefit : serviceAmount);

            result.put("coveredAmount", coveredAmount);
            result.put("userResponsibility", serviceAmount - coveredAmount);
        } else {
            result.put("coveredAmount", 0.0);
            result.put("userResponsibility", serviceAmount);
        }

        return result;
    }

    /**
     * Get insurance summary for user by codefId
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getInsuranceSummary(String codefId) {
        log.info("Getting insurance summary for codefId: {}", codefId);

        List<Policy> activePolicies = getActivePoliciesByCodefId(codefId);

        Map<String, Object> summary = new HashMap<>();
        summary.put("codefId", codefId);
        summary.put("activePolicyCount", activePolicies.size());
        summary.put("policies", activePolicies);

        if (!activePolicies.isEmpty()) {
            Policy primaryPolicy = activePolicies.get(0);
            summary.put("primaryPolicy", primaryPolicy.getInsuranceType());
            summary.put("monthlyPremium", primaryPolicy.getMonthlyPremium());
        }

        return summary;
    }

    @Transactional(readOnly = true)
    public PeerPremiumBenchmarkDto getPeerPremiumBenchmark(Long userId, Integer age) {
        log.info("Getting peer premium benchmark for userId: {}, age: {}", userId, age);

        List<Policy> activePolicies = getActivePolicies(userId);
        double userMonthlyPremium = activePolicies.stream()
                .map(Policy::getMonthlyPremium)
                .filter(value -> value != null && value > 0)
                .mapToDouble(Double::doubleValue)
                .sum();

        AgePremiumBenchmark benchmark = findPeerPremiumBenchmark(age);
        double difference = userMonthlyPremium - benchmark.averageMonthlyPremium();
        int percentage = benchmark.averageMonthlyPremium() > 0 && userMonthlyPremium > 0
                ? (int) Math.round((userMonthlyPremium / benchmark.averageMonthlyPremium()) * 100)
                : 0;

        String status;
        if (userMonthlyPremium <= 0) {
            status = "확인 필요";
        } else if (difference > 0) {
            status = "또래보다 높음";
        } else {
            status = "또래보다 낮음";
        }

        return PeerPremiumBenchmarkDto.builder()
                .age(age)
                .ageGroupLabel(benchmark.label())
                .averageMonthlyPremium(benchmark.averageMonthlyPremium())
                .userMonthlyPremium(userMonthlyPremium)
                .difference(difference)
                .percentage(percentage)
                .status(status)
                .estimated(isEstimatedAgeGroup(age, benchmark))
                .source("INTERNAL_AGE_GROUP_PREMIUM_BENCHMARK_V1")
                .build();
    }

    private AgePremiumBenchmark findPeerPremiumBenchmark(Integer age) {
        if (age == null) {
            return PEER_PREMIUM_BENCHMARKS.get(2);
        }

        return PEER_PREMIUM_BENCHMARKS.stream()
                .filter(item -> age >= item.minAge() && age <= item.maxAge())
                .findFirst()
                .orElse(age < PEER_PREMIUM_BENCHMARKS.get(0).minAge()
                        ? PEER_PREMIUM_BENCHMARKS.get(0)
                        : PEER_PREMIUM_BENCHMARKS.get(PEER_PREMIUM_BENCHMARKS.size() - 1));
    }

    private boolean isEstimatedAgeGroup(Integer age, AgePremiumBenchmark benchmark) {
        return age == null || age < benchmark.minAge() || age > benchmark.maxAge();
    }

    private record AgePremiumBenchmark(int minAge, int maxAge, String label, double averageMonthlyPremium) {
    }
}
