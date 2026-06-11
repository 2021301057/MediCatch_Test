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

    // 따옴표(backtick) 없이 쓰면 기본 네이밍 전략이 si_do_cd 등 snake_case로 변환해버림
    @Column(name = "`siDoCd`", nullable = false)
    private Integer siDoCd;

    @Column(name = "`siGunGuCd`", nullable = false)
    private Integer siGunGuCd;

    @Column(name = "`hmcNm`", nullable = false, length = 200)
    private String hmcNm;

    @Column(name = "`locAddr`", length = 300)
    private String locAddr;

    @Column(name = "`hmcTelNo`", length = 50)
    private String hmcTelNo;

    @Column(name = "`cxVl`")
    private Double cxVl; // 경도

    @Column(name = "`cyVl`")
    private Double cyVl; // 위도
}
