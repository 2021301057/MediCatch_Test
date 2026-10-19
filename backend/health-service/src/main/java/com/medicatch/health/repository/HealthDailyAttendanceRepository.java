package com.medicatch.health.repository;

import com.medicatch.health.entity.HealthDailyAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HealthDailyAttendanceRepository extends JpaRepository<HealthDailyAttendance, Long> {
    @Modifying
    @Query(value = "INSERT IGNORE INTO health_daily_attendances (user_id, attendance_date, created_at) "
            + "VALUES (:userId, :date, CURRENT_TIMESTAMP)", nativeQuery = true)
    int recordAttendance(@Param("userId") Long userId, @Param("date") LocalDate date);

    Optional<HealthDailyAttendance> findByUserIdAndAttendanceDate(Long userId, LocalDate attendanceDate);
    List<HealthDailyAttendance> findByUserIdAndAttendanceDateBetween(Long userId, LocalDate start, LocalDate end);
}
