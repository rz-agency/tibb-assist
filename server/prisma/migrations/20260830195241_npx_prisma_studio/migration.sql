/*
  Warnings:

  - You are about to drop the column `full_name` on the `emergency_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `emergency_contacts` table. All the data in the column will be lost.
  - Added the required column `name` to the `emergency_contacts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone_number` to the `emergency_contacts` table without a default value. This is not possible if the table is not empty.
  - Made the column `relationship` on table `emergency_contacts` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `emergency_contacts` DROP COLUMN `full_name`,
    DROP COLUMN `phone`,
    ADD COLUMN `is_primary` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `name` VARCHAR(255) NOT NULL,
    ADD COLUMN `phone_number` VARCHAR(30) NOT NULL,
    MODIFY `relationship` VARCHAR(100) NOT NULL;
