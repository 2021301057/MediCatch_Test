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
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '암', '위암,대장암,폐암,갑상선암,유사암,고액암,암진단,암수술,암입원,암통원,항암,항암치료,방사선치료', 'DISEASE', 'DIAGNOSIS', 'UNKNOWN', 'CANCER', NULL, 'CANCER', FALSE, '암 종류, 최초 진단 여부, 면책기간, 감액기간에 따라 실제 보장 여부가 달라질 수 있습니다.', 10
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '암');
UPDATE treatment_rules
SET synonyms = '위암,대장암,폐암,갑상선암,유사암,고액암,암진단,암수술,암입원,암통원,항암,항암치료,방사선치료'
WHERE keyword = '암'
  AND synonyms NOT LIKE '%암진단%';
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '골절', '뼈 골절,발목 골절,손목 골절,치아파절', 'INJURY', 'DIAGNOSIS', 'UNKNOWN', 'FRACTURE', NULL, 'FRACTURE_DIAGNOSIS', FALSE, '치아파절은 담보별 보장 제외 조건이 있을 수 있습니다.', 20
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '골절');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '입원', '입원치료,병실,중환자실', 'UNKNOWN', 'INPATIENT', 'COVERED', 'GENERAL', 'GENERAL_INPATIENT', 'HOSPITALIZATION_DAILY', TRUE, '상해 입원인지 질병 입원인지에 따라 적용 담보가 달라질 수 있습니다.', 30
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '입원');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '통원', '외래,외래진료,병원진료,의원진료', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', 'OUTPATIENT_DAILY', TRUE, '통원은 급여/비급여와 병원 규모에 따라 공제금이 달라질 수 있습니다.', 31
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '통원');
UPDATE treatment_rules
SET fixed_benefit_category = 'OUTPATIENT_DAILY'
WHERE keyword = '통원'
  AND fixed_benefit_category IS NULL;
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '약제', '약,처방약,처방전,조제약,복약', 'UNKNOWN', 'MEDICATION', 'COVERED', 'MEDICATION', 'MEDICATION', NULL, TRUE, '약제는 처방 조제 여부와 급여/비급여 여부 확인이 필요합니다.', 32
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '약제');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '수술', '수술비,질병수술,상해수술', 'UNKNOWN', 'SURGERY', 'MIXED', 'SURGERY', 'GENERAL_SURGERY', 'SURGERY_BENEFIT', TRUE, '질병/상해/암 수술 여부와 수술 분류에 따라 정액형 담보가 달라질 수 있습니다.', 40
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '수술');
UPDATE treatment_rules
SET synonyms = '수술비,질병수술,상해수술'
WHERE keyword = '수술'
  AND synonyms LIKE '%암수술%';
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '도수치료', '도수,수기치료,재활도수', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'REHAB', 'NON_COVERED_THREE', NULL, TRUE, '도수치료는 세대와 특약 가입 여부에 따라 보장 여부와 한도가 크게 달라질 수 있습니다.', 50
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '도수치료');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '물리치료', '재활치료,전기치료,운동치료,열치료', 'UNKNOWN', 'OUTPATIENT', 'COVERED', 'REHAB', 'GENERAL_OUTPATIENT', NULL, TRUE, '물리치료는 급여 항목인지 비급여 재활치료인지 확인이 필요합니다.', 51
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '물리치료');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '체외충격파', '충격파치료,체외충격파치료,ESWT', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'REHAB', 'NON_COVERED_THREE', NULL, TRUE, '체외충격파는 비급여 가능성이 높아 치료 목적과 세대별 비급여 보장 여부 확인이 필요합니다.', 52
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '체외충격파');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT 'MRI', '자기공명영상,엠알아이,MRA', 'UNKNOWN', 'TEST', 'MIXED', 'IMAGING', 'NON_COVERED_THREE', NULL, TRUE, 'MRI/MRA는 급여 여부와 비급여 특약 가입 여부에 따라 보장 판단이 달라질 수 있습니다.', 60
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'MRI');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '비급여주사', '주사치료,영양주사,증식치료,프롤로주사', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'INJECTION', 'NON_COVERED_THREE', NULL, TRUE, '비급여 주사는 치료 목적과 특약 가입 여부 확인이 필요합니다.', 70
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '비급여주사');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '치과', '치아,충치,잇몸,임플란트,스케일링', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'DENTAL', 'DENTAL', NULL, TRUE, '치과는 상해/질병과 급여/비급여 여부에 따라 보장 범위가 달라질 수 있습니다.', 80
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '치과');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '한방', '한의원,침,뜸,부항,추나요법,한약', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE', NULL, TRUE, '한방은 급여/비급여 여부와 세대별 면책 조건 확인이 필요합니다.', 90
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '한방');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '추나요법', '추나,한방추나,한의원추나', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE_CHUNA', NULL, TRUE, '추나요법은 2019년 4월 급여화 이후 급여 여부에 따라 보장 판단이 달라질 수 있습니다.', 91
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '추나요법');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '한약', '탕약,첩약,한방약,한의원약', 'DISEASE', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE_HERBAL', NULL, TRUE, '한약은 2세대 이후 비급여 면책 가능성이 높고, 1세대도 입원 중 처방 등 조건 확인이 필요합니다.', 92
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '한약');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '화상', '화상진단,열상,화상치료', 'INJURY', 'DIAGNOSIS', 'UNKNOWN', 'BURN', NULL, 'BURN_DIAGNOSIS', FALSE, '화상 진단비는 담보별 화상 분류와 진단 기준에 따라 달라질 수 있습니다.', 93
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '화상');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '사망후유장해', '사망,후유장해,상해사망,질병사망,상해후유장해', 'UNKNOWN', 'DIAGNOSIS', 'UNKNOWN', 'DEATH_DISABILITY', NULL, 'DEATH_DISABILITY', TRUE, '상해/질병 여부와 장해율에 따라 보장 담보가 달라질 수 있습니다.', 94
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '사망후유장해');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '뇌졸중', '뇌경색,뇌출혈,중풍,뇌혈관질환,뇌졸중진단,뇌혈관진단', 'DISEASE', 'INPATIENT', 'COVERED', 'CEREBROVASCULAR', 'GENERAL_INPATIENT', 'CEREBROVASCULAR', FALSE, '뇌졸중/뇌경색/뇌출혈은 진단 기준과 입원 여부에 따라 실손 및 정액형 보장 기준이 달라질 수 있습니다.', 25
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '뇌졸중');

