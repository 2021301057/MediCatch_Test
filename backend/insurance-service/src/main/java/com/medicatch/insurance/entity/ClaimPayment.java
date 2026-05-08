package com.medicatch.insurance.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "claim_payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClaimPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String codefId;

    @Column(nullable = false)
    private LocalDate occurrenceDate;

    @Column
    private LocalDate paymentDate;

    @Column
    private String companyName;

    @Column(columnDefinition = "TEXT")
    private String reasonForPayment;

    @Column
    private String judgeResult;

    @Column
    private Double paidAmount;
}
