package com.medicatch.analysis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreTreatmentSearchRequest {

    private Long userId;
    private String query;
    private Double estimatedCost;
    private String hospitalType;
    private String benefitType;
    private String injuryDiseaseType;
}