-- Expanded common pre-treatment search terms
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '발목 인대 파열', '발목부상,발목 염좌,인대손상,인대파열,발목 통증,발목삐끗,발목삐끗함,발목접질림,접질림,염좌,발목염좌', 'INJURY', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '상해 통원/입원 여부와 검사·치료 항목의 급여 여부에 따라 실손 보장 기준이 달라질 수 있습니다.', 101
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '발목 인대 파열');
UPDATE treatment_rules
SET synonyms = '발목부상,발목 염좌,인대손상,인대파열,발목 통증,발목삐끗,발목삐끗함,발목접질림,접질림,염좌,발목염좌'
WHERE keyword = '발목 인대 파열'
  AND synonyms NOT LIKE '%삐끗%';
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '허리디스크', '추간판탈출증,디스크,요추디스크,목디스크,요통,허리 통증', 'DISEASE', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '검사, 주사, 수술, 물리치료 등 실제 치료 항목에 따라 급여/비급여와 보장 기준이 달라질 수 있습니다.', 102
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '허리디스크');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '감기', '상기도감염,목감기,코감기,기침,인후통', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, FALSE, '일반 외래 진료와 처방 약제는 급여 항목 중심으로 실손 확인이 가능합니다.', 103
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '감기');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '장염', '위장염,급성장염,복통,설사,구토', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '외래 진료인지 입원 치료인지에 따라 공제와 한도가 달라질 수 있습니다.', 104
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '장염');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '독감', '인플루엔자,독감검사,타미플루,독감치료', 'DISEASE', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '검사와 약제의 급여 여부에 따라 실손 보장 기준이 달라질 수 있습니다.', 105
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '독감');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '폐렴', '기관지폐렴,폐감염,호흡기감염', 'DISEASE', 'INPATIENT', 'COVERED', 'GENERAL', 'GENERAL_INPATIENT', 'HOSPITALIZATION_DAILY', TRUE, '외래 치료인지 입원 치료인지에 따라 실손 및 입원일당 담보 확인이 달라질 수 있습니다.', 106
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '폐렴');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '백내장', '백내장수술,인공수정체,다초점렌즈,노안수술', 'DISEASE', 'SURGERY', 'MIXED', 'SURGERY', 'GENERAL_SURGERY', 'SURGERY_BENEFIT', TRUE, '수술 목적, 렌즈 종류, 급여/비급여 여부에 따라 보장 판단이 달라질 수 있습니다.', 107
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '백내장');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '내시경', '위내시경,대장내시경,수면내시경,용종절제', 'DISEASE', 'TEST', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '검사 목적, 수면 여부, 용종 제거 등 처치 여부에 따라 급여/비급여와 보장 기준이 달라질 수 있습니다.', 108
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '내시경');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '초음파', '복부초음파,갑상선초음파,유방초음파,심장초음파', 'UNKNOWN', 'TEST', 'MIXED', 'IMAGING', 'NON_COVERED_THREE', NULL, TRUE, '초음파는 급여/비급여 여부에 따라 보장 기준이 다릅니다. 비급여 초음파는 세대별 비급여 특약 조건을 확인하세요.', 109
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '초음파');
UPDATE treatment_rules
SET actual_loss_category = 'NON_COVERED_THREE',
    caution_message      = '초음파는 급여/비급여 여부에 따라 보장 기준이 다릅니다. 비급여 초음파는 세대별 비급여 특약 조건을 확인하세요.'
