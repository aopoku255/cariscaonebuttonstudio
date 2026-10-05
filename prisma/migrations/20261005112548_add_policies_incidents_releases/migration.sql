-- AlterTable
ALTER TABLE `AddOn` ADD COLUMN `studioProduced` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Package` ADD COLUMN `requiresParticipantRelease` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `requiresRecordingConsent` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Policy` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `requiredAtCheckout` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Policy_slug_key`(`slug`),
    INDEX `Policy_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PolicyVersion` (
    `id` VARCHAR(191) NOT NULL,
    `policyId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `effectiveDate` DATE NULL,
    `lastUpdatedDate` DATE NULL,
    `changeReason` TEXT NULL,
    `previousVersionId` VARCHAR(191) NULL,
    `createdByAdminId` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `approvedByAdminId` VARCHAR(191) NULL,
    `approvedByName` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `publishedByAdminId` VARCHAR(191) NULL,
    `publishedByName` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PolicyVersion_policyId_status_idx`(`policyId`, `status`),
    UNIQUE INDEX `PolicyVersion_policyId_version_key`(`policyId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingPolicyAcceptance` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `termsVersionId` VARCHAR(191) NULL,
    `termsVersion` VARCHAR(191) NULL,
    `privacyVersionId` VARCHAR(191) NULL,
    `privacyVersion` VARCHAR(191) NULL,
    `studioPolicyVersionId` VARCHAR(191) NULL,
    `studioPolicyVersion` VARCHAR(191) NULL,
    `recordingConsent` BOOLEAN NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `termsSnapshot` JSON NULL,

    UNIQUE INDEX `BookingPolicyAcceptance_bookingId_key`(`bookingId`),
    INDEX `BookingPolicyAcceptance_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentIncident` (
    `id` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NULL,
    `bookingId` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NULL,
    `category` ENUM('WEAR_AND_TEAR', 'ACCIDENTAL', 'NEGLIGENT', 'INTENTIONAL') NOT NULL,
    `status` ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `description` TEXT NOT NULL,
    `occurredOn` DATE NOT NULL,
    `costMinor` INTEGER NULL,
    `resolutionNotes` TEXT NULL,
    `reportedByAdminId` VARCHAR(191) NULL,
    `reportedByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EquipmentIncident_status_idx`(`status`),
    INDEX `EquipmentIncident_equipmentId_idx`(`equipmentId`),
    INDEX `EquipmentIncident_bookingId_idx`(`bookingId`),
    INDEX `EquipmentIncident_occurredOn_idx`(`occurredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentRelease` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `participantName` VARCHAR(191) NOT NULL,
    `participantContact` VARCHAR(191) NULL,
    `isMinor` BOOLEAN NOT NULL DEFAULT false,
    `guardianName` VARCHAR(191) NULL,
    `scopeOfUse` TEXT NULL,
    `status` ENUM('PENDING', 'SIGNED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `signedOn` DATE NULL,
    `notes` TEXT NULL,
    `recordedByAdminId` VARCHAR(191) NULL,
    `recordedByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentRelease_bookingId_idx`(`bookingId`),
    INDEX `ContentRelease_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PolicyVersion` ADD CONSTRAINT `PolicyVersion_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `Policy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingPolicyAcceptance` ADD CONSTRAINT `BookingPolicyAcceptance_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentIncident` ADD CONSTRAINT `EquipmentIncident_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentIncident` ADD CONSTRAINT `EquipmentIncident_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentRelease` ADD CONSTRAINT `ContentRelease_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
