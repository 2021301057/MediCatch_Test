package com.medicatch.chat.controller;

import com.medicatch.chat.repository.ChatHistoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/internal")
public class InternalController {

    private final ChatHistoryRepository chatHistoryRepository;

    public InternalController(ChatHistoryRepository chatHistoryRepository) {
        this.chatHistoryRepository = chatHistoryRepository;
    }

    @DeleteMapping("/users/{userId}")
    @Transactional
    public ResponseEntity<Map<String, String>> deleteUserData(@PathVariable Long userId) {
        log.info("DELETE /internal/users/{} - 채팅 데이터 전체 삭제", userId);
        chatHistoryRepository.deleteByUserId(userId);
        log.info("채팅 데이터 삭제 완료 - userId: {}", userId);
        return ResponseEntity.ok(Map.of("message", "채팅 데이터가 삭제되었습니다."));
    }
}
