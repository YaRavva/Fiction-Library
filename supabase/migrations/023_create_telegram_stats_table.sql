-- Migration: Create telegram_stats table
-- This migration creates a table to store Telegram statistics for the admin panel

-- Create the telegram_stats table
CREATE TABLE IF NOT EXISTS telegram_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    books_in_database INTEGER DEFAULT 0,
    books_in_telegram INTEGER DEFAULT 0,
    missing_books INTEGER DEFAULT 0,
    books_without_files INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a comment to describe the table
COMMENT ON TABLE telegram_stats IS 'Stores Telegram statistics for the admin panel';

-- Create an index on updated_at for faster queries
CREATE INDEX IF NOT EXISTS idx_telegram_stats_updated_at ON telegram_stats (updated_at DESC);

-- Insert a default row to ensure there's always at least one record
INSERT INTO telegram_stats (id, books_in_database, books_in_telegram, missing_books, books_without_files)
VALUES ('00000000-0000-0000-0000-000000000000', 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;