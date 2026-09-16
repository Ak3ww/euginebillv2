-- ============================================================================
-- Migration: Unify Inventory Stock Field, Add Pack Size, Period Label & Kit Standar SPK
-- Date: 2026-09-16
-- ============================================================================

-- 1. Migrate stockQuantity data to currentStock before dropping column
UPDATE `inventory_items` 
SET `currentStock` = `stockQuantity` 
WHERE `stockQuantity` IS NOT NULL AND `stockQuantity` > `currentStock`;

-- 2. Modify inventory_items table
ALTER TABLE `inventory_items` 
  DROP COLUMN `stockQuantity`,
  MODIFY `currentStock` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `packSize` INT NULL;

-- 3. Modify inventory_movements table
ALTER TABLE `inventory_movements` 
  MODIFY `quantity` DOUBLE NOT NULL,
  MODIFY `previousStock` DOUBLE NOT NULL,
  MODIFY `newStock` DOUBLE NOT NULL,
  ADD COLUMN `periodLabel` VARCHAR(50) NULL;

CREATE INDEX `inventory_movements_periodLabel_idx` ON `inventory_movements`(`periodLabel`);

-- 4. Create work_order_type_kits table
CREATE TABLE IF NOT EXISTS `work_order_type_kits` (
  `id` VARCHAR(191) NOT NULL,
  `issueType` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_order_type_kits_issueType_key` (`issueType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create work_order_type_kit_items table
CREATE TABLE IF NOT EXISTS `work_order_type_kit_items` (
  `id` VARCHAR(191) NOT NULL,
  `kitId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `defaultQty` DOUBLE NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_order_type_kit_items_kitId_itemId_key` (`kitId`, `itemId`),
  CONSTRAINT `work_order_type_kit_items_kitId_fkey` FOREIGN KEY (`kitId`) REFERENCES `work_order_type_kits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `work_order_type_kit_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