WHERE keyword = '초음파'
  AND actual_loss_category = 'GENERAL_OUTPATIENT';
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT 'CT', '컴퓨터단층촬영,씨티,CT검사,복부CT,흉부CT', 'UNKNOWN', 'TEST', 'MIXED', 'IMAGING', 'NON_COVERED_THREE', NULL, TRUE, 'CT는 급여/비급여 여부에 따라 보장 기준이 다릅니다. 비급여 CT는 세대별 비급여 특약 조건을 확인하세요.', 110
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'CT');
UPDATE treatment_rules
SET actual_loss_category = 'NON_COVERED_THREE',
    caution_message      = 'CT는 급여/비급여 여부에 따라 보장 기준이 다릅니다. 비급여 CT는 세대별 비급여 특약 조건을 확인하세요.'
WHERE keyword = 'CT'
  AND actual_loss_category = 'GENERAL_OUTPATIENT';
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '치아파절', '치아 파절,치아깨짐,이빨 깨짐,치아 골절', 'INJURY', 'OUTPATIENT', 'MIXED', 'DENTAL', 'DENTAL_INJURY', 'FRACTURE_DIAGNOSIS', TRUE, '치아파절은 상해 치과 치료와 골절 담보가 함께 확인될 수 있으며, 담보별 제외 조건 확인이 필요합니다.', 111
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '치아파절');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '스케일링', '치석제거,치주치료,잇몸치료', 'DISEASE', 'OUTPATIENT', 'COVERED', 'DENTAL', 'DENTAL_DISEASE', NULL, TRUE, '치과 질병 치료는 세대별로 급여 보장 여부가 달라질 수 있습니다.', 112
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '스케일링');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '임플란트', '치과임플란트,인공치아,보철치료,치아보철', 'DISEASE', 'SURGERY', 'MIXED', 'DENTAL', 'DENTAL_DISEASE', NULL, TRUE, '임플란트는 치료 목적, 급여 인정 여부, 치과 질병 보장 범위에 따라 보장 판단이 달라질 수 있습니다.', 113
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '임플란트');

-- Step 2: 추가 검색어 seed (근골격·소화기·만성질환·피부·비뇨기)
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '무릎통증', '슬관절통증,무릎관절,무릎연골,반월상연골,슬개골통증,무릎관절염', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '통증 원인(상해/질병)과 치료 항목(주사·물리치료·수술 등)에 따라 급여/비급여와 실손 보장 기준이 달라집니다.', 120
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '무릎통증');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '어깨통증', '어깨관절통,어깨결림,오십견,어깨충돌증후군,동결견,견관절통', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '통증 원인과 치료 방법(도수치료·주사·수술 등)에 따라 보장 기준이 달라질 수 있습니다.', 121
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '어깨통증');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '회전근개파열', '회전근개,어깨힘줄파열,극상근파열,극하근파열,어깨파열,회전근개손상', 'INJURY', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', 'SURGERY_BENEFIT', TRUE, '수술로 이어질 경우 수술비 담보도 확인이 필요하며, 도수치료·주사 등 비급여 치료 포함 여부에 따라 보장 기준이 달라집니다.', 122
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '회전근개파열');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '손목터널증후군', '수근관증후군,손목터널,손목저림,정중신경압박,손저림', 'DISEASE', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '보존치료(주사·물리치료)와 수술치료 여부에 따라 보장 기준이 달라질 수 있습니다.', 123
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '손목터널증후군');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '비염', '알레르기비염,만성비염,코막힘,비강염,코알레르기,통년성비염', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, FALSE, NULL, 124
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '비염');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '축농증', '부비동염,만성부비동염,비용종,후비루,코수술', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '수술적 치료(내시경 수술 등)가 필요한 경우 수술비 담보 확인이 별도로 필요합니다.', 125
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '축농증');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '위염', '만성위염,급성위염,위궤양,헬리코박터,소화불량,속쓰림', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, FALSE, NULL, 126
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '위염');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '역류성식도염', '위식도역류,GERD,식도염,가슴쓰림,위산역류,역류', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, FALSE, NULL, 127
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '역류성식도염');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '당뇨', '당뇨병,제1형당뇨,제2형당뇨,혈당,인슐린,당뇨합병증,혈당관리', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, FALSE, '당뇨 관련 합병증 치료는 항목에 따라 급여/비급여 여부가 다를 수 있습니다.', 128
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '당뇨');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '고혈압', '혈압,고혈압증,혈압약,혈압치료,고혈압관리', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, FALSE, NULL, 129
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '고혈압');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '갑상선질환', '갑상선,갑상선염,갑상선기능항진,갑상선기능저하,갑상선결절,갑상선호르몬', 'DISEASE', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '갑상선암으로 진단될 경우 암 담보 확인이 필요하며, 수술 시 수술비 담보도 함께 확인하세요.', 130
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '갑상선질환');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '피부질환', '피부병,아토피,건선,두드러기,습진,피부염,피부과,아토피피부염', 'DISEASE', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '치료 목적(질병)인지 미용 목적인지에 따라 보장 여부가 달라지며, 비급여 시술은 실손 보장이 제한될 수 있습니다.', 131
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '피부질환');
INSERT INTO treatment_rules (keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category, actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority)
SELECT '요로결석', '신장결석,방광결석,요관결석,콩팥결석,결석치료,쇄석술', 'DISEASE', 'OUTPATIENT', 'MIXED', 'GENERAL', 'GENERAL_OUTPATIENT', NULL, TRUE, '체외충격파쇄석술은 급여 항목이나 입원 치료가 필요한 경우 입원 담보 확인도 필요합니다.', 132
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '요로결석');

