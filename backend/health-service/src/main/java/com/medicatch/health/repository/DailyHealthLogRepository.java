package com.medicatch.health.repository;

import com.medicatch.health.entity.DailyHealthLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyHealthLogRepository extends JpaRepository<DailyHealthLog, Long> {
    Optional<DailyHealthLog> findByUserIdAndLogDate(Long userId, LocalDate logDate);
    List<DailyHealthLog> findTop7ByUserIdOrderByLogDateDesc(Long userId);
}
