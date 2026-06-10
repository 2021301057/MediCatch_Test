package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "hospitals")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Hospital {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "siDoCd", nullable = false)
    private Integer siDoCd;

    @Column(name = "siGunGuCd", nullable = false)
    private Integer siGunGuCd;

    @Column(name = "hmcNm", nullable = false, length = 200)
    private String hmcNm;

    @Column(name = "locAddr", length = 300)
    private String locAddr;

    @Column(name = "hmcTelNo", length = 50)
    private String hmcTelNo;
}