-- Initial fixed benefit matching rules
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'CANCER_DIAGNOSIS', '암 진단비', '암진단,고액암진단,특정암진단,유사암진단,소액암진단', '수술,입원,항암,방사선', '암 진단 관련 정액형 담보를 찾습니다.', 10
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_DIAGNOSIS');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'CANCER_SURGERY', '암 수술비', '암수술,특정암수술,유사암수술', '진단,입원,항암', '암 수술 관련 정액형 담보를 찾습니다.', 20
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_SURGERY');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'CANCER_TREATMENT', '항암 치료비', '항암,방사선,약물치료,표적항암,양성자방사선,세기조절방사선', NULL, '항암 치료 관련 정액형 담보를 찾습니다.', 30
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_TREATMENT');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'HOSPITALIZATION_DAILY', '입원일당', '입원일당,입원비,중환자실입원일당', '수술', '질병/상해/암 입원일당 담보를 찾습니다.', 40
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'HOSPITALIZATION_DAILY');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'SURGERY_BENEFIT', '수술비', '수술비,질병수술,상해수술,특정질병수술,기타수술,종수술', '진단,입원일당', '질병/상해/기타 수술 정액형 담보를 찾습니다.', 50
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'SURGERY_BENEFIT');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'FRACTURE_DIAGNOSIS', '골절 진단비', '골절진단,중대골절진단,5대골절', NULL, '골절 진단 관련 정액형 담보를 찾습니다.', 60
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'FRACTURE_DIAGNOSIS');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'BURN_DIAGNOSIS', '화상 진단비', '화상진단,화상 진단,중증화상', NULL, '화상 진단 관련 정액형 담보를 찾습니다.', 70
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'BURN_DIAGNOSIS');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'DEATH_DISABILITY_INJURY', '상해 사망·후유장해', '상해사망,상해후유장해,일반상해 사망후유장해,상해50%이상후유장해', '질병', '상해 사망 및 후유장해 관련 정액형 담보를 찾습니다.', 80
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'DEATH_DISABILITY_INJURY');
UPDATE fixed_benefit_match_rules
SET fixed_benefit_category = 'DEATH_DISABILITY_INJURY'
WHERE fixed_benefit_category = 'INJURY_DEATH_DISABILITY';
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'DEATH_DISABILITY_DISEASE', '질병 사망', '질병사망,질병 사망', '상해', '질병 사망 관련 정액형 담보를 찾습니다.', 90
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'DEATH_DISABILITY_DISEASE');
UPDATE fixed_benefit_match_rules
SET fixed_benefit_category = 'DEATH_DISABILITY_DISEASE'
WHERE fixed_benefit_category = 'DISEASE_DEATH';
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'OUTPATIENT_DAILY', '통원 담보', '통원,외래,통원의료비,암통원', '실손의료비', '정액형 통원 담보를 찾습니다.', 100
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'OUTPATIENT_DAILY');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'DEATH_DISABILITY', '사망·후유장해', '사망보험금,사망,후유장해,상해사망,질병사망,상해후유장해,재해사망,일반사망', NULL, '사망 및 후유장해 관련 정액형 담보를 찾습니다.', 85
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'DEATH_DISABILITY');
INSERT INTO fixed_benefit_match_rules (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'CEREBROVASCULAR', '뇌혈관 진단비', '뇌혈관진단,뇌졸중진단,뇌경색진단,뇌출혈진단,뇌혈관', NULL, '뇌졸중/뇌혈관 관련 정액형 진단비 담보를 찾습니다.', 95
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CEREBROVASCULAR');

-- Initial actual loss benefit rules
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '1-d', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 100, 0, 5000, 'FIXED_ONLY', FALSE, FALSE, '1세대 손해보험 통원 급여 기준 정액 공제', 10
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-d' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '1-h', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 5000, 'FIXED_ONLY', FALSE, FALSE, '1세대 생명보험 통원 급여 기준 정액 공제', 20
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-h' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '2', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '2세대 통원 급여 기준 max 공제', 30
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '2' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '3-s', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '3세대 표준 통원 급여 기준 max 공제', 40
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-s' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '3-c', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '3세대 착한실손 통원 급여 기준 max 공제', 45
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '4', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '4세대 급여 통원 기준', 60
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '1-d', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 100, 0, 5000, 'FIXED_ONLY', FALSE, FALSE, '1세대 손해보험 통원 비급여 기준 정액 공제', 11
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-d' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '1-h', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 5000, 'FIXED_ONLY', FALSE, FALSE, '1세대 생명보험 통원 비급여 기준 총액 80% 보장', 21
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-h' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '2', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '2세대 통원 비급여 기준 max 공제', 31
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '2' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '3-s', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '3세대 표준 통원 비급여 기준 max 공제', 41
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-s' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '3-c', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 70, 30, 10000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '3세대 착한실손 비급여 통원 기준', 50
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT '4', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT', 70, 30, 30000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '4세대 비급여 통원 기준', 70
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

-- Non-covered three item rules
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, limit_amount, limit_count, requires_rider, is_excluded, note, priority)
SELECT generation_code, 'OUTPATIENT', 'NON_COVERED', treatment_category, 'NON_COVERED_THREE', reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, limit_amount, limit_count, requires_rider, FALSE, note, priority
FROM (
    SELECT '1-d' generation_code, 'REHAB' treatment_category, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, NULL limit_amount, NULL limit_count, FALSE requires_rider, '1세대 손해보험 비급여 3종 기본 포함' note, 111 priority
    UNION ALL SELECT '1-h', 'REHAB', 80, 20, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1세대 생명보험 비급여 3종 총액 80% 기준', 112
    UNION ALL SELECT '2', 'REHAB', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '2세대 비급여 3종 기본 포함', 113
    UNION ALL SELECT '3-s', 'REHAB', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '3세대 표준 비급여 3종 기본 포함', 114
    UNION ALL SELECT '3-c', 'REHAB', 70, 30, 10000, 'MAX_FIXED_OR_RATE', 3500000, 50, TRUE, '3세대 착한실손 도수·체외충격파·증식치료 특약: 연 350만원 / 50회', 115
    UNION ALL SELECT '4', 'REHAB', 70, 30, 30000, 'MAX_FIXED_OR_RATE', 3500000, 50, TRUE, '4세대 도수·체외충격파·증식치료 특약: 연 350만원 / 50회', 116
    UNION ALL SELECT '1-d', 'INJECTION', 100, 0, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1세대 손해보험 비급여 주사 기본 포함', 121
    UNION ALL SELECT '1-h', 'INJECTION', 80, 20, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1세대 생명보험 비급여 주사 총액 80% 기준', 122
    UNION ALL SELECT '2', 'INJECTION', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '2세대 비급여 주사 기본 포함', 123
    UNION ALL SELECT '3-s', 'INJECTION', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '3세대 표준 비급여 주사 기본 포함', 124
    UNION ALL SELECT '3-c', 'INJECTION', 70, 30, 10000, 'MAX_FIXED_OR_RATE', 2500000, 50, TRUE, '3세대 착한실손 비급여 주사 특약: 연 250만원 / 50회', 125
    UNION ALL SELECT '4', 'INJECTION', 70, 30, 30000, 'MAX_FIXED_OR_RATE', 2500000, 50, TRUE, '4세대 비급여 주사 특약: 연 250만원 / 50회', 126
    UNION ALL SELECT '1-d', 'IMAGING', 100, 0, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1세대 손해보험 비급여 MRI/MRA 기본 포함', 131
    UNION ALL SELECT '1-h', 'IMAGING', 80, 20, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1세대 생명보험 비급여 MRI/MRA 총액 80% 기준', 132
    UNION ALL SELECT '2', 'IMAGING', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '2세대 비급여 MRI/MRA 기본 포함', 133
    UNION ALL SELECT '3-s', 'IMAGING', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '3세대 표준 비급여 MRI/MRA 기본 포함', 134
    UNION ALL SELECT '3-c', 'IMAGING', 70, 30, 10000, 'MAX_FIXED_OR_RATE', 3000000, NULL, TRUE, '3세대 착한실손 비급여 MRI/MRA 특약: 연 300만원 / 횟수 제한 없음', 135
    UNION ALL SELECT '4', 'IMAGING', 70, 30, 30000, 'MAX_FIXED_OR_RATE', 3000000, NULL, TRUE, '4세대 비급여 MRI/MRA 특약: 연 300만원 / 횟수 제한 없음', 136
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.care_type = 'OUTPATIENT'
      AND r.benefit_type = 'NON_COVERED' AND r.treatment_category = seed.treatment_category
      AND r.actual_loss_category = 'NON_COVERED_THREE'
);

