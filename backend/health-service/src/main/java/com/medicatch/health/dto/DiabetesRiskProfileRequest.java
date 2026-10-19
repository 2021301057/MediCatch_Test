package com.medicatch.health.dto;

public record DiabetesRiskProfileRequest(Boolean familyHistoryDiabetes, Boolean aiProcessingConsent, String healthCheckupStatus) {}
