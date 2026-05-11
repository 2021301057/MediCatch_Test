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
    private String codefId;
    private String accessToken;
    private String refreshToken;
    private long expiresIn;
    private String tokenType;

    public static AuthResponse of(Long userId, String email, String name, String codefId,
                                   String accessToken, String refreshToken, long expiresIn) {
        return AuthResponse.builder()
                .userId(userId)
                .email(email)
                .name(name)
                .codefId(codefId)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(expiresIn)
                .tokenType("Bearer")
                .build();
    }
}
