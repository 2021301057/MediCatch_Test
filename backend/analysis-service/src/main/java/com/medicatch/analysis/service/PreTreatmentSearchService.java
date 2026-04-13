package com.medicatch.analysis.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class PreTreatmentSearchService {

    // Mock treatment database
    private static final Map<String, List<Map<String, Object>>> TREATMENT_DATABASE = new HashMap<>() {{
        put("당뇨병", List.of(
                Map.of(
                        "treatmentId", "TREAT_001",
                        "treatmentName", "당뇨병 검사 및 관리",
                        "hospitalType", "일반의원",
                        "estimatedCost", 150000,
                        "coverageRate", 80.0,
                        "estimatedCopay", 30000,
                        "description", "혈당 검사, 당화혈색소 측정, 의료진 상담"
                ),
                Map.of(
                        "treatmentId", "TREAT_002",
                        "treatmentName", "당뇨병 전문의 상담",
                        "hospitalType", "대학병원",
                        "estimatedCost", 200000,
                        "coverageRate", 70.0,
                        "estimatedCopay", 60000,
                        "description", "전문의 진료, 약물 조정, 생활 습관 교육"
                )
        ));

        put("고혈압", List.of(
                Map.of(
                        "treatmentId", "TREAT_003",
                        "treatmentName", "고혈압 검진",
                        "hospitalType", "일반의원",
                        "estimatedCost", 100000,
                        "coverageRate", 80.0,
                        "estimatedCopay", 20000,
                        "description", "혈압 측정, 심전도, 진료"
                ),
                Map.of(
                        "treatmentId", "TREAT_004",
                        "treatmentName", "고혈압 약물 치료",
                        "hospitalType", "일반의원",
                        "estimatedCost", 50000,
                        "coverageRate", 85.0,
                        "estimatedCopay", 7500,
                        "description", "고혈압 치료제 처방 및 관리"
                )
        ));

        put("감기", List.of(
                Map.of(
                        "treatmentId", "TREAT_005",
                        "treatmentName", "감기 진료",
                        "hospitalType", "일반의원",
                        "estimatedCost", 40000,
                        "coverageRate", 80.0,
                        "estimatedCopay", 8000,
                        "description", "일반 감기 진료 및 처방"
                ),
                Map.of(
                        "treatmentId", "TREAT_006",
                        "treatmentName", "감기 약물 처방",
                        "hospitalType", "일반의원",
                        "estimatedCost", 20000,
                        "coverageRate", 85.0,
                        "estimatedCopay", 3000,
                        "description", "감기약 및 증상 완화제 처방"
                )
        ));

        put("치통", List.of(
                Map.of(
                        "treatmentId", "TREAT_007",
                        "treatmentName", "치과 진료",
                        "hospitalType", "치과",
                        "estimatedCost", 80000,
                        "coverageRate", 30.0,
                        "estimatedCopay", 56000,
                        "description", "충치 치료, 스케일링 (일부만 보장)"
                )
        ));

        put("피부염", List.of(
                Map.of(
                        "treatmentId", "TREAT_008",
                        "treatmentName", "피부과 진료",
                        "hospitalType", "피부과",
                        "estimatedCost", 100000,
                        "coverageRate", 80.0,
                        "estimatedCopay", 20000,
                        "description", "피부 질환 진단 및 치료"
                )
        ));
    }};

    /**
     * Search for treatments by condition
     */
    public List<Map<String, Object>> searchTreatments(String condition) {
        log.info("Searching treatments for condition: {}", condition);

        List<Map<String, Object>> results = TREATMENT_DATABASE.getOrDefault(condition, new ArrayList<>());

        if (results.isEmpty()) {
            log.warn("No treatments found for condition: {}", condition);
            return generateGenericResults(condition);
        }

        return results;
    }

    /**
     * Get treatment details
     */
    public Map<String, Object> getTreatmentDetails(String treatmentId) {
        log.info("Getting treatment details for: {}", treatmentId);

        for (List<Map<String, Object>> treatments : TREATMENT_DATABASE.values()) {
            for (Map<String, Object> treatment : treatments) {
                if (treatment.get("treatmentId").equals(treatmentId)) {
                    Map<String, Object> details = new HashMap<>(treatment);
                    details.put("estimatedRecoveryDays", 7);
                    details.put("followUpRequired", true);
                    details.put("relatedConditions", List.of("합병증 모니터링"));
                    return details;
                }
            }
        }

        return Map.of("error", "Treatment not found");
    }

    /**
     * Get all available conditions
     */
    public List<String> getAvailableConditions() {
        log.info("Returning available conditions");
        return new ArrayList<>(TREATMENT_DATABASE.keySet());
    }

    /**
     * Search for hospitals with treatments
     */
    public List<Map<String, Object>> searchHospitals(String condition, String location) {
        log.info("Searching hospitals for condition: {}, location: {}", condition, location);

        List<Map<String, Object>> treatments = searchTreatments(condition);

        // Mock hospital data
        return treatments.stream()
                .map(treatment -> Map.of(
                        "hospitalName", "MediCatch 협력병원 - " + treatment.get("hospitalType"),
                        "location", location != null ? location : "서울시 강남구",
                        "type", treatment.get("hospitalType"),
                        "rating", 4.8,
                        "availableDate", "2-3주 후",
                        "treatments", List.of(treatment)
                ))
                .limit(3)
                .toList();
    }

    private List<Map<String, Object>> generateGenericResults(String condition) {
        return List.of(
                Map.of(
                        "treatmentId", "TREAT_GENERIC_001",
                        "treatmentName", condition + " 진료",
                        "hospitalType", "일반의원",
                        "estimatedCost", 100000,
                        "coverageRate", 80.0,
                        "estimatedCopay", 20000,
                        "description", condition + " 관련 진료"
                )
        );
    }
}
