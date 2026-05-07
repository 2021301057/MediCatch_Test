package com.medicatch.analysis.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.time.LocalDate;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MedicalRecordInfo {

    private Long id;
    private LocalDate visitDate;
    private String hospitalName;
    private String department;
    private String diagnosis;
    private String diseaseCode;
    private String treatmentType;
    private Double patientPayment;
    private Double insurancePayment;
    private Double totalCost;
    private String claimStatus;
    private boolean hasClaimOpportunity;
    private Double claimAmount;
    private String notes;
}
