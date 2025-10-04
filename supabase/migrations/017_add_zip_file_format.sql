-- Migration: Add support for ZIP file format
-- This migration updates the books table to allow only FB2 and ZIP files

-- Drop the existing constraint
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_file_format_check;

-- Add the new constraint with only FB2 and ZIP support
ALTER TABLE books 
ADD CONSTRAINT books_file_format_check 
CHECK (file_format IN ('fb2', 'zip'));

-- Add a comment to describe the updated constraint
COMMENT ON COLUMN books.file_format IS 'Format of the book file: fb2, zip';