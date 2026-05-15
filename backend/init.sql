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
INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '??, '?ÑÏïî,?Ä?•Ïïî,?êÏïî,Í∞ëÏÉÅ?†Ïïî,?†ÏÇ¨??Í≥†Ïï°??, 'DISEASE', 'DIAGNOSIS', 'UNKNOWN', 'CANCER',
       NULL, 'CANCER', FALSE, '??Ï¢ÖÎ•ò, ÏµúÏ¥à ÏßÑÎã® ?¨Î?, Î©¥Ï±ÖÍ∏∞Í∞Ñ, Í∞êÏï°Í∏∞Í∞Ñ???∞Îùº ?§Ï†ú Î≥¥Ïû• ?¨Î?Í∞Ä ?¨ÎùºÏß????àÏäµ?àÎã§.', 10
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '??);

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'Í≥®Ï†à', 'Îº?Í≥®Ï†à,Î∞úÎ™© Í≥®Ï†à,?êÎ™© Í≥®Ï†à,ÏπòÏïÑ?åÏ†à', 'INJURY', 'DIAGNOSIS', 'UNKNOWN', 'FRACTURE',
       NULL, 'FRACTURE_DIAGNOSIS', FALSE, 'ÏπòÏïÑ?åÏ†à?Ä ?¥Î≥¥Î≥?Î≥¥Ïû• ?úÏô∏ Ï°∞Í±¥???àÏùÑ ???àÏäµ?àÎã§.', 20
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'Í≥®Ï†à');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?ÖÏõê', '?ÖÏõêÏπòÎ£å,Î≥ëÏã§,Ï§ëÌôò?êÏã§', 'UNKNOWN', 'INPATIENT', 'COVERED', 'GENERAL',
       'GENERAL_INPATIENT', 'HOSPITALIZATION_DAILY', TRUE, '?ÅÌï¥ ?ÖÏõê?∏Ï? ÏßàÎ≥ë ?ÖÏõê?∏Ï????∞Îùº ?ÅÏö© ?¥Î≥¥Í∞Ä ?¨ÎùºÏß????àÏäµ?àÎã§.', 30
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?ÖÏõê');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?òÏà†', '?òÏà†Îπ?ÏßàÎ≥ë?òÏà†,?ÅÌï¥?òÏà†,?îÏàò??, 'UNKNOWN', 'SURGERY', 'MIXED', 'SURGERY',
       'GENERAL_SURGERY', 'SURGERY_BENEFIT', TRUE, 'ÏßàÎ≥ë/?ÅÌï¥/???òÏà† ?¨Î??Ä ?òÏà† Î∂ÑÎ•ò???∞Îùº ?ïÏï°???¥Î≥¥Í∞Ä ?¨ÎùºÏß????àÏäµ?àÎã§.', 40
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?òÏà†');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?ÑÏàòÏπòÎ£å', '?ÑÏàò,?òÍ∏∞ÏπòÎ£å,?¨Ìôú?ÑÏàò', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'REHAB',
       'NON_COVERED_THREE', NULL, TRUE, '?ÑÏàòÏπòÎ£å???∏Î??Ä ?πÏïΩ Í∞Ä???¨Î????∞Îùº Î≥¥Ïû• ?¨Î??Ä ?úÎèÑÍ∞Ä ?¨Í≤å ?¨ÎùºÏß????àÏäµ?àÎã§.', 50
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?ÑÏàòÏπòÎ£å');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'MRI', '?êÍ∏∞Í≥µÎ™Ö?ÅÏÉÅ,?†Ïïå?ÑÏù¥', 'UNKNOWN', 'TEST', 'MIXED', 'IMAGING',
       'NON_COVERED_THREE', NULL, TRUE, 'MRI??Í∏âÏó¨ ?¨Î??Ä ÎπÑÍ∏â???πÏïΩ Í∞Ä???¨Î????∞Îùº Î≥¥Ïû• ?êÎã®???¨ÎùºÏß????àÏäµ?àÎã§.', 60
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'MRI');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'ÎπÑÍ∏â?¨Ï£º??, 'Ï£ºÏÇ¨ÏπòÎ£å,?ÅÏñëÏ£ºÏÇ¨,Ï¶ùÏãùÏπòÎ£å,?ÑÎ°§Î°úÏ£º??, 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'INJECTION',
       'NON_COVERED_THREE', NULL, TRUE, 'ÎπÑÍ∏â??Ï£ºÏÇ¨??ÏπòÎ£å Î™©Ï†ÅÍ≥??πÏïΩ Í∞Ä???¨Î? ?ïÏù∏???ÑÏöî?©Îãà??', 70
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'ÎπÑÍ∏â?¨Ï£º??);

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'ÏπòÍ≥º', 'ÏπòÏïÑ,Ï∂©Ïπò,?áÎ™∏,?ÑÌîå?Ä???§Ï??ºÎßÅ', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'DENTAL',
       'DENTAL', NULL, TRUE, 'ÏπòÍ≥º ÏßàÎ≥ë ÏπòÎ£å???∏Î?Î≥ÑÎ°ú Í∏âÏó¨/ÎπÑÍ∏â??Î≥¥Ïû• Î≤îÏúÑÍ∞Ä ?¨ÎùºÏß????àÏäµ?àÎã§.', 80
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'ÏπòÍ≥º');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?úÎ∞©', '?úÏùò??Ïπ???Î∂Ä??Ï∂îÎÇò?îÎ≤ï,?úÏïΩ', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'KOREAN_MEDICINE',
       'KOREAN_MEDICINE', NULL, TRUE, '?úÎ∞© ÎπÑÍ∏â?¨Îäî 2?∏Î? ?¥ÌõÑ Î©¥Ï±Ö?òÎäî Í≤ΩÏö∞Í∞Ä ÎßéÏïÑ Í∏âÏó¨ ?¨Î? ?ïÏù∏???ÑÏöî?©Îãà??', 90
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?úÎ∞©');

