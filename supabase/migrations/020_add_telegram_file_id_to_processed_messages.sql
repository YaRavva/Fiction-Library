-- Migration: Add telegram_file_id to telegram_processed_messages table

-- Add telegram_file_id column to track which file was processed for each message
ALTER TABLE telegram_processed_messages 
ADD COLUMN IF NOT EXISTS telegram_file_id TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_telegram_file_id ON telegram_processed_messages(telegram_file_id);

-- Add comment to describe the purpose of the new column
COMMENT ON COLUMN telegram_processed_messages.telegram_file_id IS 'ID of the Telegram file that was processed for this message';