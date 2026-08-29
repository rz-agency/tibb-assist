-- Step 7: Drop unique constraint on patient_id to allow multiple contacts per patient
-- Must drop the FK first because MySQL requires the index for the FK constraint
ALTER TABLE `emergency_contacts` DROP FOREIGN KEY `emergency_contacts_patient_id_fkey`;
ALTER TABLE `emergency_contacts` DROP INDEX `emergency_contacts_patient_id_key`;
ALTER TABLE `emergency_contacts` ADD CONSTRAINT `emergency_contacts_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