-- Initial fixed benefit matching rules
INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'CANCER_DIAGNOSIS', '??ÏßÑÎã®Îπ?, '?îÏßÑ??Í≥†Ïï°?îÏßÑ???πÏ†ï?îÏßÑ???†ÏÇ¨?îÏßÑ???åÏï°?îÏßÑ??, '?òÏà†,?ÖÏõê,??ïî,Î∞©ÏÇ¨??,
       '??ÏßÑÎã® Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 10
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_DIAGNOSIS');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'CANCER_SURGERY', '???òÏà†Îπ?, '?îÏàò???πÏ†ï?îÏàò???†ÏÇ¨?îÏàò??, 'ÏßÑÎã®,?ÖÏõê,??ïî',
       '???òÏà† Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 20
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_SURGERY');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'CANCER_TREATMENT', '??ïî ÏπòÎ£åÎπ?, '??ïî,Î∞©ÏÇ¨???ΩÎ¨ºÏπòÎ£å,?úÏ†Å??ïî,?ëÏÑ±?êÎ∞©?¨ÏÑ†,?∏Í∏∞Ï°∞Ï†àÎ∞©ÏÇ¨??, NULL,
       '??ïî ÏπòÎ£å Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 30
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CANCER_TREATMENT');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'HOSPITALIZATION_DAILY', '?ÖÏõê?ºÎãπ', '?ÖÏõê?ºÎãπ,?ÖÏõêÎπ?Ï§ëÌôò?êÏã§?ÖÏõê?ºÎãπ', '?òÏà†',
       'ÏßàÎ≥ë/?ÅÌï¥/???ÖÏõê?ºÎãπ ?¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 40
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'HOSPITALIZATION_DAILY');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'SURGERY_BENEFIT', '?òÏà†Îπ?, '?òÏà†Îπ?ÏßàÎ≥ë?òÏà†,?ÅÌï¥?òÏà†,?πÏ†ïÏßàÎ≥ë?òÏà†,Í∏∞Ì??òÏà†,Ï¢ÖÏàò??, 'ÏßÑÎã®,?ÖÏõê?ºÎãπ',
       'ÏßàÎ≥ë/?ÅÌï¥/Í∏∞Ì? ?òÏà† ?ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 50
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'SURGERY_BENEFIT');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'FRACTURE_DIAGNOSIS', 'Í≥®Ï†à ÏßÑÎã®Îπ?, 'Í≥®Ï†àÏßÑÎã®,Ï§ëÎ?Í≥®Ï†àÏßÑÎã®,5?ÄÍ≥®Ï†à', NULL,
       'Í≥®Ï†à ÏßÑÎã® Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 60
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'FRACTURE_DIAGNOSIS');

