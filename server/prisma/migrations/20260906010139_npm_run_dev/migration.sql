-- DropForeignKey
ALTER TABLE `follow_ups` DROP FOREIGN KEY `follow_ups_related_care_mission_id_fkey`;

-- DropForeignKey
ALTER TABLE `follow_ups` DROP FOREIGN KEY `follow_ups_related_referral_id_fkey`;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_related_referral_id_fkey` FOREIGN KEY (`related_referral_id`) REFERENCES `referrals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_related_care_mission_id_fkey` FOREIGN KEY (`related_care_mission_id`) REFERENCES `care_missions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `push_notification_log_user_id_notification_type_dedupe_key_key` ON `push_notification_log`(`user_id`, `notification_type`, `dedupe_key`);
DROP INDEX `push_notification_log_user_id_notification_type_dedue_key` ON `push_notification_log`;

-- RedefineIndex
CREATE INDEX `weekly_check_ins_patient_profile_id_gestational_week_at_chec_idx` ON `weekly_check_ins`(`patient_profile_id`, `gestational_week_at_check_in`);
DROP INDEX `weekly_check_ins_patient_profile_id_gestational_week_at__idx` ON `weekly_check_ins`;
