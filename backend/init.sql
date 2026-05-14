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

-- Initial treatment classification rules
INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '암', '위암,대장암,폐암,갑상선암,유사암,고액암', 'DISEASE', 'DIAGNOSIS', 'UNKNOWN', 'CANCER',
       NULL, 'CANCER', FALSE, '암 종류, 최초 진단 여부, 면책기간, 감액기간에 따라 실제 보장 여부가 달라질 수 있습니다.', 10
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '암');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '골절', '뼈 골절,발목 골절,손목 골절,치아파절', 'INJURY', 'DIAGNOSIS', 'UNKNOWN', 'FRACTURE',
       NULL, 'FRACTURE_DIAGNOSIS', FALSE, '치아파절은 담보별 보장 제외 조건이 있을 수 있습니다.', 20
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '골절');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '입원', '입원치료,병실,중환자실', 'UNKNOWN', 'INPATIENT', 'COVERED', 'GENERAL',
       'GENERAL_INPATIENT', 'HOSPITALIZATION_DAILY', TRUE, '상해 입원인지 질병 입원인지에 따라 적용 담보가 달라질 수 있습니다.', 30
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '입원');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '수술', '수술비,질병수술,상해수술,암수술', 'UNKNOWN', 'SURGERY', 'MIXED', 'SURGERY',
       'GENERAL_SURGERY', 'SURGERY_BENEFIT', TRUE, '질병/상해/암 수술 여부와 수술 분류에 따라 정액형 담보가 달라질 수 있습니다.', 40
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '수술');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '도수치료', '도수,수기치료,재활도수', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'REHAB',
       'NON_COVERED_THREE', NULL, TRUE, '도수치료는 세대와 특약 가입 여부에 따라 보장 여부와 한도가 크게 달라질 수 있습니다.', 50
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '도수치료');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'MRI', '자기공명영상,엠알아이', 'UNKNOWN', 'TEST', 'MIXED', 'IMAGING',
       'NON_COVERED_THREE', NULL, TRUE, 'MRI는 급여 여부와 비급여 특약 가입 여부에 따라 보장 판단이 달라질 수 있습니다.', 60
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'MRI');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '비급여주사', '주사치료,영양주사,증식치료,프롤로주사', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'INJECTION',
       'NON_COVERED_THREE', NULL, TRUE, '비급여 주사는 치료 목적과 특약 가입 여부 확인이 필요합니다.', 70
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '비급여주사');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '치과', '치아,충치,잇몸,임플란트,스케일링', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'DENTAL',
       'DENTAL', NULL, TRUE, '치과 질병 치료는 세대별로 급여/비급여 보장 범위가 달라질 수 있습니다.', 80
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '치과');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '한방', '한의원,침,뜸,부항,추나요법,한약', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'KOREAN_MEDICINE',
       'KOREAN_MEDICINE', NULL, TRUE, '한방 비급여는 2세대 이후 면책되는 경우가 많아 급여 여부 확인이 필요합니다.', 90
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '한방');

-- Initial fixed benefit matching rules
INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'CANCER_DIAGNOSIS', '암 진단비', '암진단,고액암진단,특정암진단,유사암진단,소액암진단', '수술,입원,항암,방사선',
       '암 진단 관련 정액형 담보를 찾습니다.', 10
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_DIAGNOSIS');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'CANCER_SURGERY', '암 수술비', '암수술,특정암수술,유사암수술', '진단,입원,항암',
       '암 수술 관련 정액형 담보를 찾습니다.', 20
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_SURGERY');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'CANCER_TREATMENT', '항암 치료비', '항암,방사선,약물치료,표적항암,양성자방사선,세기조절방사선', NULL,
       '항암 치료 관련 정액형 담보를 찾습니다.', 30
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_TREATMENT');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'HOSPITALIZATION_DAILY', '입원일당', '입원일당,입원비,중환자실입원일당', '수술',
       '질병/상해/암 입원일당 담보를 찾습니다.', 40
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'HOSPITALIZATION_DAILY');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'SURGERY_BENEFIT', '수술비', '수술비,질병수술,상해수술,특정질병수술,기타수술,종수술', '진단,입원일당',
       '질병/상해/기타 수술 정액형 담보를 찾습니다.', 50
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'SURGERY_BENEFIT');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'FRACTURE_DIAGNOSIS', '골절 진단비', '골절진단,중대골절진단,5대골절', NULL,
       '골절 진단 관련 정액형 담보를 찾습니다.', 60
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'FRACTURE_DIAGNOSIS');

-- Initial actual loss benefit rules
INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '1-d', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       100, 0, 5000, 'FIXED_ONLY', FALSE, FALSE, '1세대 손해보험 통원 급여 기준 정액 공제', 10
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-d' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '1-h', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 5000, 'FIXED_ONLY', FALSE, FALSE, '1세대 생명보험 통원 급여 기준 정액 공제', 20
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-h' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '2', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '2세대 통원 급여 기준 max 공제', 30
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '2' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-s', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '3세대 표준 통원 급여 기준 max 공제', 40
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-s' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-c', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       70, 30, 10000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '3세대 착한실손 비급여 통원 기준', 50
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '4', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '4세대 급여 통원 기준', 60
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '4', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       70, 30, 30000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '4세대 비급여 통원 기준', 70
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

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
