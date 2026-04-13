package com.medicatch.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private Long userId;
    private String email;
    private String name;
    private String accessToken;
    private String refreshToken;
    private long expiresIn;  // in milliseconds
    private String tokenType;  // "Bearer"

    public static AuthResponse of(Long userId, String email, String name, String accessToken, String refreshToken, long expiresIn) {
        return AuthResponse.builder()
                .userId(userId)
                .email(email)
                .name(name)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(expiresIn)
                .tokenType("Bearer")
                .build();
    }
}
