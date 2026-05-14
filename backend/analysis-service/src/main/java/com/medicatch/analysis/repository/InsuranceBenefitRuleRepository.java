package com.medicatch.analysis.repository;

import com.medicatch.analysis.entity.InsuranceBenefitRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InsuranceBenefitRuleRepository extends JpaRepository<InsuranceBenefitRule, Long> {

    List<InsuranceBenefitRule> findByIsActiveOrderByPriorityAsc(Boolean isActive);

    List<InsuranceBenefitRule> findByGenerationCodeAndCareTypeAndBenefitTypeAndIsActiveOrderByPriorityAsc(
            String generationCode,
            String careType,
            String benefitType,
            Boolean isActive
    );
}
