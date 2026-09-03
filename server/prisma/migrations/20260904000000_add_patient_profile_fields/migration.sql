-- AlterTable: add new profile fields to patient_profiles
ALTER TABLE `patient_profiles`
  ADD COLUMN `date_of_birth` DATE NULL,
  ADD COLUMN `address` VARCHAR(500) NULL,
  ADD COLUMN `blood_group` VARCHAR(5) NULL,
  ADD COLUMN `emergency_contact_name` VARCHAR(255) NULL,
  ADD COLUMN `emergency_contact_phone` VARCHAR(30) NULL,
  ADD COLUMN `emergency_contact_relation` VARCHAR(100) NULL,
  ADD COLUMN `preferred_language` VARCHAR(5) NOT NULL DEFAULT 'ur';