-- Initial actual loss benefit rules
INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '1-d', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       100, 0, 5000, 'FIXED_ONLY', FALSE, FALSE, '1?∏Î? ?êÌï¥Î≥¥Ìóò ?µÏõê Í∏âÏó¨ Í∏∞Ï? ?ïÏï° Í≥µÏ†ú', 10
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-d' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '1-h', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 5000, 'FIXED_ONLY', FALSE, FALSE, '1?∏Î? ?ùÎ™ÖÎ≥¥Ìóò ?µÏõê Í∏âÏó¨ Í∏∞Ï? ?ïÏï° Í≥µÏ†ú', 20
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-h' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '2', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '2?∏Î? ?µÏõê Í∏âÏó¨ Í∏∞Ï? max Í≥µÏ†ú', 30
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '2' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-s', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '3?∏Î? ?úÏ? ?µÏõê Í∏âÏó¨ Í∏∞Ï? max Í≥µÏ†ú', 40
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-s' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-c', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       70, 30, 10000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '3?∏Î? Ï∞©Ìïú?§ÏÜê ÎπÑÍ∏â???µÏõê Í∏∞Ï?', 50
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '4', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '4?∏Î? Í∏âÏó¨ ?µÏõê Í∏∞Ï?', 60
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '4', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       70, 30, 30000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '4?∏Î? ÎπÑÍ∏â???µÏõê Í∏∞Ï?', 70
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

-- Expanded phase 1 treatment classification rules
INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?µÏõê', '?∏Îûò,?∏ÎûòÏßÑÎ£å,Î≥ëÏõêÏßÑÎ£å,?òÏõêÏßÑÎ£å', 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'GENERAL',
       'GENERAL_OUTPATIENT', NULL, TRUE, '?µÏõê?Ä Í∏âÏó¨/ÎπÑÍ∏â?¨Ï? Î≥ëÏõê Í∑úÎ™®???∞Îùº Í≥µÏ†úÍ∏àÏù¥ ?¨ÎùºÏß????àÏäµ?àÎã§.', 31
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?µÏõê');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?ΩÏ†ú', '??Ï≤òÎ∞©??Ï≤òÎ∞©??Ï°∞Ï†ú??Î≥µÏïΩ', 'UNKNOWN', 'MEDICATION', 'COVERED', 'MEDICATION',
       'MEDICATION', NULL, TRUE, '?ΩÏ†ú??Ï≤òÎ∞© Ï°∞Ï†ú ?¨Î??Ä Í∏âÏó¨/ÎπÑÍ∏â???¨Î? ?ïÏù∏???ÑÏöî?©Îãà??', 32
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?ΩÏ†ú');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'Î¨ºÎ¶¨ÏπòÎ£å', '?¨ÌôúÏπòÎ£å,?ÑÍ∏∞ÏπòÎ£å,?¥ÎèôÏπòÎ£å,?¥ÏπòÎ£?, 'UNKNOWN', 'OUTPATIENT', 'COVERED', 'REHAB',
       'GENERAL_OUTPATIENT', NULL, TRUE, 'Î¨ºÎ¶¨ÏπòÎ£å??Í∏âÏó¨ ??™©?∏Ï? ÎπÑÍ∏â???¨ÌôúÏπòÎ£å?∏Ï? ?ïÏù∏???ÑÏöî?©Îãà??', 51
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'Î¨ºÎ¶¨ÏπòÎ£å');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'Ï≤¥Ïô∏Ï∂©Í≤©??, 'Ï∂©Í≤©?åÏπòÎ£?Ï≤¥Ïô∏Ï∂©Í≤©?åÏπòÎ£?ESWT', 'UNKNOWN', 'OUTPATIENT', 'NON_COVERED', 'REHAB',
       'GENERAL_NON_COVERED', NULL, TRUE, 'Ï≤¥Ïô∏Ï∂©Í≤©?åÎäî ÎπÑÍ∏â??Í∞Ä?•ÏÑ±???íÏïÑ ÏπòÎ£å Î™©Ï†ÅÍ≥??∏Î?Î≥?ÎπÑÍ∏â??Î≥¥Ïû• ?¨Î? ?ïÏù∏???ÑÏöî?©Îãà??', 52
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'Ï≤¥Ïô∏Ï∂©Í≤©??);

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT 'Ï∂îÎÇò?îÎ≤ï', 'Ï∂îÎÇò,?úÎ∞©Ï∂îÎÇò,?úÏùò?êÏ∂î??, 'UNKNOWN', 'OUTPATIENT', 'MIXED', 'KOREAN_MEDICINE',
       'KOREAN_MEDICINE_CHUNA', NULL, TRUE, 'Ï∂îÎÇò?îÎ≤ï?Ä 2019??Í∏âÏó¨???¥ÌõÑ Í∏âÏó¨ ?¨Î????∞Îùº Î≥¥Ïû• ?êÎã®???¨ÎùºÏß????àÏäµ?àÎã§.', 91
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = 'Ï∂îÎÇò?îÎ≤ï');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?îÏÉÅ', '?îÏÉÅÏßÑÎã®,?¥ÏÉÅ,?îÏÉÅÏπòÎ£å', 'INJURY', 'DIAGNOSIS', 'UNKNOWN', 'BURN',
       NULL, 'BURN_DIAGNOSIS', FALSE, '?îÏÉÅ ÏßÑÎã®ÎπÑÎäî ?¥Î≥¥Î≥??îÏÉÅ Î∂ÑÎ•ò?Ä ÏßÑÎã® Í∏∞Ï????∞Îùº ?¨ÎùºÏß????àÏäµ?àÎã§.', 92
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?îÏÉÅ');

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '?¨Îßù?ÑÏú†?•Ìï¥', '?¨Îßù,?ÑÏú†?•Ìï¥,?ÅÌï¥?¨Îßù,ÏßàÎ≥ë?¨Îßù,?ÅÌï¥?ÑÏú†?•Ìï¥', 'UNKNOWN', 'DIAGNOSIS', 'UNKNOWN', 'DEATH_DISABILITY',
       NULL, 'DEATH_DISABILITY', TRUE, '?ÅÌï¥/ÏßàÎ≥ë ?¨Î??Ä ?•Ìï¥?®Ïóê ?∞Îùº Î≥¥Ïû• ?¥Î≥¥Í∞Ä ?¨ÎùºÏß????àÏäµ?àÎã§.', 93
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '?¨Îßù?ÑÏú†?•Ìï¥');

