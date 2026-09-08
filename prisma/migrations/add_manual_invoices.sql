-- Migration: Add manual_invoices table
-- Used for standalone manual invoices (device sales, installation services, custom projects)

CREATE TABLE IF NOT EXISTS `manual_invoices` (
  `id` VARCHAR(191) NOT NULL,
  `invoiceNumber` VARCHAR(191) NOT NULL,
  `recipientName` VARCHAR(191) NOT NULL,
  `recipientPhone` VARCHAR(191) NULL,
  `recipientAddress` TEXT NULL,
  `items` JSON NOT NULL,
  `subtotal` INT NOT NULL,
  `discountAmount` INT NOT NULL DEFAULT 0,
  `totalAmount` INT NOT NULL,
  `status` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `notes` TEXT NULL,
  `paidAt` DATETIME(3) NULL,
  `transactionId` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `manual_invoices_invoiceNumber_key` (`invoiceNumber`),
  INDEX `manual_invoices_status_idx` (`status`),
  INDEX `manual_invoices_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
