-- Migration: Fix series table schema to add missing columns
-- This migration adds the series_composition and cover_urls columns to the series table

-- Add series_composition column to store books composition
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS series_composition JSONB DEFAULT '[]';

-- Add cover_urls column to store all cover images for the series
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS cover_urls TEXT[] DEFAULT '{}';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_series_composition ON series USING GIN(series_composition);
CREATE INDEX IF NOT EXISTS idx_series_cover_urls ON series USING GIN(cover_urls);

-- Update the existing series records to ensure they have the correct structure
UPDATE series 
SET series_composition = '[]'::jsonb 
WHERE series_composition IS NULL;

UPDATE series 
SET cover_urls = '{}'::text[] 
WHERE cover_urls IS NULL;