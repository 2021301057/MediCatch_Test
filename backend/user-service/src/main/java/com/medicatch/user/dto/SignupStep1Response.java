package com.medicatch.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignupStep1Response {
    private String sessionKey;
    private boolean requiresTwoWay;
    private String authMethod; // "0"=SMS, "1"=PASS
}
