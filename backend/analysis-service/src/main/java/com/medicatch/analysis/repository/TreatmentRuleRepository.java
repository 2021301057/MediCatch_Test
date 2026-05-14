package com.medicatch.analysis.repository;

import com.medicatch.analysis.entity.TreatmentRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreatmentRuleRepository extends JpaRepository<TreatmentRule, Long> {

    List<TreatmentRule> findByIsActiveOrderByPriorityAsc(Boolean isActive);

    List<TreatmentRule> findByKeywordContainingAndIsActiveOrderByPriorityAsc(String keyword, Boolean isActive);
}
