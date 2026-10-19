package com.medicatch.health.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record Hba1cRequest(
        LocalDate testDate,
        BigDecimal value,
        String organizationName,
        String note
) {}
