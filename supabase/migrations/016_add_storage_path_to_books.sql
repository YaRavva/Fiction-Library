-- Add storage_path column to books table
-- This column will store the path to the file in the Supabase Storage bucket

-- Add the storage_path column to books table
ALTER TABLE books
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Add the storage_path column to telegram_download_queue table
ALTER TABLE telegram_download_queue
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Create an index for faster lookups by storage_path
CREATE INDEX IF NOT EXISTS idx_books_storage_path ON books(storage_path);
CREATE INDEX IF NOT EXISTS idx_telegram_download_queue_storage_path ON telegram_download_queue(storage_path);

-- Update any existing records to have the storage_path field populated
-- This is a best-effort update based on the file_url field
UPDATE books 
SET storage_path = SUBSTRING(file_url FROM POSITION('books/' IN file_url))
WHERE file_url IS NOT NULL 
  AND storage_path IS NULL
  AND file_url LIKE '%books/%';

-- Add a comment to describe the purpose of the column
COMMENT ON COLUMN books.storage_path IS 'Path to the book file in the Supabase Storage bucket';
COMMENT ON COLUMN telegram_download_queue.storage_path IS 'Path to the file in the Supabase Storage bucket';