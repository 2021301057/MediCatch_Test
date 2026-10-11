package com.medicatch.health.dto;

public record DailyHealthLogRequest(
        String mealQuality,
        Boolean highSugarIntake,
        Boolean lateNightMeal,
        Integer walkingMinutes,
        Integer stepCount,
        Boolean exerciseCompleted
) {}