-- Dental rules
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT generation_code, 'OUTPATIENT', 'MIXED', 'DENTAL', 'DENTAL_INJURY', reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, FALSE, FALSE, '치과 상해: 전 세대 급여+비급여 보상 가능', priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, 201 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', 202
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 203
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 204
    UNION ALL SELECT '3-c', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 205
    UNION ALL SELECT '4', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 206
) seed
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules r WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'DENTAL_INJURY');
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT generation_code, 'OUTPATIENT', 'COVERED', 'DENTAL', 'DENTAL_DISEASE', reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, FALSE, is_excluded, note, priority
FROM (
    SELECT '1-d' generation_code, 0 reimbursement_rate, 100 patient_copay_rate, NULL fixed_deductible, 'EXCLUDED' deductible_method, TRUE is_excluded, '1세대 손해보험 치과 질병 보상 제외' note, 211 priority
    UNION ALL SELECT '1-h', 0, 100, NULL, 'EXCLUDED', TRUE, '1세대 생명보험 치과 질병 보상 제외', 212
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '2세대부터 치과 질병 급여만 보상', 213
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '3세대 표준 치과 질병 급여만 보상', 214
    UNION ALL SELECT '3-c', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '3세대 착한실손 치과 질병 급여만 보상', 215
    UNION ALL SELECT '4', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '4세대 치과 질병 급여만 보상', 216
) seed
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules r WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'DENTAL_DISEASE');

