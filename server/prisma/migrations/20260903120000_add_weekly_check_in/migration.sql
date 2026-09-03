-- CreateTable
-- Weekly pregnancy check-ins: structured answers (JSON), optional free-text note,
-- and an optional link to the assessment created when an answer was routed into
-- the existing symptom-assessment pipeline.
CREATE TABLE `weekly_check_ins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_profile_id` INTEGER NOT NULL,
    `gestational_week_at_check_in` INTEGER NOT NULL,
    `answers` JSON NOT NULL,
    `free_text_note` TEXT NULL,
    `routed_to_assessment_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `weekly_check_ins_routed_to_assessment_id_key`(`routed_to_assessment_id`),
    INDEX `weekly_check_ins_patient_profile_id_gestational_week_at__idx`(`patient_profile_id`, `gestational_week_at_check_in`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `weekly_check_ins` ADD CONSTRAINT `weekly_check_ins_patient_profile_id_fkey` FOREIGN KEY (`patient_profile_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_check_ins` ADD CONSTRAINT `weekly_check_ins_routed_to_assessment_id_fkey` FOREIGN KEY (`routed_to_assessment_id`) REFERENCES `assessments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
