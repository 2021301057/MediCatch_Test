package com.medicatch.health.repository;

import com.medicatch.health.entity.MedicationDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MedicationDetailRepository extends JpaRepository<MedicationDetail, Long> {

    List<MedicationDetail> findByUserIdAndEndDateIsNullOrderByPrescribedDateDesc(Long userId);

    List<MedicationDetail> findByUserIdOrderByPrescribedDateDesc(Long userId);

    List<MedicationDetail> findByUserIdAndPrescribedDateBetween(Long userId, LocalDate startDate, LocalDate endDate);
}
