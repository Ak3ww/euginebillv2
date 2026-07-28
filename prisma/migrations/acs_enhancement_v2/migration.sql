-- Migration: acs_enhancement_v2 (Standard SQL - No DELIMITER/PROCEDURE)

-- 1. Rename existing tables to match Prisma @map names
ALTER TABLE `acsDevice` RENAME TO `acs_devices`;
ALTER TABLE `acsTask` RENAME TO `acs_tasks`;

-- 2. Add new columns to acs_devices
ALTER TABLE `acs_devices` ADD COLUMN `wanIpAddress` VARCHAR(191) NULL;
ALTER TABLE `acs_devices` ADD COLUMN `ssid` VARCHAR(191) NULL;
ALTER TABLE `acs_devices` ADD COLUMN `ssid5g` VARCHAR(191) NULL;
ALTER TABLE `acs_devices` ADD COLUMN `wifiPassword` VARCHAR(191) NULL;
ALTER TABLE `acs_devices` ADD COLUMN `wifiPassword5g` VARCHAR(191) NULL;
ALTER TABLE `acs_devices` ADD COLUMN `rxPower` DOUBLE NULL;
ALTER TABLE `acs_devices` ADD COLUMN `txPower` DOUBLE NULL;
ALTER TABLE `acs_devices` ADD COLUMN `deviceUptime` INT NULL;
ALTER TABLE `acs_devices` ADD COLUMN `connectedDevicesCount` INT NULL;
ALTER TABLE `acs_devices` ADD COLUMN `connectedDevices` JSON NULL;
ALTER TABLE `acs_devices` ADD COLUMN `periodicInformInterval` INT NULL;
ALTER TABLE `acs_devices` ADD COLUMN `informCount` INT NOT NULL DEFAULT 0;
ALTER TABLE `acs_devices` ADD COLUMN `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- 3. Add indexes to acs_devices
ALTER TABLE `acs_devices` ADD INDEX `acs_devices_status_lastInform_idx` (`status`, `lastInform`);
ALTER TABLE `acs_devices` ADD INDEX `acs_devices_ssid_idx` (`ssid`);
ALTER TABLE `acs_devices` ADD INDEX `acs_devices_rxPower_idx` (`rxPower`);
ALTER TABLE `acs_devices` ADD INDEX `acs_devices_wanIpAddress_idx` (`wanIpAddress`);
ALTER TABLE `acs_devices` ADD INDEX `acs_devices_pppoeUserId_idx` (`pppoeUserId`);

-- 4. Create acs_sessions table
CREATE TABLE IF NOT EXISTS `acs_sessions` (
  `id`            VARCHAR(191) NOT NULL,
  `serialNumber`  VARCHAR(191) NULL,
  `deviceDbId`    VARCHAR(191) NULL,
  `currentTaskId` VARCHAR(191) NULL,
  `expiresAt`     DATETIME(3)  NOT NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `acs_sessions_expiresAt_idx` (`expiresAt`),
  INDEX `acs_sessions_serialNumber_idx` (`serialNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create acs_candidates table
CREATE TABLE IF NOT EXISTS `acs_candidates` (
  `id`          VARCHAR(191) NOT NULL,
  `macAddress`  VARCHAR(191) NOT NULL,
  `ipAddress`   VARCHAR(191) NULL,
  `hostname`    VARCHAR(191) NULL,
  `routerId`    VARCHAR(191) NULL,
  `firstSeenAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `acs_candidates_macAddress_key` (`macAddress`),
  INDEX `acs_candidates_ipAddress_idx` (`ipAddress`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
