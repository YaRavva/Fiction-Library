-- Migration: Alter telegram_messages_index message_id type
-- This migration changes the message_id column from TEXT to BIGINT for proper numeric sorting

-- First, we need to convert existing data and handle any potential issues
-- Since we've cleared the table, we can safely alter the column type

-- Alter the message_id column type from TEXT to BIGINT
ALTER TABLE telegram_messages_index 
ALTER COLUMN message_id TYPE BIGINT USING message_id::BIGINT;

-- Update the index to use the new type
DROP INDEX IF EXISTS idx_telegram_messages_index_message_id;
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_message_id ON telegram_messages_index(message_id);

-- Add comment to describe the change
COMMENT ON COLUMN telegram_messages_index.message_id IS 'Telegram message ID as BIGINT for proper numeric sorting and comparison';