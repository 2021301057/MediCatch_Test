package com.medicatch.health.dto;

import com.medicatch.health.entity.MedicalRecord;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class MedicalRecordDto {

    private Long id;
    private LocalDate visitDate;
    private String hospitalName;
    private String department;
    private String diagnosis;
    private String treatmentType;
    private Double patientPayment;
    private Double insurancePayment;
    private Double totalCost;
    private boolean hasClaimOpportunity;
    private Double claimAmount;

    public static MedicalRecordDto from(MedicalRecord e) {
        Double outOfPocket = e.getOutOfPocket();
        boolean hasClaim = outOfPocket != null && outOfPocket > 0;

        return MedicalRecordDto.builder()
                .id(e.getId())
                .visitDate(e.getVisitDate())
                .hospitalName(e.getHospital())
                .department(e.getDepartment())
                .diagnosis(e.getDiagnosis())
                .treatmentType(e.getTreatmentDetails())
                .patientPayment(outOfPocket)
                .insurancePayment(e.getInsuranceCoverage())
                .totalCost(e.getMedicalCost())
                .hasClaimOpportunity(hasClaim)
                .claimAmount(hasClaim ? outOfPocket : 0.0)
                .build();
    }
}