-- Expanded phase 1 fixed benefit matching rules
INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'BURN_DIAGNOSIS', '?îÏÉÅ ÏßÑÎã®Îπ?, '?îÏÉÅÏßÑÎã®,?îÏÉÅ ÏßÑÎã®,Ï§ëÏ¶ù?îÏÉÅ', NULL,
       '?îÏÉÅ ÏßÑÎã® Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 70
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'BURN_DIAGNOSIS');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'INJURY_DEATH_DISABILITY', '?ÅÌï¥ ?¨Îßù¬∑?ÑÏú†?•Ìï¥', '?ÅÌï¥?¨Îßù,?ÅÌï¥?ÑÏú†?•Ìï¥,?ºÎ∞ò?ÅÌï¥ ?¨Îßù?ÑÏú†?•Ìï¥,?ÅÌï¥50%?¥ÏÉÅ?ÑÏú†?•Ìï¥', 'ÏßàÎ≥ë',
       '?ÅÌï¥ ?¨Îßù Î∞??ÑÏú†?•Ìï¥ Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 80
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'INJURY_DEATH_DISABILITY');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'DISEASE_DEATH', 'ÏßàÎ≥ë ?¨Îßù', 'ÏßàÎ≥ë?¨Îßù,ÏßàÎ≥ë ?¨Îßù', '?ÅÌï¥',
       'ÏßàÎ≥ë ?¨Îßù Í¥Ä???ïÏï°???¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 90
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'DISEASE_DEATH');

INSERT INTO fixed_benefit_match_rules (
    fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority
)
SELECT 'OUTPATIENT_DAILY', '?µÏõê ?¥Î≥¥', '?µÏõê,?∏Îûò,?µÏõê?òÎ£åÎπ??îÌÜµ??, '?§ÏÜê?òÎ£åÎπ?,
       '?ïÏï°???µÏõê ?¥Î≥¥Î•?Ï∞æÏäµ?àÎã§.', 100
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'OUTPATIENT_DAILY');

