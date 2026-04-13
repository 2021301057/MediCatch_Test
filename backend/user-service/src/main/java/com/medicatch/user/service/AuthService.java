package com.medicatch.user.service;

import com.medicatch.user.config.JwtTokenProvider;
import com.medicatch.user.dto.AuthResponse;
import com.medicatch.user.dto.LoginRequest;
import com.medicatch.user.dto.SignupRequest;
import com.medicatch.user.entity.User;
import com.medicatch.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Slf4j
@Service
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    /**
     * Register new user
     */
    public AuthResponse signup(SignupRequest request) {
        log.info("Processing signup for email: {}", request.getEmail());

        // Validate password confirmation
        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        // Check if user already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Parse gender
        User.Gender gender;
        try {
            gender = User.Gender.valueOf(request.getGender().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid gender. Must be M or F");
        }

        // Create new user
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .birthDate(request.getBirthDate())
                .gender(gender)
                .build();

        User savedUser = userRepository.save(user);
        log.info("User registered successfully: {}", savedUser.getId());

        // Generate tokens
        String accessToken = jwtTokenProvider.generateAccessToken(savedUser.getId(), savedUser.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(savedUser.getId());

        return AuthResponse.of(
                savedUser.getId(),
                savedUser.getEmail(),
                savedUser.getName(),
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * Login user
     */
    public AuthResponse login(LoginRequest request) {
        log.info("Processing login for email: {}", request.getEmail());

        // Find user by email
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    log.warn("Login failed: user not found for email: {}", request.getEmail());
                    return new IllegalArgumentException("Invalid email or password");
                });

        // Verify password
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Login failed: incorrect password for email: {}", request.getEmail());
            throw new IllegalArgumentException("Invalid email or password");
        }

        log.info("Login successful for user: {}", user.getId());

        // Generate tokens
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.of(
                user.getId(),
                user.getEmail(),
                user.getName(),
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * Refresh access token using refresh token
     */
    public AuthResponse refreshToken(String refreshToken) {
        log.info("Processing token refresh");

        // Validate refresh token
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            log.warn("Token refresh failed: invalid refresh token");
            throw new IllegalArgumentException("Invalid refresh token");
        }

        // Check token type
        String tokenType = jwtTokenProvider.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            log.warn("Token refresh failed: token is not a refresh token");
            throw new IllegalArgumentException("Token is not a refresh token");
        }

        // Extract user ID
        Long userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        if (userId == null) {
            log.warn("Token refresh failed: could not extract userId from token");
            throw new IllegalArgumentException("Invalid refresh token");
        }

        // Get user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> {
                    log.warn("Token refresh failed: user not found: {}", userId);
                    return new IllegalArgumentException("User not found");
                });

        log.info("Token refreshed for user: {}", userId);

        // Generate new tokens
        String newAccessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.of(
                user.getId(),
                user.getEmail(),
                user.getName(),
                newAccessToken,
                newRefreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * Get user by ID
     */
    @Transactional(readOnly = true)
    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
