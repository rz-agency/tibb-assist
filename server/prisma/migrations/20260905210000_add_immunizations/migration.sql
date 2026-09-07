-- CreateTable: immunizations
CREATE TABLE `immunizations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `pregnancy_id` INTEGER NULL,
    `vaccine_name` VARCHAR(100) NOT NULL,
    `dose_number` INTEGER NOT NULL,
    `date_administered` DATE NOT NULL,
    `administered_by_user_id` INTEGER NOT NULL,
    `next_dose_date` DATE NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `immunizations_patient_id_vaccine_name_idx` (`patient_id`, `vaccine_name`),
    INDEX `immunizations_pregnancy_id_idx` (`pregnancy_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `immunizations` ADD CONSTRAINT `immunizations_patient_id_fkey`
    FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `immunizations` ADD CONSTRAINT `immunizations_pregnancy_id_fkey`
    FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `immunizations` ADD CONSTRAINT `immunizations_administered_by_user_id_fkey`
    FOREIGN KEY (`administered_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
