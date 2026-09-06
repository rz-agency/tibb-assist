-- CreateTable
CREATE TABLE `home_visits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `lhw_id` INTEGER NOT NULL,
    `visit_date` DATE NOT NULL,
    `visit_type` ENUM('ROUTINE', 'FOLLOW_UP', 'POSTNATAL', 'EMERGENCY_FOLLOW_UP') NOT NULL,
    `topics_discussed` JSON NULL,
    `blood_pressure_checked` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `next_visit_date` DATE NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `home_visits_patient_id_visit_date_idx`(`patient_id`, `visit_date`),
    INDEX `home_visits_lhw_id_visit_date_idx`(`lhw_id`, `visit_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `home_visits` ADD CONSTRAINT `home_visits_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_visits` ADD CONSTRAINT `home_visits_lhw_id_fkey` FOREIGN KEY (`lhw_id`) REFERENCES `lhws`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_visits` ADD CONSTRAINT `home_visits_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
