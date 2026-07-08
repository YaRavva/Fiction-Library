-- Fiction Library: Consolidated Baseline Migration
-- Generated 2026-07-08
-- Combines all migrations into a single ordered file.
-- DANGER: Only run on a fresh database. Do NOT run on an existing production DB.

-- ============================================================
-- Migration 001: Initial Schema Setup
-- Source: 001_initial_schema.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Series table (циклы книг)
CREATE TABLE series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT,
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 10),
    cover_url VARCHAR(500),
    telegram_post_id VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    genres TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books table (отдельные книги)
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id UUID REFERENCES series(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publication_year INTEGER CHECK (publication_year > 1900 AND publication_year <= EXTRACT(YEAR FROM NOW()) + 10),
    description TEXT,
    cover_url VARCHAR(500),
    file_url VARCHAR(500),
    file_size BIGINT CHECK (file_size > 0),
    file_format VARCHAR(10) DEFAULT 'fb2' CHECK (file_format IN ('fb2', 'epub', 'pdf', 'txt')),
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 10),
    tags TEXT[] DEFAULT '{}',
    genres TEXT[] DEFAULT '{}',
    series_order INTEGER CHECK (series_order > 0),
    telegram_file_id VARCHAR(100),
    downloads_count INTEGER DEFAULT 0 CHECK (downloads_count >= 0),
    views_count INTEGER DEFAULT 0 CHECK (views_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles (расширение auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50),
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    role VARCHAR(20) DEFAULT 'reader' CHECK (role IN ('reader', 'admin')),
    reading_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username)
);

-- User-Series relationships (избранные серии)
CREATE TABLE user_series (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    series_id UUID REFERENCES series(id) ON DELETE CASCADE,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, series_id)
);

-- User-Books relationships (избранные книги)
CREATE TABLE user_books (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, book_id)
);

-- Reading history (история чтения)
CREATE TABLE reading_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    last_position INTEGER DEFAULT 0 CHECK (last_position >= 0),
    reading_progress DECIMAL(5,2) DEFAULT 0 CHECK (reading_progress >= 0 AND reading_progress <= 100),
    reading_time_minutes INTEGER DEFAULT 0 CHECK (reading_time_minutes >= 0),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- User bookmarks (закладки)
CREATE TABLE user_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    chapter VARCHAR(255),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User ratings and reviews (оценки и отзывы)
CREATE TABLE user_ratings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, book_id)
);

-- Indexes for performance optimization
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_series ON books(series_id);
CREATE INDEX idx_books_genres ON books USING GIN(genres);
CREATE INDEX idx_books_tags ON books USING GIN(tags);
CREATE INDEX idx_books_publication_year ON books(publication_year);
CREATE INDEX idx_series_author ON series(author);
CREATE INDEX idx_series_genres ON series USING GIN(genres);
CREATE INDEX idx_series_tags ON series USING GIN(tags);
CREATE INDEX idx_reading_history_user ON reading_history(user_id);
CREATE INDEX idx_reading_history_book ON reading_history(book_id);
CREATE INDEX idx_user_bookmarks_user_book ON user_bookmarks(user_id, book_id);
CREATE INDEX idx_user_ratings_book ON user_ratings(book_id);

-- Full-text search indexes
CREATE INDEX idx_books_title_search ON books USING GIN(to_tsvector('russian', title));
CREATE INDEX idx_books_description_search ON books USING GIN(to_tsvector('russian', description));
CREATE INDEX idx_series_title_search ON series USING GIN(to_tsvector('russian', title));
CREATE INDEX idx_series_description_search ON series USING GIN(to_tsvector('russian', description));

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_history_updated_at BEFORE UPDATE ON reading_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ratings_updated_at BEFORE UPDATE ON user_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration 002: Row Level Security Setup
-- Source: 002_security_policies.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- Series policies (публичное чтение, админы могут изменять)
CREATE POLICY "Series are viewable by everyone" ON series
    FOR SELECT USING (true);

CREATE POLICY "Only admins can insert series" ON series
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update series" ON series
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete series" ON series
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Books policies (публичное чтение, админы могут изменять)
CREATE POLICY "Books are viewable by everyone" ON books
    FOR SELECT USING (true);

CREATE POLICY "Only admins can insert books" ON books
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update books" ON books
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete books" ON books
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User profiles policies
CREATE POLICY "Users can view all profiles" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Only admins can delete profiles" ON user_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User-Series policies (только владелец)
CREATE POLICY "Users can view their own series relationships" ON user_series
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own series relationships" ON user_series
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own series relationships" ON user_series
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own series relationships" ON user_series
    FOR DELETE USING (auth.uid() = user_id);

