-- Migration: Add timer settings table
-- This migration adds a table to store automated process settings

-- Create timer_settings table
CREATE TABLE IF NOT EXISTS timer_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    interval_minutes INTEGER DEFAULT 60 CHECK (interval_minutes >= 1 AND interval_minutes <= 1440),
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings for different processes
INSERT INTO timer_settings (process_name, enabled, interval_minutes)
VALUES 
    ('deduplication', false, 60),
    ('channel_sync', false, 30),
    ('file_download', false, 15)
ON CONFLICT (process_name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_timer_settings_process_name ON timer_settings(process_name);
CREATE INDEX IF NOT EXISTS idx_timer_settings_next_run ON timer_settings(next_run) WHERE enabled = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_timer_settings_updated_at 
    BEFORE UPDATE ON timer_settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();