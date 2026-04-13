package com.medicatch.user.repository;

import com.medicatch.user.entity.CodefConnection;
import com.medicatch.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CodefConnectionRepository extends JpaRepository<CodefConnection, Long> {

    List<CodefConnection> findByUserAndIsActive(User user, boolean isActive);

    Optional<CodefConnection> findByUserAndOrganizationCodeAndIsActive(User user, String organizationCode, boolean isActive);

    long countByUserAndIsActive(User user, boolean isActive);
}
