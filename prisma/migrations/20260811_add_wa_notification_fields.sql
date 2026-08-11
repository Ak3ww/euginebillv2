-- Migration: add_wa_notification_fields
-- Tambah kolom waNotificationEnabled dan waNotificationNote ke tabel pppoeUser
-- Digunakan untuk menonaktifkan pengiriman WA isolir/pengingat per user

ALTER TABLE `pppoeUser`
  ADD COLUMN IF NOT EXISTS `waNotificationEnabled` BOOLEAN NOT NULL DEFAULT true COMMENT 'Kirim WA isolir/pengingat ke user ini',
  ADD COLUMN IF NOT EXISTS `waNotificationNote` VARCHAR(500) NULL COMMENT 'Keterangan kenapa WA dinonaktifkan';