-- User-Books policies (только владелец)
CREATE POLICY "Users can view their own book relationships" ON user_books
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own book relationships" ON user_books
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book relationships" ON user_books
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own book relationships" ON user_books
    FOR DELETE USING (auth.uid() = user_id);

-- Reading history policies (только владелец)
CREATE POLICY "Users can view their own reading history" ON reading_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading history" ON reading_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading history" ON reading_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading history" ON reading_history
    FOR DELETE USING (auth.uid() = user_id);

-- User bookmarks policies (только владелец)
CREATE POLICY "Users can view their own bookmarks" ON user_bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks" ON user_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks" ON user_bookmarks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON user_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- User ratings policies (публичное чтение, только владелец может изменять)
CREATE POLICY "Everyone can view ratings" ON user_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own ratings" ON user_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON user_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON user_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username, display_name, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
        'reader'
    );
    RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Migration 003: Utility Functions
-- Source: 003_utility_functions.sql
-- ============================================================

-- Function to increment downloads count
CREATE OR REPLACE FUNCTION increment_downloads(book_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE books
    SET downloads_count = downloads_count + 1,
        updated_at = NOW()
    WHERE id = book_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment views count
CREATE OR REPLACE FUNCTION increment_views(book_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE books
    SET views_count = views_count + 1,
        updated_at = NOW()
    WHERE id = book_id;
END;
$$ LANGUAGE plpgsql;

-- Function for full-text search
CREATE OR REPLACE FUNCTION search_content(
    search_query TEXT,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    author VARCHAR(255),
    description TEXT,
    type VARCHAR(10),
    cover_url VARCHAR(500),
    rating DECIMAL(3,2),
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Search in books
        SELECT
            b.id,
            b.title,
            b.author,
            b.description,
            'book'::VARCHAR(10) as type,
            b.cover_url,
            b.rating,
            ts_rank(
                to_tsvector('russian', COALESCE(b.title, '') || ' ' || COALESCE(b.author, '') || ' ' || COALESCE(b.description, '')),
                plainto_tsquery('russian', search_query)
            ) as rank
        FROM books b
        WHERE to_tsvector('russian', COALESCE(b.title, '') || ' ' || COALESCE(b.author, '') || ' ' || COALESCE(b.description, ''))
              @@ plainto_tsquery('russian', search_query)

        UNION ALL

        -- Search in series
        SELECT
            s.id,
            s.title,
            s.author,
            s.description,
            'series'::VARCHAR(10) as type,
            s.cover_url,
            s.rating,
            ts_rank(
                to_tsvector('russian', COALESCE(s.title, '') || ' ' || COALESCE(s.author, '') || ' ' || COALESCE(s.description, '')),
                plainto_tsquery('russian', search_query)
            ) as rank
        FROM series s
        WHERE to_tsvector('russian', COALESCE(s.title, '') || ' ' || COALESCE(s.author, '') || ' ' || COALESCE(s.description, ''))
              @@ plainto_tsquery('russian', search_query)
    )
    ORDER BY rank DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Migration: Telegram Sync, Covers Storage, Series Fixes
-- Sources: 005_telegram_sync.sql, 006-010, 011-020, 023-026
-- ============================================================

-- Telegram sync status
CREATE TABLE telegram_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id VARCHAR(100) NOT NULL,
    last_message_id VARCHAR(100),
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_count INTEGER DEFAULT 0 CHECK (error_count >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id)
);

-- Add new columns to books and series
ALTER TABLE books
    ADD COLUMN IF NOT EXISTS telegram_channel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    ADD COLUMN IF NOT EXISTS sync_error TEXT,
    ADD COLUMN IF NOT EXISTS telegram_post_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS storage_path TEXT,
    ADD COLUMN IF NOT EXISTS metadata_processed BOOLEAN DEFAULT FALSE;

ALTER TABLE series
    ADD COLUMN IF NOT EXISTS telegram_channel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    ADD COLUMN IF NOT EXISTS sync_error TEXT,
    ADD COLUMN IF NOT EXISTS series_composition JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS cover_urls TEXT[] DEFAULT '{}';

-- Telegram sync indexes
CREATE INDEX IF NOT EXISTS idx_books_telegram_sync ON books (telegram_channel_id, telegram_post_id) WHERE telegram_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_telegram_sync ON series (telegram_channel_id, telegram_post_id) WHERE telegram_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_composition ON series USING GIN(series_composition);
CREATE INDEX IF NOT EXISTS idx_series_cover_urls ON series USING GIN(cover_urls);
CREATE INDEX IF NOT EXISTS idx_books_series_id ON books(series_id);
CREATE INDEX IF NOT EXISTS idx_books_storage_path ON books(storage_path);
CREATE INDEX IF NOT EXISTS idx_books_metadata_processed ON books(metadata_processed);

-- RLS for sync status
ALTER TABLE telegram_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage sync status"
    ON telegram_sync_status
    FOR ALL
    TO authenticated
    USING (
        current_user = 'authenticator'
        OR EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'admin'
        )
    );

