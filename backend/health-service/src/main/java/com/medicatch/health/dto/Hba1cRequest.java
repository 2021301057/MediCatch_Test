package com.medicatch.health.dto;

import java.time.LocalDate;

public record Hba1cRequest(
        LocalDate testDate,
        Double value,
        String organizationName,
        String note
) {}
