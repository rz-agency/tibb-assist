-- Referral Lifecycle Migration
-- ============================
-- NON-DESTRUCTIVE: This migration preserves all existing referral records.
--
-- Step 1: Remap old enum values in existing rows BEFORE altering the enum type.
--   CONTACTED → FACILITY_CONTACTED  (semantically identical)
--   COMPLETED → CLOSED              (terminal "done" state)
-- Step 2: Alter the ReferralStatus column to use the new expanded enum.
-- Step 3: Add new CareMissionAction enum values (additive only).
-- Step 4: Create the referral_status_history audit table.

-- ── Step 1: Remap existing rows ────────────────────────────────────────────

UPDATE `referrals` SET `status` = 'FACILITY_CONTACTED' WHERE `status` = 'CONTACTED';
UPDATE `referrals` SET `status` = 'CLOSED' WHERE `status` = 'COMPLETED';

-- ── Step 2: Expand the ReferralStatus enum ────────────────────────────────
-- Old values removed: CONTACTED, COMPLETED (already remapped above).
-- New values added:   FACILITY_SELECTED, TRANSPORT_ARRANGED, PATIENT_DEPARTED,
--                     PATIENT_ARRIVED, FOLLOW_UP_DUE, CLOSED.
-- Retained values:    RECOMMENDED, FACILITY_CONTACTED, CANCELLED.

ALTER TABLE `referrals` MODIFY COLUMN `status` ENUM(
  'RECOMMENDED',
  'FACILITY_SELECTED',
  'FACILITY_CONTACTED',
  'TRANSPORT_ARRANGED',
  'PATIENT_DEPARTED',
  'PATIENT_ARRIVED',
  'FOLLOW_UP_DUE',
  'CLOSED',
  'CANCELLED'
) NOT NULL;

-- ── Step 3: Add new CareMissionAction enum values ────────────────────────
-- Additive only — no existing values are removed or renamed.
-- New values: REFERRAL_FOLLOW_UP_DUE, REFERRAL_CLOSED, REFERRAL_CANCELLED.

ALTER TABLE `care_mission_timelines` MODIFY COLUMN `action` ENUM(
  'CARE_MISSION_CREATED',
  'REFERRAL_LINKED',
  'FACILITY_SELECTED',
  'FACILITY_CONTACTED',
  'FACILITY_ACCEPTED',
  'TRANSPORT_ARRANGED',
  'EMERGENCY_CONTACT_NOTIFIED',
  'PATIENT_DEPARTED',
  'PATIENT_ARRIVED',
  'FOLLOW_UP_SCHEDULED',
  'CHECKLIST_ITEM_COMPLETED',
  'CHECKLIST_ITEM_REOPENED',
  'MISSION_ESCALATED',
  'MISSION_COMPLETED',
  'MISSION_CANCELLED',
  'REFERRAL_FOLLOW_UP_DUE',
  'REFERRAL_CLOSED',
  'REFERRAL_CANCELLED'
) NOT NULL;

-- ── Step 4: Create referral_status_history table ─────────────────────────

CREATE TABLE `referral_status_history` (
  `id`                INT           NOT NULL AUTO_INCREMENT,
  `referral_id`       INT           NOT NULL,
  `from_status`       ENUM(
                        'RECOMMENDED','FACILITY_SELECTED','FACILITY_CONTACTED',
                        'TRANSPORT_ARRANGED','PATIENT_DEPARTED','PATIENT_ARRIVED',
                        'FOLLOW_UP_DUE','CLOSED','CANCELLED'
                      )             NULL,
  `to_status`         ENUM(
                        'RECOMMENDED','FACILITY_SELECTED','FACILITY_CONTACTED',
                        'TRANSPORT_ARRANGED','PATIENT_DEPARTED','PATIENT_ARRIVED',
                        'FOLLOW_UP_DUE','CLOSED','CANCELLED'
                      )             NOT NULL,
  `note`              TEXT          NULL,
  `created_by_user_id` INT          NOT NULL,
  `created_at`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `referral_status_history_referral_id_created_at_idx` (`referral_id`, `created_at`),
  CONSTRAINT `referral_status_history_referral_id_fkey`
    FOREIGN KEY (`referral_id`) REFERENCES `referrals`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `referral_status_history_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
