-- CreateTable: follow_ups
CREATE TABLE `follow_ups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `lhw_id` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `type` ENUM('HOME_VISIT', 'ANC_VISIT', 'REFERRAL_CHECK', 'CHECK_IN_REMINDER') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `related_referral_id` INTEGER NULL,
    `related_care_mission_id` INTEGER NULL,
    `completed_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `follow_ups_related_referral_id_key` (`related_referral_id`),
    UNIQUE INDEX `follow_ups_related_care_mission_id_key` (`related_care_mission_id`),
    INDEX `follow_ups_patient_id_due_date_idx` (`patient_id`, `due_date`),
    INDEX `follow_ups_lhw_id_status_due_date_idx` (`lhw_id`, `status`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_patient_id_fkey`
    FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_lhw_id_fkey`
    FOREIGN KEY (`lhw_id`) REFERENCES `lhws`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_related_referral_id_fkey`
    FOREIGN KEY (`related_referral_id`) REFERENCES `referrals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_related_care_mission_id_fkey`
    FOREIGN KEY (`related_care_mission_id`) REFERENCES `care_missions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
