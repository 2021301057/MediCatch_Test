package com.medicatch.analysis.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class MedicalRecordInfo {
    private Long id;
    private LocalDate visitDate;
    private String hospitalName;
    private String department;
    private String diagnosis;
    private String treatmentType;
    private String diseaseCode;
    private Double patientPayment;
    private Double insurancePayment;
    private Double totalCost;
    private boolean hasClaimOpportunity;
    private Double claimAmount;
}