-- Expanded phase 1 actual loss benefit rules
INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '1-d', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       100, 0, 5000, 'FIXED_ONLY', FALSE, FALSE, '1?∏Î? ?êÌï¥Î≥¥Ìóò ?µÏõê ÎπÑÍ∏â??Í∏∞Ï? ?ïÏï° Í≥µÏ†ú', 11
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-d' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '1-h', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       100, 0, 5000, 'FIXED_ONLY', FALSE, FALSE, '1?∏Î? ?ùÎ™ÖÎ≥¥Ìóò ?µÏõê ÎπÑÍ∏â??Í∏∞Ï? ?ïÏï° Í≥µÏ†ú', 21
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '1-h' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '2', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '2?∏Î? ?µÏõê ÎπÑÍ∏â??Í∏∞Ï? max Í≥µÏ†ú', 31
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '2' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-s', 'OUTPATIENT', 'NON_COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE, '3?∏Î? ?úÏ? ?µÏõê ÎπÑÍ∏â??Í∏∞Ï? max Í≥µÏ†ú', 41
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-s' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '4', 'OUTPATIENT', 'NON_COVERED', 'REHAB', 'NON_COVERED_THREE',
       70, 30, 30000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '4?∏Î? ÎπÑÍ∏â??3Ï¢ÖÏ? ?πÏïΩÍ≥??¥Ïö©??Í∏∞Ï? ?ïÏù∏???ÑÏöî?©Îãà??', 71
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'NON_COVERED_THREE');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-c', 'OUTPATIENT', 'NON_COVERED', 'REHAB', 'NON_COVERED_THREE',
       70, 30, 10000, 'MAX_FIXED_OR_RATE', TRUE, FALSE, '3?∏Î? Ï∞©Ìïú?§ÏÜê ÎπÑÍ∏â??3Ï¢ÖÏ? ?πÏïΩ Í∞Ä???¨Î? ?ïÏù∏???ÑÏöî?©Îãà??', 51
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'NON_COVERED_THREE');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '2', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE',
       0, 100, NULL, 'EXCLUDED', FALSE, TRUE, '2?∏Î? ?¥ÌõÑ ?úÎ∞© ÎπÑÍ∏â?¨Îäî ?êÏπô?ÅÏúºÎ°?Î©¥Ï±Ö Ï≤òÎ¶¨?©Îãà??', 120
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '2' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'KOREAN_MEDICINE');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-s', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE',
       0, 100, NULL, 'EXCLUDED', FALSE, TRUE, '3?∏Î? ?úÎ∞© ÎπÑÍ∏â?¨Îäî ?êÏπô?ÅÏúºÎ°?Î©¥Ï±Ö Ï≤òÎ¶¨?©Îãà??', 121
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '3-s' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'KOREAN_MEDICINE');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '4', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE',
       0, 100, NULL, 'EXCLUDED', FALSE, TRUE, '4?∏Î? ?úÎ∞© ÎπÑÍ∏â?¨Îäî ?êÏπô?ÅÏúºÎ°?Î©¥Ï±Ö Ï≤òÎ¶¨?©Îãà??', 122
WHERE NOT EXISTS (SELECT 1 FROM insurance_benefit_rules WHERE generation_code = '4' AND care_type = 'OUTPATIENT' AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'KOREAN_MEDICINE');


-- Actual loss rules aligned with generation comparison table
-- These rows refine the DB-driven pre-treatment search rules without deleting older seed rows.
UPDATE insurance_benefit_rules
SET reimbursement_rate = 80,
    patient_copay_rate = 20,
    note = '1-h non-covered outpatient: life insurer contracts generally reimburse 80 percent of total covered/non-covered amount; terms may vary.'
WHERE generation_code = '1-h'
  AND care_type = 'OUTPATIENT'
  AND benefit_type = 'NON_COVERED'
  AND actual_loss_category = 'GENERAL_OUTPATIENT';

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-c', 'OUTPATIENT', 'COVERED', 'GENERAL', 'GENERAL_OUTPATIENT',
       80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, FALSE,
       '3-c covered outpatient default rule: 80 percent reimbursement, max fixed/rate deductible.', 45
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules
    WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT'
      AND benefit_type = 'COVERED' AND actual_loss_category = 'GENERAL_OUTPATIENT'
);

UPDATE insurance_benefit_rules
SET limit_amount = 3500000,
    limit_count = 50,
    requires_rider = generation_code IN ('3-c', '4'),
    note = CASE
        WHEN generation_code IN ('3-c', '4') THEN 'Non-covered three item: manual therapy, extracorporeal shockwave, prolotherapy. Annual 3.5M KRW / 50 sessions. Rider required.'
        ELSE 'Non-covered three item included in base actual-loss coverage for this generation. Terms may vary.'
    END
