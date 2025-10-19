-- Migration: Create optimized tables for Telegram integration
-- This migration creates all necessary tables for Telegram integration with proper data types

-- Telegram messages index (for fast lookup of all messages)
CREATE TABLE IF NOT EXISTS telegram_messages_index (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id BIGINT NOT NULL UNIQUE,  -- Changed to BIGINT
    channel TEXT NOT NULL,
    author TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_message_id ON telegram_messages_index(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_channel ON telegram_messages_index(channel);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_author ON telegram_messages_index(author);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_title ON telegram_messages_index(title);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_created_at ON telegram_messages_index(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_telegram_messages_index_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_telegram_messages_index_updated_at_trigger 
    BEFORE UPDATE ON telegram_messages_index
    FOR EACH ROW EXECUTE FUNCTION update_telegram_messages_index_updated_at();

-- Add comment to describe the table
COMMENT ON TABLE telegram_messages_index IS 'Stores basic information about all Telegram messages for fast lookup and new book detection';
COMMENT ON COLUMN telegram_messages_index.message_id IS 'Telegram message ID as BIGINT for proper numeric sorting and comparison';

-- Processed Telegram messages tracking
CREATE TABLE IF NOT EXISTS telegram_processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id BIGINT NOT NULL,  -- Changed to BIGINT
  channel TEXT NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  telegram_file_id TEXT,  -- Added for tracking file ID
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, channel)  -- Added unique constraint
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_message_id ON telegram_processed_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_channel ON telegram_processed_messages(channel);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_book_id ON telegram_processed_messages(book_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_telegram_file_id ON telegram_processed_messages(telegram_file_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_processed_at ON telegram_processed_messages(processed_at);

-- Add processed flag to books table
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS metadata_processed BOOLEAN DEFAULT FALSE;

-- Create index for the processed flag
CREATE INDEX IF NOT EXISTS idx_books_metadata_processed ON books(metadata_processed);

-- Add comment to describe the column
COMMENT ON COLUMN telegram_processed_messages.telegram_file_id IS 'ID of the Telegram file that was processed for this message';