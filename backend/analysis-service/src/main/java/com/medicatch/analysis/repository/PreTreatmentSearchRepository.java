package com.medicatch.analysis.repository;

import com.medicatch.analysis.entity.PreTreatmentSearch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PreTreatmentSearchRepository extends JpaRepository<PreTreatmentSearch, Long> {

    List<PreTreatmentSearch> findByUserIdOrderBySearchDateDesc(Long userId);
}