-- Korean medicine rules
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT generation_code, care_type, benefit_type, 'KOREAN_MEDICINE', actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, FALSE, is_excluded, note, priority
FROM (
    SELECT '1-d' generation_code, 'OUTPATIENT' care_type, 'COVERED' benefit_type, 'KOREAN_MEDICINE_COVERED' actual_loss_category, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, FALSE is_excluded, '한방 급여: 전 세대 보상 가능' note, 301 priority
    UNION ALL SELECT '1-h', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_COVERED', 80, 20, 5000, 'FIXED_ONLY', FALSE, '한방 급여: 전 세대 보상 가능', 302
    UNION ALL SELECT '2', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_COVERED', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '한방 급여: 전 세대 보상 가능', 303
    UNION ALL SELECT '3-s', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_COVERED', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '한방 급여: 전 세대 보상 가능', 304
    UNION ALL SELECT '3-c', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_COVERED', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '한방 급여: 전 세대 보상 가능', 305
    UNION ALL SELECT '4', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_COVERED', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '한방 급여: 전 세대 보상 가능', 306
    UNION ALL SELECT '1-d', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 100, 0, 5000, 'FIXED_ONLY', FALSE, '1세대 손해보험 한방 비급여 보상 가능', 321
    UNION ALL SELECT '1-h', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 80, 20, 5000, 'FIXED_ONLY', FALSE, '1세대 생명보험 한방 비급여 총액 80% 기준', 322
    UNION ALL SELECT '2', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 0, 100, NULL, 'EXCLUDED', TRUE, '2세대 이후 한방 비급여는 원칙적으로 면책', 323
    UNION ALL SELECT '3-s', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 0, 100, NULL, 'EXCLUDED', TRUE, '3세대 표준 한방 비급여는 원칙적으로 면책', 324
    UNION ALL SELECT '3-c', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 0, 100, NULL, 'EXCLUDED', TRUE, '3세대 착한실손 한방 비급여는 원칙적으로 면책', 325
    UNION ALL SELECT '4', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 0, 100, NULL, 'EXCLUDED', TRUE, '4세대 한방 비급여는 원칙적으로 면책', 326
    UNION ALL SELECT '1-d', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_CHUNA', 100, 0, 5000, 'FIXED_ONLY', FALSE, '추나요법: 2019년 4월 급여화 이후 급여 본인부담 보상 가능, 연 20회 한도', 331
    UNION ALL SELECT '1-h', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_CHUNA', 80, 20, 5000, 'FIXED_ONLY', FALSE, '추나요법: 2019년 4월 급여화 이후 급여 본인부담 보상 가능, 연 20회 한도', 332
    UNION ALL SELECT '2', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_CHUNA', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '추나요법: 2019년 4월 급여화 이후 급여 본인부담 보상 가능, 연 20회 한도', 333
    UNION ALL SELECT '3-s', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_CHUNA', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '추나요법: 2019년 4월 급여화 이후 급여 본인부담 보상 가능, 연 20회 한도', 334
    UNION ALL SELECT '3-c', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_CHUNA', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '추나요법: 2019년 4월 급여화 이후 급여 본인부담 보상 가능, 연 20회 한도', 335
    UNION ALL SELECT '4', 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE_CHUNA', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, '추나요법: 2019년 4월 급여화 이후 급여 본인부담 보상 가능, 연 20회 한도', 336
    UNION ALL SELECT '1-d', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE_HERBAL', 100, 0, 5000, 'FIXED_ONLY', FALSE, '1세대 손해보험 한약은 입원 중 처방 약제 등 조건부 보상 가능', 341
    UNION ALL SELECT '1-h', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE_HERBAL', 80, 20, 5000, 'FIXED_ONLY', FALSE, '1세대 생명보험 한약은 입원 중 처방 약제 등 조건부 보상 가능, 총액 80% 기준', 342
    UNION ALL SELECT '2', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE_HERBAL', 0, 100, NULL, 'EXCLUDED', TRUE, '2세대 이후 한약 비급여는 원칙적으로 면책', 343
    UNION ALL SELECT '3-s', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE_HERBAL', 0, 100, NULL, 'EXCLUDED', TRUE, '3세대 표준 한약 비급여는 원칙적으로 면책', 344
    UNION ALL SELECT '3-c', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE_HERBAL', 0, 100, NULL, 'EXCLUDED', TRUE, '3세대 착한실손 한약 비급여는 원칙적으로 면책', 345
    UNION ALL SELECT '4', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE_HERBAL', 0, 100, NULL, 'EXCLUDED', TRUE, '4세대 한약 비급여는 원칙적으로 면책', 346
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.care_type = seed.care_type
      AND r.benefit_type = seed.benefit_type AND r.actual_loss_category = seed.actual_loss_category
);

