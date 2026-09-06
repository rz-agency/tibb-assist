-- CreateTable
CREATE TABLE `anc_visits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pregnancy_id` INTEGER NOT NULL,
    `logged_by_user_id` INTEGER NOT NULL,
    `visit_number` INTEGER NOT NULL,
    `visit_date` DATE NOT NULL,
    `gestational_week_at_visit` INTEGER NULL,
    `blood_pressure` VARCHAR(20) NULL,
    `weight_kg` DECIMAL(5, 2) NULL,
    `danger_signs_checked` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `next_visit_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `anc_visits_pregnancy_id_visit_number_idx`(`pregnancy_id`, `visit_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `anc_visits` ADD CONSTRAINT `anc_visits_pregnancy_id_fkey` FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anc_visits` ADD CONSTRAINT `anc_visits_logged_by_user_id_fkey` FOREIGN KEY (`logged_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
