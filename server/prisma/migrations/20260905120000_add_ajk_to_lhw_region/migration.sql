-- AlterTable
-- Add AJK as a valid LHW region value (Azad Jammu & Kashmir).
ALTER TABLE `lhws` MODIFY COLUMN `region` ENUM(
  'PUNJAB',
  'SINDH',
  'KPK',
  'BALOCHISTAN',
  'GILGIT_BALTISTAN',
  'ISLAMABAD',
  'AJK',
  'OTHER'
) NULL DEFAULT 'OTHER';
