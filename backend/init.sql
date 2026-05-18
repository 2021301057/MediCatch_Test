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
    codef_id VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
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
    medical_cost DECIMAL(10,2),
    insurance_coverage DECIMAL(10,2),
    out_of_pocket DECIMAL(10,2),
    claim_status VARCHAR(20) DEFAULT 'UNCLAIMED',
    disease_code VARCHAR(20),
    non_covered_amount DECIMAL(10,2),
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
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    prescribed_date DATE NOT NULL,
    end_date DATE,
    indication VARCHAR(255),
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
    policy_number_hid VARCHAR(255),
    insurer_name VARCHAR(200) NOT NULL,
    insurance_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    has_supplementary_coverage BOOLEAN DEFAULT FALSE,
    monthly_premium DECIMAL(10,2),
    premium_amount DECIMAL(10,2),
    payment_cycle VARCHAR(100),
    payment_period VARCHAR(100),
    policy_details LONGTEXT,
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
    max_benefit_amount DECIMAL(10,2),
    conditions LONGTEXT,
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

-- Claim Payments table
CREATE TABLE IF NOT EXISTS claim_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    codef_id VARCHAR(255) NOT NULL,
    occurrence_date DATE NOT NULL,
    payment_date DATE,
    company_name VARCHAR(200),
    reason_for_payment TEXT,
    judge_result VARCHAR(100),
    paid_amount DECIMAL(15,2),
    INDEX idx_user_id (user_id),
    INDEX idx_codef_id (codef_id),
    INDEX idx_occurrence_date (occurrence_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- medicatch_analysis database
-- ============================================
USE medicatch_analysis;

-- Treatment rules table (maps user search terms to insurance analysis categories)
CREATE TABLE IF NOT EXISTS treatment_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    synonyms LONGTEXT,
    injury_disease_type VARCHAR(30),
    care_type VARCHAR(30),
    benefit_type VARCHAR(30),
    treatment_category VARCHAR(50),
    actual_loss_category VARCHAR(50),
    fixed_benefit_category VARCHAR(50),
    needs_user_confirmation BOOLEAN DEFAULT FALSE,
    caution_message LONGTEXT,
    priority INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_keyword (keyword),
    INDEX idx_actual_loss_category (actual_loss_category),
    INDEX idx_fixed_benefit_category (fixed_benefit_category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Actual loss benefit rules table (generation-based calculation rules)
CREATE TABLE IF NOT EXISTS insurance_benefit_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    generation_code VARCHAR(20) NOT NULL,
    care_type VARCHAR(30) NOT NULL,
    benefit_type VARCHAR(30) NOT NULL,
    treatment_category VARCHAR(50),
    actual_loss_category VARCHAR(50),
    reimbursement_rate DECIMAL(5,2),
    patient_copay_rate DECIMAL(5,2),
    fixed_deductible DECIMAL(10,2),
    deductible_method VARCHAR(30),
    limit_amount DECIMAL(12,2),
    limit_count INT,
    requires_rider BOOLEAN DEFAULT FALSE,
    is_excluded BOOLEAN DEFAULT FALSE,
    note LONGTEXT,
    priority INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_generation_code (generation_code),
    INDEX idx_rule_lookup (generation_code, care_type, benefit_type),
    INDEX idx_actual_loss_category (actual_loss_category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fixed benefit match rules table (maps fixed benefit searches to owned coverage items)
CREATE TABLE IF NOT EXISTS fixed_benefit_match_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fixed_benefit_category VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    match_keywords LONGTEXT NOT NULL,
    exclude_keywords LONGTEXT,
    description LONGTEXT,
    priority INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fixed_benefit_category (fixed_benefit_category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Treatment/benefit rule seed data is maintained in treatmentRule.sql.

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
    rule_matched BOOLEAN DEFAULT FALSE,
    ai_used BOOLEAN DEFAULT FALSE,
    classification_json LONGTEXT,
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
INSERT INTO users (email, codef_id, password_hash, name, birth_date, gender)
VALUES ('test@medicatch.com', 'test', '$2b$10$Nt6r8LmhSKhZmD60LqPZ2.EWb62KpEup5wiiXKKX55c3YDjRCZNmC', '김건강', '1989-05-15', 'M')
ON DUPLICATE KEY UPDATE email=VALUES(email);


-- Insert sample medical records
USE medicatch_health;
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, treatment_details, medical_cost, insurance_coverage, out_of_pocket, claim_status)
VALUES (1, '2024-03-15', 'Sample Hospital', 'Internal Medicine', 'Sample diagnosis', 'Sample treatment', 150000, 120000, 30000, 'UNCLAIMED')
ON DUPLICATE KEY UPDATE visit_date=VALUES(visit_date);
-- Insert sample checkup results
INSERT INTO checkup_results (user_id, checkup_date, checkup_type, height, weight, glucose, total_cholesterol, blood_pressure_systolic, blood_pressure_diastolic)
VALUES (1, '2024-03-10', 'REGULAR', 175, 75, 110, 200, 120, 80)
ON DUPLICATE KEY UPDATE checkup_date=VALUES(checkup_date);

COMMIT;
