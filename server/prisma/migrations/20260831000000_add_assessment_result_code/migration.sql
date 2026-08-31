-- AlterTable: add result_code column to assessments
ALTER TABLE `assessments` ADD COLUMN `result_code` VARCHAR(60) NULL;
