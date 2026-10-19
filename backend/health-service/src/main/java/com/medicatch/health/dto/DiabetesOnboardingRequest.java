package com.medicatch.health.dto;

public record DiabetesOnboardingRequest(
        String diagnosisStatus,
        Boolean familyHistoryDiabetes,
        String hba1cTestStatus,
        String healthCheckupStatus,
        Boolean aiProcessingConsent,
        Hba1cRequest hba1cResult
) {}
