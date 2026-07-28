-- Migration: acs_enhancement_v2
-- Jalankan di VPS: mysql -u root -p EugineBill_radius < migration_acs_v2.sql

-- ─── Alter acsDevice table ───────────────────────────────────────────────────
-- Rename table jika belum (Prisma @map)
-- CATATAN: Prisma @map("acs_devices") berarti nama tabel di DB akan menjadi acs_devices
-- Jika tabel sebelumnya bernama acsDevice, rename dulu:
RENAME TABLE IF EXISTS `acsDevice` TO `acs_devices`;
RENAME TABLE IF EXISTS `acsTask`   TO `acs_tasks`;

-- Tambah kolom baru ke acs_devices
ALTER TABLE `acs_devices`
  ADD COLUMN IF NOT EXISTS `wanIpAddress`          VARCHAR(191)   NULL AFTER `ipAddress`,
  ADD COLUMN IF NOT EXISTS `ssid`                  VARCHAR(191)   NULL AFTER `wanIpAddress`,
  ADD COLUMN IF NOT EXISTS `ssid5g`                VARCHAR(191)   NULL AFTER `ssid`,
  ADD COLUMN IF NOT EXISTS `wifiPassword`          VARCHAR(191)   NULL AFTER `ssid5g`,
  ADD COLUMN IF NOT EXISTS `wifiPassword5g`        VARCHAR(191)   NULL AFTER `wifiPassword`,
  ADD COLUMN IF NOT EXISTS `rxPower`               DOUBLE         NULL AFTER `wifiPassword5g`,
  ADD COLUMN IF NOT EXISTS `txPower`               DOUBLE         NULL AFTER `rxPower`,
  ADD COLUMN IF NOT EXISTS `deviceUptime`          INT            NULL AFTER `txPower`,
  ADD COLUMN IF NOT EXISTS `connectedDevicesCount` INT            NULL AFTER `deviceUptime`,
  ADD COLUMN IF NOT EXISTS `connectedDevices`      JSON           NULL AFTER `connectedDevicesCount`,
  ADD COLUMN IF NOT EXISTS `periodicInformInterval` INT           NULL AFTER `connectedDevices`,
  ADD COLUMN IF NOT EXISTS `informCount`           INT            NOT NULL DEFAULT 0 AFTER `periodicInformInterval`,
  ADD COLUMN IF NOT EXISTS `firstSeenAt`           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `informCount`;

-- Tambah indexes ke acs_devices
ALTER TABLE `acs_devices`
  ADD INDEX IF NOT EXISTS `acs_devices_status_lastInform_idx` (`status`, `lastInform`),
  ADD INDEX IF NOT EXISTS `acs_devices_ssid_idx` (`ssid`),
  ADD INDEX IF NOT EXISTS `acs_devices_rxPower_idx` (`rxPower`),
  ADD INDEX IF NOT EXISTS `acs_devices_wanIpAddress_idx` (`wanIpAddress`),
  ADD INDEX IF NOT EXISTS `acs_devices_pppoeUserId_idx` (`pppoeUserId`);

-- Tambah indexes ke acs_tasks
ALTER TABLE `acs_tasks`
  ADD INDEX IF NOT EXISTS `acs_tasks_deviceId_status_idx` (`deviceId`, `status`),
  ADD INDEX IF NOT EXISTS `acs_tasks_createdAt_idx` (`createdAt`);

-- ─── Create acsSession table ──────────────────────────────────────────────────
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

-- ─── Create acsCandidate table ────────────────────────────────────────────────
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
