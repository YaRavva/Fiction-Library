-- Fiction Library Database Schema
-- Migration 001: Initial Schema Setup

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