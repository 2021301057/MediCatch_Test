package com.medicatch.insurance.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PeerPremiumBenchmarkDto {

    private Integer age;
    private String ageGroupLabel;
    private Double averageMonthlyPremium;
    private Double userMonthlyPremium;
    private Double difference;
    private Integer percentage;
    private String status;
    private Boolean estimated;
    private String source;
}
