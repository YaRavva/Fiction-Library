-- Migration: Create telegram_messages_index table
-- This migration creates a table to store basic information about all Telegram messages for fast lookup

-- Create the telegram_messages_index table
CREATE TABLE IF NOT EXISTS telegram_messages_index (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL UNIQUE,
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