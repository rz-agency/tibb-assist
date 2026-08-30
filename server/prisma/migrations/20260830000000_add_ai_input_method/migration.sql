-- AlterTable: Add 'AI' to AssessmentInputMethod enum
ALTER TABLE `assessments` MODIFY COLUMN `input_method` ENUM('VISUAL', 'VOICE', 'AI', 'OTHER') NOT NULL;
