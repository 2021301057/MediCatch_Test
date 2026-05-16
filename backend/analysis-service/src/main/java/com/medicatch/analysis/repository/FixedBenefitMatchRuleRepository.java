package com.medicatch.analysis.repository;

import com.medicatch.analysis.entity.FixedBenefitMatchRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FixedBenefitMatchRuleRepository extends JpaRepository<FixedBenefitMatchRule, Long> {

    List<FixedBenefitMatchRule> findByIsActiveOrderByPriorityAsc(Boolean isActive);

    List<FixedBenefitMatchRule> findByFixedBenefitCategoryAndIsActiveOrderByPriorityAsc(
            String fixedBenefitCategory,
            Boolean isActive
    );

    /** 정확 일치 또는 "{category}_" 접두사 일치하는 룰을 DB에서 바로 필터링. */
    @Query("SELECT r FROM FixedBenefitMatchRule r " +
           "WHERE r.isActive = :isActive " +
           "AND (r.fixedBenefitCategory = :category OR r.fixedBenefitCategory LIKE :prefix) " +
           "ORDER BY r.priority ASC")
    List<FixedBenefitMatchRule> findByCategoryOrPrefixAndIsActive(
            @Param("category") String category,
            @Param("prefix") String prefix,
            @Param("isActive") Boolean isActive
    );
}
