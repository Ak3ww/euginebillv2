-- Migration: acs_enhancement_v2 (Compatible with MySQL 5.7, 8.0, and MariaDB)

-- 1. Rename tables if they exist under old unmapped names
SET @exist_acsDevice := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'acsDevice');
SET @sql_rename_acsDevice := IF(@exist_acsDevice > 0, 'RENAME TABLE `acsDevice` TO `acs_devices`', 'SELECT 1');
PREPARE stmt1 FROM @sql_rename_acsDevice; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @exist_acsTask := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'acsTask');
SET @sql_rename_acsTask := IF(@exist_acsTask > 0, 'RENAME TABLE `acsTask` TO `acs_tasks`', 'SELECT 1');
PREPARE stmt2 FROM @sql_rename_acsTask; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 2. Create acs_devices table if it does not exist at all
CREATE TABLE IF NOT EXISTS `acs_devices` (
  `id`                   VARCHAR(191) NOT NULL,
  `serialNumber`         VARCHAR(191) NOT NULL,
  `manufacturer`         VARCHAR(191) NULL,
  `oui`                  VARCHAR(191) NULL,
  `productClass`         VARCHAR(191) NULL,
  `hardwareVersion`      VARCHAR(191) NULL,
  `softwareVersion`      VARCHAR(191) NULL,
  `connectionRequestUrl` VARCHAR(191) NULL,
  `ipAddress`            VARCHAR(191) NULL,
  `wanIpAddress`         VARCHAR(191) NULL,
  `status`               VARCHAR(191) NOT NULL DEFAULT 'online',
  `lastInform`           DATETIME(3)  NULL,
  `parameters`           JSON         NULL,
  `ssid`                 VARCHAR(191) NULL,
  `ssid5g`               VARCHAR(191) NULL,
  `wifiPassword`         VARCHAR(191) NULL,
  `wifiPassword5g`       VARCHAR(191) NULL,
  `rxPower`              DOUBLE       NULL,
  `txPower`              DOUBLE       NULL,
  `deviceUptime`         INT          NULL,
  `connectedDevicesCount` INT         NULL,
  `connectedDevices`     JSON         NULL,
  `periodicInformInterval` INT        NULL,
  `informCount`          INT          NOT NULL DEFAULT 0,
  `firstSeenAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`            DATETIME(3)  NOT NULL,
  `companyId`            VARCHAR(191) NOT NULL,
  `pppoeUserId`          VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `acs_devices_serialNumber_key` (`serialNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Helper procedure to safely add columns if missing
DROP PROCEDURE IF EXISTS AddAcsColumn;
DELIMITER //
CREATE PROCEDURE AddAcsColumn(IN tbl VARCHAR(64), IN col VARCHAR(64), IN coldef TEXT)
BEGIN
  IF NOT EXISTS (SELECT * FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = tbl AND column_name = col) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', coldef);
    PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE;
  END IF;
END //
DELIMITER ;

CALL AddAcsColumn('acs_devices', 'wanIpAddress', 'VARCHAR(191) NULL');
CALL AddAcsColumn('acs_devices', 'ssid', 'VARCHAR(191) NULL');
CALL AddAcsColumn('acs_devices', 'ssid5g', 'VARCHAR(191) NULL');
CALL AddAcsColumn('acs_devices', 'wifiPassword', 'VARCHAR(191) NULL');
CALL AddAcsColumn('acs_devices', 'wifiPassword5g', 'VARCHAR(191) NULL');
CALL AddAcsColumn('acs_devices', 'rxPower', 'DOUBLE NULL');
CALL AddAcsColumn('acs_devices', 'txPower', 'DOUBLE NULL');
CALL AddAcsColumn('acs_devices', 'deviceUptime', 'INT NULL');
CALL AddAcsColumn('acs_devices', 'connectedDevicesCount', 'INT NULL');
CALL AddAcsColumn('acs_devices', 'connectedDevices', 'JSON NULL');
CALL AddAcsColumn('acs_devices', 'periodicInformInterval', 'INT NULL');
CALL AddAcsColumn('acs_devices', 'informCount', 'INT NOT NULL DEFAULT 0');
CALL AddAcsColumn('acs_devices', 'firstSeenAt', 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)');

DROP PROCEDURE IF EXISTS AddAcsColumn;

-- 3. Create acs_tasks table if not exists
CREATE TABLE IF NOT EXISTS `acs_tasks` (
  `id`        VARCHAR(191) NOT NULL,
  `deviceId`  VARCHAR(191) NOT NULL,
  `name`      VARCHAR(191) NOT NULL,
  `command`   VARCHAR(191) NOT NULL,
  `status`    VARCHAR(191) NOT NULL DEFAULT 'pending',
  `payload`   JSON         NULL,
  `result`    JSON         NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Create acs_sessions table if not exists
CREATE TABLE IF NOT EXISTS `acs_sessions` (
  `id`            VARCHAR(191) NOT NULL,
  `serialNumber`  VARCHAR(191) NULL,
  `deviceDbId`    VARCHAR(191) NULL,
  `currentTaskId` VARCHAR(191) NULL,
  `expiresAt`     DATETIME(3)  NOT NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create acs_candidates table if not exists
CREATE TABLE IF NOT EXISTS `acs_candidates` (
  `id`          VARCHAR(191) NOT NULL,
  `macAddress`  VARCHAR(191) NOT NULL,
  `ipAddress`   VARCHAR(191) NULL,
  `hostname`    VARCHAR(191) NULL,
  `routerId`    VARCHAR(191) NULL,
  `firstSeenAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `acs_candidates_macAddress_key` (`macAddress`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
