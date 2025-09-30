-- Fiction Library Database Utility Functions
-- Migration 003: Utility Functions

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
    type VARCHAR(10), -- 'book' or 'series'
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

-- Function to get book recommendations for user
CREATE OR REPLACE FUNCTION get_book_recommendations(
    user_id UUID,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    author VARCHAR(255),
    description TEXT,
    cover_url VARCHAR(500),
    rating DECIMAL(3,2),
    recommendation_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.author,
        b.description,
        b.cover_url,
        b.rating,
        -- Simple recommendation based on genres and authors from user's favorites
        (
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM user_books ub 
                    JOIN books fav_b ON ub.book_id = fav_b.id 
                    WHERE ub.user_id = get_book_recommendations.user_id 
                    AND ub.is_favorite = true 
                    AND fav_b.author = b.author
                ) THEN 3.0
                WHEN b.genres && ARRAY(
                    SELECT DISTINCT unnest(fav_b.genres)
                    FROM user_books ub 
                    JOIN books fav_b ON ub.book_id = fav_b.id 
                    WHERE ub.user_id = get_book_recommendations.user_id 
                    AND ub.is_favorite = true
                ) THEN 2.0
                ELSE 1.0
            END
            + COALESCE(b.rating, 0) * 0.1
            + (b.downloads_count::REAL / 1000.0)
        ) as recommendation_score
    FROM books b
    WHERE NOT EXISTS (
        SELECT 1 FROM user_books ub 
        WHERE ub.user_id = get_book_recommendations.user_id 
        AND ub.book_id = b.id
    )
    ORDER BY recommendation_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user reading statistics
CREATE OR REPLACE FUNCTION get_user_reading_stats(user_id UUID)
RETURNS TABLE (
    total_books_read INTEGER,
    total_reading_time_hours DECIMAL(10,2),
    favorite_genres TEXT[],
    current_streak_days INTEGER,
    books_this_month INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT rh.book_id)::INTEGER as total_books_read,
        ROUND(SUM(rh.reading_time_minutes) / 60.0, 2) as total_reading_time_hours,
        ARRAY(
            SELECT genre 
            FROM (
                SELECT unnest(b.genres) as genre, COUNT(*) as cnt
                FROM reading_history rh
                JOIN books b ON rh.book_id = b.id
                WHERE rh.user_id = get_user_reading_stats.user_id
                GROUP BY genre
                ORDER BY cnt DESC
                LIMIT 5
            ) t
        ) as favorite_genres,
        (
            SELECT COUNT(*)::INTEGER
            FROM (
                SELECT DISTINCT DATE(last_read_at)
                FROM reading_history
                WHERE user_id = get_user_reading_stats.user_id
                AND last_read_at >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY DATE(last_read_at) DESC
            ) daily_reads
        ) as current_streak_days,
        (
            SELECT COUNT(DISTINCT book_id)::INTEGER
            FROM reading_history
            WHERE user_id = get_user_reading_stats.user_id
            AND last_read_at >= DATE_TRUNC('month', CURRENT_DATE)
        ) as books_this_month
    FROM reading_history rh
    WHERE rh.user_id = get_user_reading_stats.user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get popular books
CREATE OR REPLACE FUNCTION get_popular_books(
    time_period VARCHAR(20) DEFAULT 'all_time', -- 'week', 'month', 'year', 'all_time'
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    author VARCHAR(255),
    description TEXT,
    cover_url VARCHAR(500),
    rating DECIMAL(3,2),
    downloads_count INTEGER,
    views_count INTEGER,
    popularity_score REAL
) AS $$
DECLARE
    date_filter TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Set date filter based on time period
    CASE time_period
        WHEN 'week' THEN date_filter := NOW() - INTERVAL '7 days';
        WHEN 'month' THEN date_filter := NOW() - INTERVAL '30 days';
        WHEN 'year' THEN date_filter := NOW() - INTERVAL '365 days';
        ELSE date_filter := '1970-01-01'::TIMESTAMP WITH TIME ZONE;
    END CASE;

    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.author,
        b.description,
        b.cover_url,
        b.rating,
        b.downloads_count,
        b.views_count,
        (
            b.downloads_count * 2.0 +
            b.views_count * 1.0 +
            COALESCE(b.rating, 0) * 10.0 +
            EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400.0 * (-0.1) -- Slightly prefer newer books
        ) as popularity_score
    FROM books b
    WHERE b.created_at >= date_filter
    ORDER BY popularity_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;