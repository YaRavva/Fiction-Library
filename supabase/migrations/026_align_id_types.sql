-- Migration: Align ID types for consistency
-- This migration changes the telegram_post_id and message_id columns to BIGINT (int8)
-- to match the type of telegram_messages_index.message_id.

-- 1. Alter 'books' table
ALTER TABLE public.books
ALTER COLUMN telegram_post_id TYPE BIGINT
USING telegram_post_id::BIGINT;

-- Add a comment to describe the change
COMMENT ON COLUMN public.books.telegram_post_id IS 'Telegram message ID, aligned with telegram_messages_index.message_id (BIGINT)';


-- 2. Alter 'telegram_processed_messages' table
ALTER TABLE public.telegram_processed_messages
ALTER COLUMN message_id TYPE BIGINT
USING message_id::BIGINT;

-- Add a comment to describe the change
COMMENT ON COLUMN public.telegram_processed_messages.message_id IS 'Telegram message ID, aligned with telegram_messages_index.message_id (BIGINT)';