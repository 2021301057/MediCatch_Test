package com.medicatch.user.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret:medicatch-secret-key-for-jwt-token-generation-2024}")
    private String jwtSecret;

    @Value("${jwt.access-token-expire:900000}")  // 15 minutes in milliseconds
    private long accessTokenExpiry;

    @Value("${jwt.refresh-token-expire:604800000}")  // 7 days in milliseconds
    private long refreshTokenExpiry;

    private SecretKey getSigningKey() {
        byte[] decodedKey = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(decodedKey);
    }

    /**
     * Generate access token (15 minutes expiry)
     */
    public String generateAccessToken(Long userId, String email) {
        return createToken(userId, email, accessTokenExpiry, "access");
    }

    /**
     * Generate refresh token (7 days expiry)
     */
    public String generateRefreshToken(Long userId) {
        return createToken(userId, "", refreshTokenExpiry, "refresh");
    }

    private String createToken(Long userId, String email, long expiryTime, String tokenType) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiryTime);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("tokenType", tokenType)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    /**
     * Validate JWT token
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            log.error("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Extract user ID from token
     */
    public Long getUserIdFromToken(String token) {
        try {
            Claims claims = getClaims(token);
            return Long.parseLong(claims.getSubject());
        } catch (Exception e) {
            log.error("Failed to extract userId from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extract email from token
     */
    public String getEmailFromToken(String token) {
        try {
            Claims claims = getClaims(token);
            return claims.get("email", String.class);
        } catch (Exception e) {
            log.error("Failed to extract email from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Check if token is expired
     */
    public boolean isTokenExpired(String token) {
        try {
            Claims claims = getClaims(token);
            return claims.getExpiration().before(new Date());
        } catch (Exception e) {
            log.error("Failed to check token expiry: {}", e.getMessage());
            return true;
        }
    }

    /**
     * Get token type (access or refresh)
     */
    public String getTokenType(String token) {
        try {
            Claims claims = getClaims(token);
            return claims.get("tokenType", String.class);
        } catch (Exception e) {
            log.error("Failed to extract token type: {}", e.getMessage());
            return null;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build().
                parseSignedClaims(token)
                .getPayload();
    }

    public long getAccessTokenExpiry() {
        return accessTokenExpiry;
    }
}
