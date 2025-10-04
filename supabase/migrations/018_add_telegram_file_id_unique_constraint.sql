-- Migration: Add unique constraint on telegram_file_id in books table
-- This migration adds a unique constraint to prevent duplicate entries with the same telegram_file_id

-- Add unique constraint on telegram_file_id
ALTER TABLE books 
ADD CONSTRAINT books_telegram_file_id_unique UNIQUE (telegram_file_id);

-- Add a comment to describe the constraint
COMMENT ON CONSTRAINT books_telegram_file_id_unique ON books 
IS 'Ensures each Telegram file ID is unique in the books table';