WHERE actual_loss_category = 'NON_COVERED_THREE'
  AND treatment_category = 'REHAB';

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    limit_amount, limit_count, requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'NON_COVERED', 'REHAB', 'NON_COVERED_THREE',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       limit_amount, limit_count, requires_rider, FALSE, note, priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, NULL limit_amount, NULL limit_count, FALSE requires_rider, '1-d non-covered three included in base coverage.' note, 111 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1-h non-covered three follows 80 percent total reimbursement rule.', 112
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '2nd generation non-covered three included in base coverage.', 113
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '3-s non-covered three included in base coverage.', 114
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.care_type = 'OUTPATIENT'
      AND r.benefit_type = 'NON_COVERED' AND r.treatment_category = 'REHAB'
      AND r.actual_loss_category = 'NON_COVERED_THREE'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    limit_amount, limit_count, requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'NON_COVERED', 'INJECTION', 'NON_COVERED_THREE',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       limit_amount, limit_count, requires_rider, FALSE, note, priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, NULL limit_amount, NULL limit_count, FALSE requires_rider, '1-d non-covered injection included in base coverage.' note, 121 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1-h non-covered injection follows 80 percent total reimbursement rule.', 122
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '2nd generation non-covered injection included in base coverage.', 123
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '3-s non-covered injection included in base coverage.', 124
    UNION ALL SELECT '3-c', 70, 30, 10000, 'MAX_FIXED_OR_RATE', 2500000, 50, TRUE, '3-c non-covered injection rider. Annual 2.5M KRW / 50 sessions.', 125
    UNION ALL SELECT '4', 70, 30, 30000, 'MAX_FIXED_OR_RATE', 2500000, 50, TRUE, '4th generation non-covered injection rider. Annual 2.5M KRW / 50 sessions.', 126
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.care_type = 'OUTPATIENT'
      AND r.benefit_type = 'NON_COVERED' AND r.treatment_category = 'INJECTION'
      AND r.actual_loss_category = 'NON_COVERED_THREE'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    limit_amount, limit_count, requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'NON_COVERED', 'IMAGING', 'NON_COVERED_THREE',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       limit_amount, limit_count, requires_rider, FALSE, note, priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, NULL limit_amount, NULL limit_count, FALSE requires_rider, '1-d non-covered MRI/MRA included in base coverage.' note, 131 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', NULL, NULL, FALSE, '1-h non-covered MRI/MRA follows 80 percent total reimbursement rule.', 132
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '2nd generation non-covered MRI/MRA included in base coverage.', 133
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', NULL, NULL, FALSE, '3-s non-covered MRI/MRA included in base coverage.', 134
    UNION ALL SELECT '3-c', 70, 30, 10000, 'MAX_FIXED_OR_RATE', 3000000, NULL, TRUE, '3-c non-covered MRI/MRA rider. Annual 3M KRW, no fixed count limit.', 135
    UNION ALL SELECT '4', 70, 30, 30000, 'MAX_FIXED_OR_RATE', 3000000, NULL, TRUE, '4th generation non-covered MRI/MRA rider. Annual 3M KRW, no fixed count limit.', 136
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.care_type = 'OUTPATIENT'
      AND r.benefit_type = 'NON_COVERED' AND r.treatment_category = 'IMAGING'
      AND r.actual_loss_category = 'NON_COVERED_THREE'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'MIXED', 'DENTAL', 'DENTAL_INJURY',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       FALSE, FALSE, 'Dental injury: covered and non-covered treatment can be considered across generations.', priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, 201 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', 202
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 203
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 204
    UNION ALL SELECT '3-c', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 205
    UNION ALL SELECT '4', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 206
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'DENTAL_INJURY'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'COVERED', 'DENTAL', 'DENTAL_DISEASE',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       FALSE, is_excluded, note, priority
FROM (
    SELECT '1-d' generation_code, 0 reimbursement_rate, 100 patient_copay_rate, NULL fixed_deductible, 'EXCLUDED' deductible_method, TRUE is_excluded, 'Dental disease excluded in 1-d actual-loss contracts.' note, 211 priority
    UNION ALL SELECT '1-h', 0, 100, NULL, 'EXCLUDED', TRUE, 'Dental disease excluded in 1-h actual-loss contracts.', 212
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, 'Dental disease: covered treatment only from 2nd generation onward.', 213
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, 'Dental disease: covered treatment only.', 214
    UNION ALL SELECT '3-c', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, 'Dental disease: covered treatment only.', 215
    UNION ALL SELECT '4', 80, 20, 10000, 'MAX_FIXED_OR_RATE', FALSE, 'Dental disease: covered treatment only.', 216
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'DENTAL_DISEASE'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE_COVERED',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       FALSE, FALSE, 'Korean medicine covered treatment can be considered across generations.', priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, 301 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', 302
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 303
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 304
    UNION ALL SELECT '3-c', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 305
    UNION ALL SELECT '4', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 306
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'KOREAN_MEDICINE_COVERED'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT '3-c', 'OUTPATIENT', 'NON_COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE',
       0, 100, NULL, 'EXCLUDED', FALSE, TRUE, '3-c Korean medicine non-covered treatment is generally excluded.', 123
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules
    WHERE generation_code = '3-c' AND care_type = 'OUTPATIENT'
      AND benefit_type = 'NON_COVERED' AND actual_loss_category = 'KOREAN_MEDICINE'
);

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    limit_count, requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'OUTPATIENT', 'COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE_CHUNA',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       20, FALSE, FALSE, 'Chuna treatment: covered treatment after Apr 2019, annual 20-session limit.', priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, 331 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', 332
    UNION ALL SELECT '2', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 333
    UNION ALL SELECT '3-s', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 334
    UNION ALL SELECT '3-c', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 335
    UNION ALL SELECT '4', 80, 20, 10000, 'MAX_FIXED_OR_RATE', 336
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'KOREAN_MEDICINE_CHUNA'
);

