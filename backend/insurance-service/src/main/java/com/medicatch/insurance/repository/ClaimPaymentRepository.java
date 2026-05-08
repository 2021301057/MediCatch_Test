package com.medicatch.insurance.repository;

import com.medicatch.insurance.entity.ClaimPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClaimPaymentRepository extends JpaRepository<ClaimPayment, Long> {

    List<ClaimPayment> findByUserId(Long userId);
    void deleteByCodefId(String codefId);
}
