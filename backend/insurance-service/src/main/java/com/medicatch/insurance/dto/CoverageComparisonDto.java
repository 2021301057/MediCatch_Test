package com.medicatch.insurance.dto;

import com.medicatch.insurance.entity.CoverageComparison;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CoverageComparisonDto {

    private Long id;
    private String coverageName;
    private String coverageCode;
    private Double selfCoverageAmount;
    private Double avgGroupCoverageAmount;

    public static CoverageComparisonDto from(CoverageComparison comparison) {
        return CoverageComparisonDto.builder()
                .id(comparison.getId())
                .coverageName(comparison.getCoverageName())
                .coverageCode(comparison.getCoverageCode())
                .selfCoverageAmount(comparison.getSelfCoverageAmount())
                .avgGroupCoverageAmount(comparison.getAvgGroupCoverageAmount())
                .build();
    }
}
