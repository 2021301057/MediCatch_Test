package com.medicatch.user.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignupRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotBlank(message = "Name is required")
    private String name;

    @NotNull(message = "Birth date is required")
    @PastOrPresent(message = "Birth date must be in the past")
    private LocalDate birthDate;

    @NotNull(message = "Gender is required")
    private String gender;  // "M" or "F"

    @NotBlank(message = "Password confirmation is required")
    private String passwordConfirm;
}
