package com.medicatch.chat.repository;

import com.medicatch.chat.entity.ChatHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatHistoryRepository extends JpaRepository<ChatHistory, Long> {

    List<ChatHistory> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT c FROM ChatHistory c WHERE c.userId = :userId ORDER BY c.createdAt DESC LIMIT :limit")
    List<ChatHistory> findRecentByUserId(@Param("userId") Long userId, @Param("limit") int limit);

    List<ChatHistory> findByUserIdAndCreatedAtAfter(Long userId, LocalDateTime dateTime);

    void deleteByUserIdAndCreatedAtBefore(Long userId, LocalDateTime dateTime);
}
