-- Migration: Add WhatsApp reminder limits and isolation delay configuration
-- Table: whatsapp_reminder_settings

ALTER TABLE whatsapp_reminder_settings 
ADD COLUMN IF NOT EXISTS isolationDelayDays INT NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS maxInvoiceReminders INT NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS maxTotalMessagesPerCycle INT NOT NULL DEFAULT 3;
