package com.medicatch.insurance.repository;

import com.medicatch.insurance.entity.CoverageItem;
import com.medicatch.insurance.entity.Policy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CoverageItemRepository extends JpaRepository<CoverageItem, Long> {

    List<CoverageItem> findByPolicyOrderByPriority(Policy policy);

    List<CoverageItem> findByPolicyAndIsCovered(Policy policy, boolean isCovered);

    List<CoverageItem> findByCategory(String category);
}
