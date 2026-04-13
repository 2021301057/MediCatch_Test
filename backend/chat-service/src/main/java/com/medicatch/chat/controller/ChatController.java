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

    /**
     * Send chat message and get AI response
     */
    @PostMapping("/message")
    public ResponseEntity<ChatResponse> sendMessage(@Valid @RequestBody ChatRequest request) {
        log.info("POST /api/chat/message - userId: {}", request.getUserId());
        try {
            ChatResponse response = chatService.sendMessage(request.getUserId(), request.getMessage());
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
            @RequestParam Long userId,
            @RequestParam(defaultValue = "50") int limit) {
        log.info("GET /api/chat/history - userId: {}, limit: {}", userId, limit);
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
    public ResponseEntity<Map<String, String>> deleteChatHistory(@RequestParam Long userId) {
        log.info("DELETE /api/chat/history - userId: {}", userId);
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
