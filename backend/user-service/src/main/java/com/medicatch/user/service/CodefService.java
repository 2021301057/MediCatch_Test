package com.medicatch.user.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Base64;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import javax.crypto.Cipher;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Security;
import java.security.spec.X509EncodedKeySpec;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class CodefService {

    @Value("${codef.client-id:YOUR_CODEF_CLIENT_ID}")
    private String codefClientId;

    @Value("${codef.client-secret:YOUR_CODEF_CLIENT_SECRET}")
    private String codefClientSecret;

    @Value("${codef.token-url:https://api.codef.io/oauth/token}")
    private String codefTokenUrl;

    @Value("${codef.rsa-public-key:}")
    private String codefRsaPublicKey;

    private final WebClient webClient;

    public CodefService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
        Security.addProvider(new BouncyCastleProvider());
    }

    /**
     * Get CODEF OAuth2 access token
     */
    public String getAccessToken() {
        try {
            log.info("Requesting CODEF access token");

            Map<String, String> request = new HashMap<>();
            request.put("client_id", codefClientId);
            request.put("client_secret", codefClientSecret);
            request.put("grant_type", "client_credentials");

            String response = webClient.post()
                    .uri(codefTokenUrl)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.debug("CODEF token response received");
            // In production, parse JSON response to extract access_token
            return extractAccessTokenFromResponse(response);
        } catch (Exception e) {
            log.error("Failed to get CODEF access token: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get CODEF access token", e);
        }
    }

    /**
     * Create connected ID with CODEF
     */
    public String createConnectedId(String organization, String loginType, String id, String password) {
        try {
            log.info("Creating CODEF connected ID for organization: {}", organization);

            String accessToken = getAccessToken();

            Map<String, Object> request = new HashMap<>();
            request.put("connectedId", id);
            request.put("connectedPassword", encryptRSA(password));
            request.put("loginType", loginType);
            request.put("organization", organization);

            String response = webClient.post()
                    .uri("https://api.codef.io/v1/connected/login")
                    .header("Authorization", "Bearer " + accessToken)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.debug("CODEF connected ID created");
            return extractConnectedIdFromResponse(response);
        } catch (Exception e) {
            log.error("Failed to create CODEF connected ID: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create CODEF connected ID", e);
        }
    }

    /**
     * Encrypt plaintext using RSA-2048
     */
    public String encryptRSA(String plaintext) {
        try {
            if (codefRsaPublicKey == null || codefRsaPublicKey.isEmpty()) {
                log.warn("CODEF RSA public key not configured, returning plaintext");
                return plaintext;
            }

            byte[] decodedKey = Base64.decodeBase64(codefRsaPublicKey);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(decodedKey);
            KeyFactory kf = KeyFactory.getInstance("RSA", "BC");
            PublicKey publicKey = kf.generatePublic(spec);

            Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding", "BC");
            cipher.init(Cipher.ENCRYPT_MODE, publicKey);

            byte[] encryptedBytes = cipher.doFinal(plaintext.getBytes());
            return Base64.encodeBase64String(encryptedBytes);
        } catch (Exception e) {
            log.error("Failed to encrypt with RSA: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to encrypt data with RSA", e);
        }
    }

    /**
     * Helper: Extract access token from CODEF response
     */
    private String extractAccessTokenFromResponse(String response) {
        try {
            // Simple extraction - in production use proper JSON parsing
            if (response.contains("access_token")) {
                int startIndex = response.indexOf("\"access_token\":\"") + 16;
                int endIndex = response.indexOf("\"", startIndex);
                return response.substring(startIndex, endIndex);
            }
            return "";
        } catch (Exception e) {
            log.error("Failed to parse access token from response: {}", e.getMessage());
            return "";
        }
    }

    /**
     * Helper: Extract connected ID from CODEF response
     */
    private String extractConnectedIdFromResponse(String response) {
        try {
            if (response.contains("connectedId")) {
                int startIndex = response.indexOf("\"connectedId\":\"") + 15;
                int endIndex = response.indexOf("\"", startIndex);
                return response.substring(startIndex, endIndex);
            }
            return "";
        } catch (Exception e) {
            log.error("Failed to parse connected ID from response: {}", e.getMessage());
            return "";
        }
    }
}
