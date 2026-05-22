package com.medicatch.chat.controller;

import com.medicatch.chat.dto.ChatRequest;
import com.medicatch.chat.dto.ChatResponse;
import com.medicatch.chat.service.ChatService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    private Long resolveUserId(String userIdHeader, String userIdParam) {
        String raw = userIdHeader != null ? userIdHeader : userIdParam;
        if (raw == null || raw.isBlank()) return null;
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Send chat message and get AI response
     */
    @PostMapping("/message")
    public ResponseEntity<ChatResponse> sendMessage(
            @Valid @RequestBody ChatRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestParam(value = "userId", required = false) String userIdParam) {
        Long userId = resolveUserId(userIdHeader, userIdParam);
        log.info("POST /api/chat/message - userId: {}", userId);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ChatResponse.builder()
                            .message("로그인이 필요합니다.")
                            .intentType("UNAUTHORIZED")
                            .build());
        }
        try {
            ChatResponse response = chatService.sendMessage(userId, request.getMessage());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error sending chat message: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ChatResponse.builder()
                            .message("죄송합니다. 메시지 처리 중 오류가 발생했습니다.")
                            .intentType("ERROR")
                            .build());
        }
    }

    /**
     * Get chat history for user
     */
    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getChatHistory(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestParam(value = "userId", required = false) String userIdParam,
            @RequestParam(defaultValue = "50") int limit) {
        Long userId = resolveUserId(userIdHeader, userIdParam);
        log.info("GET /api/chat/history - userId: {}, limit: {}", userId, limit);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized"));
        }
        try {
            List<Map<String, Object>> history = chatService.getChatHistory(userId, limit);
            return ResponseEntity.ok(Map.of(
                    "userId", userId,
                    "count", history.size(),
                    "messages", history
            ));
        } catch (Exception e) {
            log.error("Error retrieving chat history: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve chat history"));
        }
    }

    /**
     * Delete chat history
     */
    @DeleteMapping("/history")
    public ResponseEntity<Map<String, String>> deleteChatHistory(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestParam(value = "userId", required = false) String userIdParam) {
        Long userId = resolveUserId(userIdHeader, userIdParam);
        log.info("DELETE /api/chat/history - userId: {}", userId);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized"));
        }
        try {
            chatService.deleteChatHistory(userId);
            return ResponseEntity.ok(Map.of(
                    "message", "Chat history deleted successfully",
                    "userId", userId.toString()
            ));
        } catch (Exception e) {
            log.error("Error deleting chat history: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete chat history"));
        }
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "chat-service"));
    }
}
