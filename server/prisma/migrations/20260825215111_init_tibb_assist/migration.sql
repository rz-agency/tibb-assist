-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('WOMAN', 'LHW', 'ADMIN') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patient_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `age` INTEGER NULL,
    `village_or_area` VARCHAR(255) NULL,
    `district` VARCHAR(255) NULL,
    `province` VARCHAR(255) NULL,
    `assigned_lhw_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `patient_profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pregnancies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `pregnancy_status` ENUM('ACTIVE', 'COMPLETED', 'UNKNOWN') NOT NULL DEFAULT 'ACTIVE',
    `lmp_date` DATE NULL,
    `due_date` DATE NULL,
    `gestational_week` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `symptoms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `symptoms_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `pregnancy_id` INTEGER NULL,
    `assessed_by_user_id` INTEGER NOT NULL,
    `assessment_date` DATETIME(3) NOT NULL,
    `input_method` ENUM('VISUAL', 'VOICE', 'OTHER') NOT NULL,
    `risk_level` ENUM('GREEN', 'YELLOW', 'RED') NOT NULL,
    `triage_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_symptoms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assessment_id` INTEGER NOT NULL,
    `symptom_id` INTEGER NOT NULL,
    `answer_status` ENUM('PRESENT', 'ABSENT', 'UNKNOWN') NOT NULL,
    `severity` ENUM('MILD', 'MODERATE', 'SEVERE') NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `assessment_symptoms_assessment_id_symptom_id_key`(`assessment_id`, `symptom_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lhws` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `region` ENUM('PUNJAB', 'SINDH', 'KPK', 'BALOCHISTAN', 'GILGIT_BALTISTAN', 'ISLAMABAD', 'OTHER') NULL DEFAULT 'OTHER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lhws_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `healthcare_facilities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `facility_type` ENUM('HOSPITAL', 'CLINIC', 'HEALTH_CENTER', 'OTHER') NOT NULL,
    `address` VARCHAR(255) NULL,
    `city` VARCHAR(255) NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `phone` VARCHAR(30) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `referrals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `assessment_id` INTEGER NOT NULL,
    `facility_id` INTEGER NOT NULL,
    `status` ENUM('RECOMMENDED', 'CONTACTED', 'COMPLETED', 'CANCELLED') NOT NULL,
    `referral_date` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emergency_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patient_id` INTEGER NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `relationship` VARCHAR(100) NULL,
    `phone` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `emergency_contacts_patient_id_key`(`patient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `patient_profiles` ADD CONSTRAINT `patient_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_profiles` ADD CONSTRAINT `patient_profiles_assigned_lhw_id_fkey` FOREIGN KEY (`assigned_lhw_id`) REFERENCES `lhws`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pregnancies` ADD CONSTRAINT `pregnancies_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_pregnancy_id_fkey` FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_assessed_by_user_id_fkey` FOREIGN KEY (`assessed_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_symptoms` ADD CONSTRAINT `assessment_symptoms_assessment_id_fkey` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_symptoms` ADD CONSTRAINT `assessment_symptoms_symptom_id_fkey` FOREIGN KEY (`symptom_id`) REFERENCES `symptoms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lhws` ADD CONSTRAINT `lhws_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_assessment_id_fkey` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_facility_id_fkey` FOREIGN KEY (`facility_id`) REFERENCES `healthcare_facilities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergency_contacts` ADD CONSTRAINT `emergency_contacts_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
