package com.medicatch.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
public class JwtAuthenticationFilter extends AbstractGatewayFilterFactory<JwtAuthenticationFilter.Config> {

    @Value("${jwt.secret:medicatch-secret-key-for-jwt-token-generation-2024-secure-key-make-it-long}")
    private String jwtSecret;

    public JwtAuthenticationFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            try {
                // Extract token from Authorization header
                String token = extractToken(exchange);

                if (token == null) {
                    // Token not required for public endpoints
                    String path = exchange.getRequest().getURI().getPath();
                    if (!isPublicEndpoint(path)) {
                        log.warn("Missing JWT token for protected endpoint: {}", path);
                        return onError(exchange, "Missing JWT token", HttpStatus.UNAUTHORIZED);
                    }
                    return chain.filter(exchange);
                }

                // Validate and extract userId from token
                Long userId = validateTokenAndGetUserId(token);
                if (userId == null) {
                    log.warn("Invalid JWT token");
                    return onError(exchange, "Invalid JWT token", HttpStatus.UNAUTHORIZED);
                }

                // Add userId to request headers for downstream services
                exchange.getRequest().mutate()
                        .header("X-User-Id", userId.toString())
                        .build();

                return chain.filter(exchange);

            } catch (Exception e) {
                log.error("JWT authentication filter error: {}", e.getMessage(), e);
                return onError(exchange, "Authentication failed", HttpStatus.UNAUTHORIZED);
            }
        };
    }

    /**
     * Extract JWT token from Authorization header
     */
    private String extractToken(ServerWebExchange exchange) {
        String authHeader = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }

    /**
     * Validate JWT token and extract userId
     */
    private Long validateTokenAndGetUserId(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build().
                    parseSignedClaims(token)
                    .getPayload();

            return Long.parseLong(claims.getSubject());
        } catch (Exception e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Check if endpoint is public
     */
    private boolean isPublicEndpoint(String path) {
        return path.startsWith("/api/auth/signup") ||
                path.startsWith("/api/auth/login") ||
                path.startsWith("/api/auth/refresh") ||
                path.startsWith("/api/auth/health") ||
                path.startsWith("/actuator");
    }

    /**
     * Handle authentication errors
     */
    private Mono<Void> onError(ServerWebExchange exchange, String message, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        return exchange.getResponse().setComplete();
    }

    public static class Config {
    }
}
