package com.medicatch.health.repository;

import com.medicatch.health.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HospitalRepository extends JpaRepository<Hospital, Long> {

    List<Hospital> findBySiDoCdOrderByHmcNm(Integer siDoCd);

    List<Hospital> findBySiDoCdAndSiGunGuCdOrderByHmcNm(Integer siDoCd, Integer siGunGuCd);
}
