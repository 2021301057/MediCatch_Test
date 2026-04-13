package com.medicatch.user.controller;

import com.medicatch.user.dto.AuthResponse;
import com.medicatch.user.dto.LoginRequest;
import com.medicatch.user.dto.SignupRequest;
import com.medicatch.user.dto.UserProfileResponse;
import com.medicatch.user.entity.User;
import com.medicatch.user.service.AuthService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Register new user
     */
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        log.info("POST /api/auth/signup - email: {}", request.getEmail());
        try {
            AuthResponse response = authService.signup(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.warn("Signup failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Signup error: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Login user
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("POST /api/auth/login - email: {}", request.getEmail());
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Login failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Login error: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Refresh access token
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody Map<String, String> request) {
        log.info("POST /api/auth/refresh");
        try {
            String refreshToken = request.get("refreshToken");
            if (refreshToken == null || refreshToken.isEmpty()) {
                throw new IllegalArgumentException("Refresh token is required");
            }
            AuthResponse response = authService.refreshToken(refreshToken);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Token refresh failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Token refresh error: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Get user profile
     */
    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getProfile() {
        log.info("GET /api/auth/profile");
        try {
            // Get user ID from JWT token (set by security filter)
            String userIdString = (String) SecurityContextHolder.getContext()
                    .getAuthentication()
                    .getPrincipal();
            Long userId = Long.parseLong(userIdString);

            User user = authService.getUserById(userId);
            int codefConnectionCount = (int) user.getCodefConnections().stream()
                    .filter(conn -> conn.isActive())
                    .count();

            UserProfileResponse response = UserProfileResponse.builder()
                    .id(user.getId())
                    .email(user.getEmail())
                    .name(user.getName())
                    .birthDate(user.getBirthDate())
                    .gender(user.getGender().name())
                    .createdAt(user.getCreatedAt())
                    .updatedAt(user.getUpdatedAt())
                    .codefConnectionCount(codefConnectionCount)
                    .build();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Get profile error: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "user-service"));
    }
}
