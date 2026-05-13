-- Create databases
CREATE DATABASE IF NOT EXISTS medicatch_user CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS medicatch_health CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS medicatch_insurance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS medicatch_analysis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS medicatch_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- medicatch_user database
-- ============================================
USE medicatch_user;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CODEF Connections table
CREATE TABLE IF NOT EXISTS codef_connections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    organization_type VARCHAR(50) NOT NULL,
    organization_code VARCHAR(50) NOT NULL,
    connected_id LONGTEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- medicatch_health database
-- ============================================
USE medicatch_health;

-- Medical Records table
CREATE TABLE IF NOT EXISTS medical_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    visit_date DATE NOT NULL,
    hospital VARCHAR(200) NOT NULL,
    department VARCHAR(100) NOT NULL,
    diagnosis VARCHAR(255) NOT NULL,
    treatment_details LONGTEXT,
    medication_prescribed VARCHAR(500),
    medical_cost DECIMAL(10,2),
    insurance_coverage DECIMAL(10,2),
    out_of_pocket DECIMAL(10,2),
    notes LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_visit_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Checkup Results table
CREATE TABLE IF NOT EXISTS checkup_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    checkup_date DATE NOT NULL,
    checkup_type VARCHAR(50) NOT NULL,
    height DECIMAL(5,2),
    weight DECIMAL(5,2),
    blood_pressure_systolic DECIMAL(5,2),
    blood_pressure_diastolic DECIMAL(5,2),
    glucose DECIMAL(7,2),
    total_cholesterol DECIMAL(7,2),
    hdl_cholesterol DECIMAL(7,2),
    ldl_cholesterol DECIMAL(7,2),
    triglycerides DECIMAL(7,2),
    abnormal_findings LONGTEXT,
    recommendations LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_checkup_date (checkup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Medication Details table
CREATE TABLE IF NOT EXISTS medication_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    medication_name VARCHAR(255) NOT NULL,
    medication_code VARCHAR(50),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    prescribed_date DATE NOT NULL,
    end_date DATE,
    indication VARCHAR(255),
    side_effects LONGTEXT,
    warnings LONGTEXT,
    cost DECIMAL(10,2),
    insurance_coverage DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_prescribed_date (prescribed_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- medicatch_insurance database
-- ============================================
USE medicatch_insurance;

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    codef_id VARCHAR(255),
    policy_number VARCHAR(100) NOT NULL,
    insurer_name VARCHAR(200) NOT NULL,
    insurance_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    has_supplementary_coverage BOOLEAN DEFAULT FALSE,
    monthly_premium DECIMAL(10,2),
    annual_premium DECIMAL(10,2),
    policy_details LONGTEXT,
    terms LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_codef_id (codef_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coverage Items table
CREATE TABLE IF NOT EXISTS coverage_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_id BIGINT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    coverage_rate DECIMAL(5,2),
    max_benefit_amount DECIMAL(10,2),
    deductible DECIMAL(10,2),
    copay DECIMAL(10,2),
    conditions LONGTEXT,
    exclusions LONGTEXT,
    is_covered BOOLEAN DEFAULT TRUE,
    priority INT,
    FOREIGN KEY (policy_id) REFERENCES policies(id),
    INDEX idx_policy_id (policy_id),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coverage Comparison table
CREATE TABLE IF NOT EXISTS coverage_comparison (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    codef_id VARCHAR(255),
    coverage_name VARCHAR(255) NOT NULL,
    coverage_code VARCHAR(50),
    self_coverage_amount DECIMAL(15,2),
    avg_group_coverage_amount DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_codef_id (codef_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- medicatch_analysis database
-- ============================================
USE medicatch_analysis;

-- Pre-treatment searches table (for logging and analytics)
CREATE TABLE IF NOT EXISTS pre_treatment_searches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    condition_searched VARCHAR(255) NOT NULL,
    treatment_id VARCHAR(100),
    treatment_name VARCHAR(255),
    estimated_cost DECIMAL(10,2),
    coverage_rate DECIMAL(5,2),
    estimated_copay DECIMAL(10,2),
    hospital_type VARCHAR(100),
    search_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_search_date (search_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coverage analysis logs table
CREATE TABLE IF NOT EXISTS coverage_analysis_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    analysis_type VARCHAR(100),
    findings LONGTEXT,
    recommendations LONGTEXT,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_analysis_date (analysis_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- medicatch_chat database
-- ============================================
USE medicatch_chat;

-- Chat History table
CREATE TABLE IF NOT EXISTS chat_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role ENUM('USER', 'ASSISTANT') NOT NULL,
    message LONGTEXT NOT NULL,
    intent_type VARCHAR(100),
    context_json LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample user for testing
USE medicatch_user;
INSERT INTO users (email, password_hash, name, birth_date, gender)
VALUES ('test@medicatch.com', '$2a$10$test', '김건강', '1989-05-15', 'M')
ON DUPLICATE KEY UPDATE email=VALUES(email);

-- Insert sample policies
USE medicatch_insurance;
INSERT INTO policies (user_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, annual_premium)
VALUES (1, 'POL-001-2024', '국민건강보험', 'NATIONAL_HEALTH', '2024-01-01', '2025-12-31', TRUE, 150000, 1800000)
ON DUPLICATE KEY UPDATE policy_number=VALUES(policy_number);

-- Insert sample coverage items
INSERT INTO coverage_items (policy_id, item_name, category, coverage_rate, max_benefit_amount, deductible, copay, is_covered, priority)
VALUES
    (1, '외래 진료', 'OUTPATIENT', 80, 10000000, 0, 0, TRUE, 1),
    (1, '입원료', 'INPATIENT', 90, 50000000, 0, 0, TRUE, 2),
    (1, '처방약', 'MEDICATION', 85, 5000000, 0, 0, TRUE, 3),
    (1, '수술료', 'SURGERY', 80, 30000000, 0, 0, TRUE, 4)
ON DUPLICATE KEY UPDATE item_name=VALUES(item_name);

-- Insert sample medical records
USE medicatch_health;
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, treatment_details, medication_prescribed, medical_cost, insurance_coverage, out_of_pocket)
VALUES (1, '2024-03-15', '서울대병원', '내과', '당뇨병 검사', '혈당 및 당화혈색소 측정', '메트포민', 150000, 120000, 30000)
ON DUPLICATE KEY UPDATE visit_date=VALUES(visit_date);

-- Insert sample checkup results
INSERT INTO checkup_results (user_id, checkup_date, checkup_type, height, weight, glucose, total_cholesterol, blood_pressure_systolic, blood_pressure_diastolic)
VALUES (1, '2024-03-10', 'REGULAR', 175, 75, 110, 200, 120, 80)
ON DUPLICATE KEY UPDATE checkup_date=VALUES(checkup_date);

COMMIT;
