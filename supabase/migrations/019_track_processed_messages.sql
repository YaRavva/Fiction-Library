-- Migration: track processed Telegram messages

-- Create table to track processed Telegram messages
CREATE TABLE IF NOT EXISTS telegram_processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_message_id ON telegram_processed_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_channel ON telegram_processed_messages(channel);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_book_id ON telegram_processed_messages(book_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_processed_at ON telegram_processed_messages(processed_at);

-- Add processed flag to books table
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS metadata_processed BOOLEAN DEFAULT FALSE;

-- Create index for the processed flag
CREATE INDEX IF NOT EXISTS idx_books_metadata_processed ON books(metadata_processed);