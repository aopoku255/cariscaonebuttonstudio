-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'STUDIO_MANAGER', 'FINANCE', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`),
    INDEX `AdminUser_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminSession` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminSession_tokenHash_key`(`tokenHash`),
    INDEX `AdminSession_adminUserId_idx`(`adminUserId`),
    INDEX `AdminSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `organisation` VARCHAR(191) NULL,
    `userType` ENUM('STUDENT', 'RESEARCHER', 'CREATOR', 'STARTUP', 'BUSINESS', 'NGO', 'CORPORATE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `passwordHash` VARCHAR(191) NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_email_key`(`email`),
    INDEX `Customer_userType_idx`(`userType`),
    INDEX `Customer_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerSession` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CustomerSession_tokenHash_key`(`tokenHash`),
    INDEX `CustomerSession_customerId_idx`(`customerId`),
    INDEX `CustomerSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Package` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('STUDIO_RENTAL', 'MEMBERSHIP', 'PRODUCTION', 'CORPORATE', 'OTHER') NOT NULL DEFAULT 'STUDIO_RENTAL',
    `summary` TEXT NULL,
    `description` TEXT NULL,
    `priceMinor` INTEGER NOT NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 60,
    `imageUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isPopular` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `includedHours` INTEGER NULL,
    `extraHourDiscountPercent` INTEGER NULL,
    `validityDays` INTEGER NULL,
    `priorityBooking` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Package_slug_key`(`slug`),
    INDEX `Package_category_isActive_idx`(`category`, `isActive`),
    INDEX `Package_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackageFeature` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `PackageFeature_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AddOn` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priceMinor` INTEGER NOT NULL DEFAULT 0,
    `pricingUnit` ENUM('PER_HOUR', 'PER_BOOKING', 'FIXED', 'CUSTOM') NOT NULL DEFAULT 'PER_BOOKING',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `maxQuantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AddOn_slug_key`(`slug`),
    INDEX `AddOn_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `includedInPackages` BOOLEAN NOT NULL DEFAULT false,
    `rentalPriceMinor` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Equipment_slug_key`(`slug`),
    INDEX `Equipment_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Faq` (
    `id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `category` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Faq_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscountRule` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `percentOff` INTEGER NOT NULL,
    `eligibleUserTypes` VARCHAR(191) NOT NULL,
    `requiresVerification` BOOLEAN NOT NULL DEFAULT false,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `appliesToAllPackages` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiscountRule_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscountRulePackage` (
    `discountRuleId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,

    INDEX `DiscountRulePackage_packageId_idx`(`packageId`),
    PRIMARY KEY (`discountRuleId`, `packageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NULL,
    `status` ENUM('PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `source` ENUM('PUBLIC', 'ADMIN') NOT NULL DEFAULT 'PUBLIC',
    `bookingDate` DATE NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `subtotalMinor` INTEGER NOT NULL,
    `discountMinor` INTEGER NOT NULL DEFAULT 0,
    `taxMinor` INTEGER NOT NULL DEFAULT 0,
    `totalMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GHS',
    `discountLabel` VARCHAR(191) NULL,
    `membershipId` VARCHAR(191) NULL,
    `membershipMinutesUsed` INTEGER NOT NULL DEFAULT 0,
    `packageNameSnapshot` VARCHAR(191) NULL,
    `purpose` TEXT NULL,
    `specialRequirements` TEXT NULL,
    `internalNotes` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `createdByAdminId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Booking_reference_key`(`reference`),
    INDEX `Booking_bookingDate_status_idx`(`bookingDate`, `status`),
    INDEX `Booking_customerId_idx`(`customerId`),
    INDEX `Booking_packageId_idx`(`packageId`),
    INDEX `Booking_status_idx`(`status`),
    INDEX `Booking_paymentStatus_idx`(`paymentStatus`),
    INDEX `Booking_startsAt_idx`(`startsAt`),
    INDEX `Booking_expiresAt_idx`(`expiresAt`),
    INDEX `Booking_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingAddOn` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `addOnId` VARCHAR(191) NULL,
    `nameSnapshot` VARCHAR(191) NOT NULL,
    `pricingUnitSnapshot` ENUM('PER_HOUR', 'PER_BOOKING', 'FIXED', 'CUSTOM') NOT NULL,
    `unitPriceMinor` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `lineTotalMinor` INTEGER NOT NULL,

    INDEX `BookingAddOn_bookingId_idx`(`bookingId`),
    INDEX `BookingAddOn_addOnId_idx`(`addOnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingSlot` (
    `id` VARCHAR(191) NOT NULL,
    `bookingDate` DATE NOT NULL,
    `slotMinute` INTEGER NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,

    INDEX `BookingSlot_bookingId_idx`(`bookingId`),
    UNIQUE INDEX `BookingSlot_bookingDate_slotMinute_key`(`bookingDate`, `slotMinute`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `provider` ENUM('PAYSTACK', 'MANUAL', 'COMPLIMENTARY', 'MEMBERSHIP') NOT NULL DEFAULT 'PAYSTACK',
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GHS',
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `providerReference` VARCHAR(191) NULL,
    `authorizationUrl` TEXT NULL,
    `accessCode` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `rawResponse` JSON NULL,
    `membershipId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_reference_key`(`reference`),
    UNIQUE INDEX `Payment_providerReference_key`(`providerReference`),
    INDEX `Payment_bookingId_idx`(`bookingId`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NULL,
    `status` ENUM('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `totalMinutes` INTEGER NOT NULL,
    `usedMinutes` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    `priorityBooking` BOOLEAN NOT NULL DEFAULT false,
    `extraHourDiscountPercent` INTEGER NOT NULL DEFAULT 0,
    `pricePaidMinor` INTEGER NOT NULL DEFAULT 0,
    `packageNameSnapshot` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Membership_reference_key`(`reference`),
    INDEX `Membership_customerId_idx`(`customerId`),
    INDEX `Membership_status_idx`(`status`),
    INDEX `Membership_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipUsage` (
    `id` VARCHAR(191) NOT NULL,
    `membershipId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `minutesUsed` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MembershipUsage_membershipId_idx`(`membershipId`),
    INDEX `MembershipUsage_bookingId_idx`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperatingHour` (
    `id` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `isOpen` BOOLEAN NOT NULL DEFAULT true,
    `openMinute` INTEGER NOT NULL DEFAULT 480,
    `closeMinute` INTEGER NOT NULL DEFAULT 1080,

    UNIQUE INDEX `OperatingHour_dayOfWeek_key`(`dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockedDate` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `type` ENUM('HOLIDAY', 'MAINTENANCE', 'INTERNAL_EVENT', 'PRIVATE_EVENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BlockedDate_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockedTime` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `type` ENUM('HOLIDAY', 'MAINTENANCE', 'INTERNAL_EVENT', 'PRIVATE_EVENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlockedTime_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateInquiry` (
    `id` VARCHAR(191) NOT NULL,
    `organisation` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `sessionsRequired` INTEGER NULL,
    `estimatedHours` INTEGER NULL,
    `contentType` VARCHAR(191) NULL,
    `preferredStartDate` DATE NULL,
    `requirements` TEXT NULL,
    `status` ENUM('NEW', 'IN_REVIEW', 'CONTACTED', 'CONVERTED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CorporateInquiry_status_idx`(`status`),
    INDEX `CorporateInquiry_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOKING_CREATED', 'PAYMENT_SUCCESSFUL', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'BOOKING_COMPLETED', 'CORPORATE_INQUIRY', 'MEMBERSHIP_ACTIVATED') NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'EMAIL',
    `recipient` VARCHAR(191) NOT NULL,
    `subject` TEXT NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `bookingId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_status_idx`(`status`),
    INDEX `Notification_bookingId_idx`(`bookingId`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudioSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `summary` TEXT NOT NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_adminUserId_idx`(`adminUserId`),
    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminSession` ADD CONSTRAINT `AdminSession_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSession` ADD CONSTRAINT `CustomerSession_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageFeature` ADD CONSTRAINT `PackageFeature_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountRulePackage` ADD CONSTRAINT `DiscountRulePackage_discountRuleId_fkey` FOREIGN KEY (`discountRuleId`) REFERENCES `DiscountRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountRulePackage` ADD CONSTRAINT `DiscountRulePackage_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_createdByAdminId_fkey` FOREIGN KEY (`createdByAdminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingAddOn` ADD CONSTRAINT `BookingAddOn_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingAddOn` ADD CONSTRAINT `BookingAddOn_addOnId_fkey` FOREIGN KEY (`addOnId`) REFERENCES `AddOn`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingSlot` ADD CONSTRAINT `BookingSlot_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipUsage` ADD CONSTRAINT `MembershipUsage_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipUsage` ADD CONSTRAINT `MembershipUsage_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
