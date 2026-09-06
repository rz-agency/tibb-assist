-- Backfill dateOfBirth from age for rows that only have age set.
-- Uses January 1 of the year that would make them that age (approximate —
-- the exact date was never stored, so this is the best backfill possible).
UPDATE patient_profiles
SET date_of_birth = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL age YEAR), '%Y-01-01')
WHERE age IS NOT NULL AND date_of_birth IS NULL;

-- Drop the standalone age column — age is now always computed from
-- dateOfBirth in the application layer.
ALTER TABLE patient_profiles DROP COLUMN age;