INSERT INTO treatment_rules (
    keyword, synonyms, injury_disease_type, care_type, benefit_type, treatment_category,
    actual_loss_category, fixed_benefit_category, needs_user_confirmation, caution_message, priority
)
SELECT '«—æ‡', '≈¡æ‡,√∏æ‡,«—πÊæ‡,«—¿«ø¯æ‡', 'DISEASE', 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE',
       'KOREAN_MEDICINE_HERBAL', NULL, TRUE,
       'Herbal medicine is usually excluded from 2nd generation onward; 1st generation may only be conditional for inpatient prescription.', 92
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '«—æ‡');

INSERT INTO insurance_benefit_rules (
    generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
    reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
    requires_rider, is_excluded, note, priority
)
SELECT generation_code, 'MEDICATION', 'NON_COVERED', 'KOREAN_MEDICINE', 'KOREAN_MEDICINE_HERBAL',
       reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
       FALSE, is_excluded, note, priority
FROM (
    SELECT '1-d' generation_code, 100 reimbursement_rate, 0 patient_copay_rate, 5000 fixed_deductible, 'FIXED_ONLY' deductible_method, FALSE is_excluded, '1-d herbal medicine may be conditional when prescribed during inpatient treatment.' note, 341 priority
    UNION ALL SELECT '1-h', 80, 20, 5000, 'FIXED_ONLY', FALSE, '1-h herbal medicine may be conditional when prescribed during inpatient treatment; 80 percent total rule.', 342
    UNION ALL SELECT '2', 0, 100, NULL, 'EXCLUDED', TRUE, '2nd generation herbal medicine non-covered treatment is generally excluded.', 343
    UNION ALL SELECT '3-s', 0, 100, NULL, 'EXCLUDED', TRUE, '3-s herbal medicine non-covered treatment is generally excluded.', 344
    UNION ALL SELECT '3-c', 0, 100, NULL, 'EXCLUDED', TRUE, '3-c herbal medicine non-covered treatment is generally excluded.', 345
    UNION ALL SELECT '4', 0, 100, NULL, 'EXCLUDED', TRUE, '4th generation herbal medicine non-covered treatment is generally excluded.', 346
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = seed.generation_code AND r.actual_loss_category = 'KOREAN_MEDICINE_HERBAL'
);

UPDATE insurance_benefit_rules
SET note = CONCAT(COALESCE(note, ''), ' 4th generation surcharge note: annual non-covered payout none = about 5 percent discount; under 1M KRW = no change; 1M-1.5M = 100 percent surcharge; 1.5M-3M = 200 percent; 3M+ = 300 percent. Applies to non-covered risk premium only; exceptions may apply.')
WHERE generation_code = '4'
  AND benefit_type = 'NON_COVERED'
  AND is_excluded = FALSE
  AND (note IS NULL OR note NOT LIKE '%4th generation surcharge note%');
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
VALUES ('test@medicatch.com', '$2a$10$test', 'ÍπÄÍ±¥Í∞ï', '1989-05-15', 'M')
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
