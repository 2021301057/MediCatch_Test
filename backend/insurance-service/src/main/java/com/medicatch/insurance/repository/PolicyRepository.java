package com.medicatch.insurance.repository;

import com.medicatch.insurance.entity.Policy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PolicyRepository extends JpaRepository<Policy, Long> {

    List<Policy> findByUserIdAndIsActive(Long userId, boolean isActive);
    List<Policy> findByUserId(Long userId);
    List<Policy> findByCodefId(String codefId);
    List<Policy> findByCodefIdAndIsActive(String codefId, boolean isActive);
    void deleteByCodefId(String codefId);

    Optional<Policy> findByPolicyNumber(String policyNumber);
}
