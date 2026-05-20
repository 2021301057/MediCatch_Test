package com.medicatch.health.dto;

import com.medicatch.health.entity.CheckupResult;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class CheckupResultDto {

    private Long id;
    private LocalDate checkupDate;
    private String checkupType;

    private Double height;
    private Double weight;
    private Double waist;
    private Double bmi;
    private String sight;
    private String hearing;

    private Double bloodPressureSystolic;
    private Double bloodPressureDiastolic;

    private String urinaryProtein;
    private Double hemoglobin;
    private Double glucose;

    private Double totalCholesterol;
    private Double hdlCholesterol;
    private Double ldlCholesterol;
    private Double triglycerides;

    private Double serumCreatinine;
    private Double gfr;
    private Double ast;
    private Double alt;
    private Double gammaGtp;

    private String tbChestDisease;
    private String osteoporosis;
    private String organizationName;

    private String abnormalFindings;
    private String recommendations;

    public static CheckupResultDto from(CheckupResult e) {
        return CheckupResultDto.builder()
                .id(e.getId())
                .checkupDate(e.getCheckupDate())
                .checkupType(e.getCheckupType())
                .height(e.getHeight())
                .weight(e.getWeight())
                .waist(e.getWaist())
                .bmi(e.getBmi())
                .sight(e.getSight())
                .hearing(e.getHearing())
                .bloodPressureSystolic(e.getBloodPressureSystolic())
                .bloodPressureDiastolic(e.getBloodPressureDiastolic())
                .urinaryProtein(e.getUrinaryProtein())
                .hemoglobin(e.getHemoglobin())
                .glucose(e.getGlucose())
                .totalCholesterol(e.getTotalCholesterol())
                .hdlCholesterol(e.getHdlCholesterol())
                .ldlCholesterol(e.getLdlCholesterol())
                .triglycerides(e.getTriglycerides())
                .serumCreatinine(e.getSerumCreatinine())
                .gfr(e.getGfr())
                .ast(e.getAst())
                .alt(e.getAlt())
                .gammaGtp(e.getGammaGtp())
                .tbChestDisease(e.getTbChestDisease())
                .osteoporosis(e.getOsteoporosis())
                .organizationName(e.getOrganizationName())
                .abnormalFindings(e.getAbnormalFindings())
                .recommendations(e.getRecommendations())
                .build();
    }
}
