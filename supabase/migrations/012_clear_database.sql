-- Migration: Clear all data from the database
-- WARNING: This will remove all data from books, series, and related tables

-- First, disable foreign key checks to avoid constraint violations
SET session_replication_role = replica;

-- Clear all tables in the correct order to avoid foreign key constraint issues
TRUNCATE TABLE reading_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_bookmarks RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_ratings RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_books RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_series RESTART IDENTITY CASCADE;
TRUNCATE TABLE books RESTART IDENTITY CASCADE;
TRUNCATE TABLE series RESTART IDENTITY CASCADE;
TRUNCATE TABLE telegram_download_queue RESTART IDENTITY CASCADE;
TRUNCATE TABLE telegram_sync_status RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_profiles RESTART IDENTITY CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Optional: Vacuum the database to reclaim space
-- VACUUM ANALYZE;