-- General inpatient rules (GENERAL_INPATIENT) - AI fallback 조회용
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT gen, 'INPATIENT', btype, 'GENERAL', 'GENERAL_INPATIENT', reimb, copay, NULL, 'MAX_FIXED_OR_RATE', rider, FALSE, memo, prio
FROM (
    SELECT '1-d' gen, 'COVERED' btype, 100 reimb, 0 copay, FALSE rider, '1세대 손해보험 입원 급여 기준' memo, 410 prio
    UNION ALL SELECT '1-d', 'NON_COVERED', 100, 0, FALSE, '1세대 손해보험 입원 비급여 기준', 411
    UNION ALL SELECT '1-h', 'COVERED', 80, 20, FALSE, '1세대 생명보험 입원 급여 기준', 420
    UNION ALL SELECT '1-h', 'NON_COVERED', 80, 20, FALSE, '1세대 생명보험 입원 비급여 기준', 421
    UNION ALL SELECT '2', 'COVERED', 90, 10, FALSE, '2세대 입원 급여 (본인부담 10%)', 430
    UNION ALL SELECT '2', 'NON_COVERED', 80, 20, FALSE, '2세대 입원 비급여 기준', 431
    UNION ALL SELECT '3-s', 'COVERED', 90, 10, FALSE, '3세대 표준 입원 급여 기준', 440
    UNION ALL SELECT '3-s', 'NON_COVERED', 80, 20, FALSE, '3세대 표준 입원 비급여 기준', 441
    UNION ALL SELECT '3-c', 'COVERED', 90, 10, FALSE, '3세대 착한실손 입원 급여 기준', 450
    UNION ALL SELECT '3-c', 'NON_COVERED', 70, 30, TRUE, '3세대 착한실손 입원 비급여 기준 (특약 필요)', 451
    UNION ALL SELECT '4', 'COVERED', 90, 10, FALSE, '4세대 입원 급여 기준', 460
    UNION ALL SELECT '4', 'NON_COVERED', 70, 30, TRUE, '4세대 입원 비급여 기준 (특약 필요)', 461
) t
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = t.gen AND r.care_type = 'INPATIENT'
      AND r.benefit_type = t.btype AND r.actual_loss_category = 'GENERAL_INPATIENT'
);

