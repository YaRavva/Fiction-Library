-- Migration: Remove duplicate books from the database
-- This migration removes duplicate books, keeping only the oldest one (based on created_at)

-- First, let's identify duplicates (books with same title and author)
-- We'll use a CTE to find duplicates and keep only the oldest one
WITH duplicates AS (
  SELECT 
    id,
    title,
    author,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY title, author 
      ORDER BY created_at ASC
    ) as rn
  FROM books
)
-- Delete all duplicates except the first one (oldest)
DELETE FROM books 
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
);

-- Optional: Add a unique constraint to prevent future duplicates
-- Note: This should be done carefully as it might fail if there are still duplicates
-- ALTER TABLE books ADD CONSTRAINT unique_title_author UNIQUE (title, author);