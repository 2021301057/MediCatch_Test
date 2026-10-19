package com.medicatch.health.repository;

import com.medicatch.health.entity.DailyHealthMission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyHealthMissionRepository extends JpaRepository<DailyHealthMission, Long> {
    List<DailyHealthMission> findByUserIdAndMissionDateOrderByCategoryAsc(Long userId, LocalDate missionDate);
    List<DailyHealthMission> findByUserIdAndMissionDateBetween(Long userId, LocalDate start, LocalDate end);
    Optional<DailyHealthMission> findByIdAndUserId(Long id, Long userId);
}