-- General surgery rules (GENERAL_SURGERY) - AI fallback 조회용
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT gen, 'SURGERY', btype, 'GENERAL', 'GENERAL_SURGERY', reimb, copay, NULL, 'MAX_FIXED_OR_RATE', rider, FALSE, memo, prio
FROM (
    SELECT '1-d' gen, 'COVERED' btype, 100 reimb, 0 copay, FALSE rider, '1세대 손해보험 수술 급여 기준' memo, 510 prio
    UNION ALL SELECT '1-d', 'NON_COVERED', 100, 0, FALSE, '1세대 손해보험 수술 비급여 기준', 511
    UNION ALL SELECT '1-h', 'COVERED', 80, 20, FALSE, '1세대 생명보험 수술 급여 기준', 520
    UNION ALL SELECT '1-h', 'NON_COVERED', 80, 20, FALSE, '1세대 생명보험 수술 비급여 기준', 521
    UNION ALL SELECT '2', 'COVERED', 80, 20, FALSE, '2세대 수술 급여 기준', 530
    UNION ALL SELECT '2', 'NON_COVERED', 80, 20, FALSE, '2세대 수술 비급여 기준', 531
    UNION ALL SELECT '3-s', 'COVERED', 80, 20, FALSE, '3세대 표준 수술 급여 기준', 540
    UNION ALL SELECT '3-s', 'NON_COVERED', 80, 20, FALSE, '3세대 표준 수술 비급여 기준', 541
    UNION ALL SELECT '3-c', 'COVERED', 80, 20, FALSE, '3세대 착한실손 수술 급여 기준', 550
    UNION ALL SELECT '3-c', 'NON_COVERED', 70, 30, TRUE, '3세대 착한실손 수술 비급여 기준 (특약 필요)', 551
    UNION ALL SELECT '4', 'COVERED', 80, 20, FALSE, '4세대 수술 급여 기준', 560
    UNION ALL SELECT '4', 'NON_COVERED', 70, 30, TRUE, '4세대 수술 비급여 기준 (특약 필요)', 561
) t
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = t.gen AND r.care_type = 'SURGERY'
      AND r.benefit_type = t.btype AND r.actual_loss_category = 'GENERAL_SURGERY'
);

-- Medication rules (MEDICATION) - AI fallback 조회용
INSERT INTO insurance_benefit_rules (generation_code, care_type, benefit_type, treatment_category, actual_loss_category, reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method, requires_rider, is_excluded, note, priority)
SELECT gen, 'MEDICATION', 'COVERED', 'MEDICATION', 'MEDICATION', reimb, copay, deductible, 'MAX_FIXED_OR_RATE', FALSE, FALSE, memo, prio
FROM (
    SELECT '1-d' gen, 100 reimb, 0 copay, 5000 deductible, '1세대 손해보험 약제 급여 기준 (5천원 공제)' memo, 610 prio
    UNION ALL SELECT '1-h', 80, 20, 5000, '1세대 생명보험 약제 급여 기준 (5천원 공제)', 620
    UNION ALL SELECT '2', 80, 20, 8000, '2세대 약제 급여 기준 (8천원 공제)', 630
    UNION ALL SELECT '3-s', 80, 20, 8000, '3세대 표준 약제 급여 기준 (8천원 공제)', 640
    UNION ALL SELECT '3-c', 80, 20, 8000, '3세대 착한실손 약제 급여 기준 (8천원 공제)', 650
    UNION ALL SELECT '4', 80, 20, 8000, '4세대 약제 급여 기준 (8천원 공제)', 660
) t
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = t.gen AND r.care_type = 'MEDICATION'
      AND r.actual_loss_category = 'MEDICATION'
);

UPDATE insurance_benefit_rules
SET note = CONCAT(COALESCE(note, ''), ' 4세대 비급여 보험료 할증: 연간 비급여 보험금 없음 약 5% 할인, 100만원 미만 유지, 100만~150만원 100% 할증, 150만~300만원 200% 할증, 300만원 이상 300% 할증. 비급여 순보험료 기준이며 예외 대상이 있을 수 있습니다.')
WHERE generation_code = '4'
  AND benefit_type = 'NON_COVERED'
  AND is_excluded = FALSE
  AND (note IS NULL OR note NOT LIKE '%4세대 비급여 보험료 할증%');

-- Normalize rule activation flags for existing databases and copied seed runs
ALTER TABLE treatment_rules MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE fixed_benefit_match_rules MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE insurance_benefit_rules MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE;

UPDATE treatment_rules SET is_active = TRUE WHERE is_active IS NULL;
UPDATE fixed_benefit_match_rules SET is_active = TRUE WHERE is_active IS NULL;
UPDATE insurance_benefit_rules SET is_active = TRUE WHERE is_active IS NULL;

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
VALUES ('test@medicatch.com', '$2b$10$Nt6r8LmhSKhZmD60LqPZ2.EWb62KpEup5wiiXKKX55c3YDjRCZNmC', '김건강', '1989-05-15', 'M')
ON DUPLICATE KEY UPDATE email=VALUES(email);

-- Insert sample policies
USE medicatch_insurance;
INSERT INTO policies (user_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount)
VALUES (1, 'POL-001-2024', 'Sample Insurance', 'NATIONAL_HEALTH', '2024-01-01', '2025-12-31', TRUE, 150000, 150000)
ON DUPLICATE KEY UPDATE policy_number=VALUES(policy_number);

-- Insert sample coverage items
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, is_covered, priority)
VALUES
    (1, 'Outpatient', 'OUTPATIENT', 10000000, TRUE, 1),
    (1, 'Inpatient', 'INPATIENT', 50000000, TRUE, 2),
    (1, 'Medication', 'MEDICATION', 5000000, TRUE, 3),
    (1, 'Surgery', 'SURGERY', 30000000, TRUE, 4)
ON DUPLICATE KEY UPDATE item_name=VALUES(item_name);

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
