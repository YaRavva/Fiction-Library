-- Migration: Fix books table to ensure proper series association
-- This migration ensures that books are properly linked to series

-- Make sure series_id column exists and has proper constraints
ALTER TABLE books 
ALTER COLUMN series_id TYPE UUID USING series_id::UUID;

-- Add index for better performance on series_id
CREATE INDEX IF NOT EXISTS idx_books_series_id ON books(series_id);

-- Update any books that might have incorrect series associations
-- This will clear any invalid series_id references
UPDATE books 
SET series_id = NULL 
WHERE series_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM series WHERE series.id = books.series_id
);