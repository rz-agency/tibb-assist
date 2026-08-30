-- CreateTable
CREATE TABLE `care_missions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assessment_id` INTEGER NOT NULL,
    `referral_id` INTEGER NULL,
    `risk_level` ENUM('GREEN', 'YELLOW', 'RED') NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `assigned_lhw_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `care_missions_assessment_id_key`(`assessment_id`),
    UNIQUE INDEX `care_missions_referral_id_key`(`referral_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `care_mission_timelines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `care_mission_id` INTEGER NOT NULL,
    `action` ENUM('CARE_MISSION_CREATED', 'REFERRAL_LINKED', 'FACILITY_SELECTED', 'FACILITY_CONTACTED', 'FACILITY_ACCEPTED', 'TRANSPORT_ARRANGED', 'EMERGENCY_CONTACT_NOTIFIED', 'PATIENT_DEPARTED', 'PATIENT_ARRIVED', 'FOLLOW_UP_SCHEDULED', 'MISSION_ESCALATED', 'MISSION_COMPLETED', 'MISSION_CANCELLED') NOT NULL,
    `fromStatus` ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'CANCELLED') NULL,
    `toStatus` ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'CANCELLED') NULL,
    `notes` TEXT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `care_mission_timelines_care_mission_id_created_at_idx`(`care_mission_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `care_mission_checklist_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `care_mission_id` INTEGER NOT NULL,
    `task_key` VARCHAR(100) NOT NULL,
    `task_label` VARCHAR(255) NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_by_user_id` INTEGER NULL,
    `completed_at` DATETIME(3) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `care_mission_checklist_items_care_mission_id_task_key_key`(`care_mission_id`, `task_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `care_missions` ADD CONSTRAINT `care_missions_assessment_id_fkey` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_missions` ADD CONSTRAINT `care_missions_referral_id_fkey` FOREIGN KEY (`referral_id`) REFERENCES `referrals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_missions` ADD CONSTRAINT `care_missions_assigned_lhw_id_fkey` FOREIGN KEY (`assigned_lhw_id`) REFERENCES `lhws`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_mission_timelines` ADD CONSTRAINT `care_mission_timelines_care_mission_id_fkey` FOREIGN KEY (`care_mission_id`) REFERENCES `care_missions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_mission_timelines` ADD CONSTRAINT `care_mission_timelines_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_mission_checklist_items` ADD CONSTRAINT `care_mission_checklist_items_care_mission_id_fkey` FOREIGN KEY (`care_mission_id`) REFERENCES `care_missions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_mission_checklist_items` ADD CONSTRAINT `care_mission_checklist_items_completed_by_user_id_fkey` FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
