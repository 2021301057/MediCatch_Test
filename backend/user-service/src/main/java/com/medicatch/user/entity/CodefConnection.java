package com.medicatch.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "codef_connections")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodefConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String organizationType;

    @Column(nullable = false)
    private String organizationCode;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String connectedId;  // AES encrypted

    @Column(nullable = false)
    private boolean isActive;

    @Column(nullable = false, updatable = false)
    private LocalDateTime connectedAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        connectedAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        isActive = true;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
