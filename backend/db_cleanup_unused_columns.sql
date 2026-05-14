-- Cleanup for columns/tables removed from the application model.
-- Run this against an existing local database after the updated services are deployed.

USE medicatch_user;

DROP TABLE IF EXISTS codef_connections;

ALTER TABLE users
    DROP COLUMN IF EXISTS password,
    DROP COLUMN IF EXISTS user_id;

USE medicatch_analysis;

ALTER TABLE pre_treatment_searches
    DROP COLUMN IF EXISTS user_code;

USE medicatch_insurance;

ALTER TABLE policies
    DROP COLUMN IF EXISTS annual_premium,
    DROP COLUMN IF EXISTS terms;

ALTER TABLE coverage_items
    DROP COLUMN IF EXISTS coverage_rate,
    DROP COLUMN IF EXISTS deductible,
    DROP COLUMN IF EXISTS copay,
    DROP COLUMN IF EXISTS exclusions;

USE medicatch_health;

ALTER TABLE medical_records
    DROP COLUMN IF EXISTS medication_prescribed,
    DROP COLUMN IF EXISTS notes;

ALTER TABLE medication_details
    DROP COLUMN IF EXISTS medication_code,
    DROP COLUMN IF EXISTS side_effects,
    DROP COLUMN IF EXISTS warnings,
    DROP COLUMN IF EXISTS cost,
    DROP COLUMN IF EXISTS insurance_coverage;
