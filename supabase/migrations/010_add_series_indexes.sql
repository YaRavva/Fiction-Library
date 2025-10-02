-- Migration: Add additional indexes for better series and books performance
-- This migration adds indexes to improve query performance for series and books

-- Index for series title and author for faster lookups
CREATE INDEX IF NOT EXISTS idx_series_title_author ON series(title, author);

-- Index for books title and author for faster lookups
CREATE INDEX IF NOT EXISTS idx_books_title_author ON books(title, author);

-- Index for books publication year for sorting
CREATE INDEX IF NOT EXISTS idx_books_publication_year_desc ON books(publication_year DESC);

-- Index for series rating for sorting
CREATE INDEX IF NOT EXISTS idx_series_rating_desc ON series(rating DESC NULLS LAST);

-- Index for books rating for sorting
CREATE INDEX IF NOT EXISTS idx_books_rating_desc ON books(rating DESC NULLS LAST);

-- Index for series created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_series_created_at_desc ON series(created_at DESC);

-- Index for books created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_books_created_at_desc ON books(created_at DESC);