-- Covers storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

CREATE POLICY "Authenticated users can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

CREATE POLICY "Authenticated users can update covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'covers')
WITH CHECK (bucket_id = 'covers');

CREATE POLICY "Authenticated users can delete covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'covers');

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_series_title_author ON series(title, author);
CREATE INDEX IF NOT EXISTS idx_books_title_author ON books(title, author);
CREATE INDEX IF NOT EXISTS idx_books_publication_year_desc ON books(publication_year DESC);
CREATE INDEX IF NOT EXISTS idx_series_rating_desc ON series(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_books_rating_desc ON books(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_series_created_at_desc ON series(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_created_at_desc ON books(created_at DESC);

-- File format constraint update
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_file_format_check;
ALTER TABLE books
ADD CONSTRAINT books_file_format_check
CHECK (file_format IN ('fb2', 'zip'));

-- Book telegram_file_id unique constraint
ALTER TABLE books
ADD CONSTRAINT books_telegram_file_id_unique UNIQUE (telegram_file_id);

-- Track processed messages
CREATE TABLE IF NOT EXISTS telegram_processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_message_id ON telegram_processed_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_channel ON telegram_processed_messages(channel);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_book_id ON telegram_processed_messages(book_id);
CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_processed_at ON telegram_processed_messages(processed_at);

ALTER TABLE telegram_processed_messages
ADD COLUMN IF NOT EXISTS telegram_file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_telegram_file_id ON telegram_processed_messages(telegram_file_id);

-- Telegram stats table
CREATE TABLE IF NOT EXISTS telegram_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    books_in_database INTEGER DEFAULT 0,
    books_in_telegram INTEGER DEFAULT 0,
    missing_books INTEGER DEFAULT 0,
    books_without_files INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_stats_updated_at ON telegram_stats (updated_at DESC);

-- Messages index
CREATE TABLE IF NOT EXISTS telegram_messages_index (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL,
    author TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_message_id ON telegram_messages_index(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_channel ON telegram_messages_index(channel);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_author ON telegram_messages_index(author);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_title ON telegram_messages_index(title);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_created_at ON telegram_messages_index(created_at DESC);

-- Тип колонки message_id как BIGINT
ALTER TABLE telegram_messages_index
ALTER COLUMN message_id TYPE BIGINT USING message_id::BIGINT;

DROP INDEX IF EXISTS idx_telegram_messages_index_message_id;
CREATE INDEX IF NOT EXISTS idx_telegram_messages_index_message_id ON telegram_messages_index(message_id);

-- Align ID types in books and processed_messages
ALTER TABLE public.books
ALTER COLUMN telegram_post_id TYPE BIGINT
USING telegram_post_id::BIGINT;

ALTER TABLE public.telegram_processed_messages
ALTER COLUMN message_id TYPE BIGINT
USING message_id::BIGINT;

-- ============================================================
-- Migration: auto_update_settings table
-- Source: 027
-- ============================================================

CREATE TABLE IF NOT EXISTS auto_update_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT FALSE,
  interval INTEGER DEFAULT 30,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
);

INSERT INTO auto_update_settings (id, enabled, interval, last_run, next_run)
SELECT 1, false, 30, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM auto_update_settings WHERE id = 1);

-- ============================================================
-- Migration: Fix RLS on internal tables
-- Source: 028
-- ============================================================

ALTER TABLE public.telegram_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_update_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages_index ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Migration: Enable RLS on telegram_files
-- Source: 029
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.telegram_files') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.telegram_files ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

-- ============================================================
-- Migration: Enable pgvector extension
-- Source: 030
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

DROP INDEX IF EXISTS books_embedding_idx;
DROP INDEX IF EXISTS telegram_files_embedding_idx;
DROP FUNCTION IF EXISTS match_books(vector, float, int);
DROP FUNCTION IF EXISTS match_telegram_files(vector, float, int);
DROP FUNCTION IF EXISTS match_books_for_file(text, vector, float, int);

ALTER TABLE books DROP COLUMN IF EXISTS embedding;
ALTER TABLE books ADD COLUMN embedding vector(1024);

ALTER TABLE telegram_files DROP COLUMN IF EXISTS embedding;
ALTER TABLE telegram_files ADD COLUMN embedding vector(1024);

CREATE INDEX IF NOT EXISTS books_embedding_idx
    ON books
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS telegram_files_embedding_idx
    ON telegram_files
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_books(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title varchar,
    author varchar,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.title,
        b.author,
        1 - (b.embedding <=> query_embedding) AS similarity
    FROM books b
    WHERE b.embedding IS NOT NULL
      AND 1 - (b.embedding <=> query_embedding) > match_threshold
    ORDER BY b.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_telegram_files(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.4,
    match_count int DEFAULT 100
)
RETURNS TABLE (
    message_id integer,
    file_name text,
    mime_type text,
    file_size bigint,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tf.message_id,
        tf.file_name,
        tf.mime_type,
        tf.file_size,
        1 - (tf.embedding <=> query_embedding) AS similarity
    FROM telegram_files tf
    WHERE tf.embedding IS NOT NULL
      AND tf.duplicate_of_message_id IS NULL
      AND tf.file_name IS NOT NULL
      AND 1 - (tf.embedding <=> query_embedding) > match_threshold
    ORDER BY tf.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
-- Migration: Telegram files deduplication
-- Source: 031
-- ============================================================

ALTER TABLE telegram_files
ADD COLUMN IF NOT EXISTS duplicate_group_key text,
ADD COLUMN IF NOT EXISTS duplicate_rank integer,
ADD COLUMN IF NOT EXISTS duplicate_of_message_id integer REFERENCES telegram_files(message_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS duplicate_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_telegram_files_duplicate_of_message_id
    ON telegram_files(duplicate_of_message_id);

CREATE INDEX IF NOT EXISTS idx_telegram_files_canonical
    ON telegram_files(message_id)
    WHERE duplicate_of_message_id IS NULL;

CREATE OR REPLACE FUNCTION refresh_telegram_file_duplicates()
RETURNS TABLE (
    total_files integer,
    duplicate_groups integer,
    duplicate_rows integer
)
LANGUAGE plpgsql
AS $$
BEGIN
    WITH normalized AS (
        SELECT
            tf.message_id,
            lower(
                btrim(
                    regexp_replace(
                        regexp_replace(tf.file_name, '\.[^.]+$', ''),
                        '[^[:alnum:]а-яА-ЯёЁ]+',
                        ' ',
                        'g'
                    )
                )
            ) AS normalized_name,
            tf.file_size,
            tf.date,
            tf.indexed_at
        FROM telegram_files tf
        WHERE tf.file_name IS NOT NULL
    ),
    ranked AS (
        SELECT
            n.*,
            count(*) OVER (PARTITION BY n.normalized_name) AS group_size,
            first_value(n.message_id) OVER (
                PARTITION BY n.normalized_name
                ORDER BY
                    coalesce(n.file_size, 0) DESC,
                    coalesce(n.date, n.indexed_at) DESC NULLS LAST,
                    n.message_id DESC
            ) AS canonical_message_id,
            row_number() OVER (
                PARTITION BY n.normalized_name
                ORDER BY
                    coalesce(n.file_size, 0) DESC,
                    coalesce(n.date, n.indexed_at) DESC NULLS LAST,
                    n.message_id DESC
            ) AS keep_rank
        FROM normalized n
        WHERE n.normalized_name <> ''
    )
    UPDATE telegram_files tf
    SET
        duplicate_group_key = r.normalized_name,
        duplicate_rank = r.keep_rank,
        duplicate_of_message_id = CASE
            WHEN r.group_size > 1 AND r.keep_rank > 1 THEN r.canonical_message_id
            ELSE NULL
        END,
        duplicate_checked_at = now(),
        embedding = CASE
            WHEN r.group_size > 1 AND r.keep_rank > 1 THEN NULL
            ELSE tf.embedding
        END
    FROM ranked r
    WHERE tf.message_id = r.message_id;

    RETURN QUERY
    WITH grouped AS (
        SELECT duplicate_group_key, count(*) AS copies
        FROM telegram_files
        WHERE duplicate_group_key IS NOT NULL
        GROUP BY duplicate_group_key
        HAVING count(*) > 1
    )
    SELECT
        (SELECT count(*)::integer FROM telegram_files WHERE file_name IS NOT NULL) AS total_files,
        (SELECT count(*)::integer FROM grouped) AS duplicate_groups,
        (SELECT coalesce(sum(copies - 1), 0)::integer FROM grouped) AS duplicate_rows;
END;
$$;

SELECT * FROM refresh_telegram_file_duplicates();
