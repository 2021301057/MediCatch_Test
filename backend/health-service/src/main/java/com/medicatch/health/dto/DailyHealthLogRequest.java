package com.medicatch.health.dto;

public record DailyHealthLogRequest(
        String mealQuality,
        String mealDescription,
        String exerciseDescription,
        Boolean highSugarIntake,
        Boolean lateNightMeal,
        Integer walkingMinutes,
        Integer stepCount,
        Boolean exerciseCompleted
) {}
