package com.medicatch.analysis.repository;

import com.medicatch.analysis.entity.FixedBenefitMatchRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FixedBenefitMatchRuleRepository extends JpaRepository<FixedBenefitMatchRule, Long> {

    List<FixedBenefitMatchRule> findByIsActiveOrderByPriorityAsc(Boolean isActive);

    List<FixedBenefitMatchRule> findByFixedBenefitCategoryAndIsActiveOrderByPriorityAsc(
            String fixedBenefitCategory,
            Boolean isActive
    );
}
