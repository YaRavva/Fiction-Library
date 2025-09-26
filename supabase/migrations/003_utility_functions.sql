-- Fiction Library Database Functions
-- Migration 003: Utility Functions

-- Function to search books and series
CREATE OR REPLACE FUNCTION search_content(
    search_query TEXT,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    type TEXT,
    id UUID,
    title TEXT,
    author TEXT,
    description TEXT,
    rating DECIMAL,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'book'::TEXT as type,
        b.id,
        b.title,
        b.author,
        b.description,
        b.rating,
        b.cover_url,
        b.created_at
    FROM books b
    WHERE 
        to_tsvector('russian', b.title || ' ' || b.author || ' ' || COALESCE(b.description, '')) 
        @@ plainto_tsquery('russian', search_query)
    
    UNION ALL
    
    SELECT 
        'series'::TEXT as type,
        s.id,
        s.title,
        s.author,
        s.description,
        s.rating,
        s.cover_url,
        s.created_at
    FROM series s
    WHERE 
        to_tsvector('russian', s.title || ' ' || s.author || ' ' || COALESCE(s.description, '')) 
        @@ plainto_tsquery('russian', search_query)
    
    ORDER BY created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get book recommendations for user
CREATE OR REPLACE FUNCTION get_book_recommendations(
    target_user_id UUID,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
    book_id UUID,
    title TEXT,
    author TEXT,
    rating DECIMAL,
    cover_url TEXT,
    recommendation_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH user_preferences AS (
        -- Получаем жанры и авторов, которые нравятся пользователю
        SELECT DISTINCT 
            unnest(b.genres) as genre,
            b.author,
            ur.rating
        FROM user_ratings ur
        JOIN books b ON ur.book_id = b.id
        WHERE ur.user_id = target_user_id 
        AND ur.rating >= 7
    ),
    book_scores AS (
        SELECT 
            b.id as book_id,
            b.title,
            b.author,
            b.rating,
            b.cover_url,
            -- Базовый рейтинг книги
            COALESCE(b.rating, 0) * 0.3 +
            -- Бонус за совпадение жанра
            (CASE WHEN EXISTS(
                SELECT 1 FROM user_preferences up 
                WHERE up.genre = ANY(b.genres)
            ) THEN 2.0 ELSE 0 END) +
            -- Бонус за совпадение автора
            (CASE WHEN EXISTS(
                SELECT 1 FROM user_preferences up 
                WHERE up.author = b.author
            ) THEN 1.5 ELSE 0 END) +
            -- Бонус за популярность (количество высоких оценок)
            (SELECT COUNT(*) * 0.1 FROM user_ratings ur2 
             WHERE ur2.book_id = b.id AND ur2.rating >= 8) as recommendation_score
        FROM books b
        WHERE b.id NOT IN (
            -- Исключаем уже прочитанные книги
            SELECT book_id FROM user_ratings 
            WHERE user_id = target_user_id
        )
    )
    SELECT 
        bs.book_id,
        bs.title,
        bs.author,
        bs.rating,
        bs.cover_url,
        bs.recommendation_score
    FROM book_scores bs
    ORDER BY bs.recommendation_score DESC, bs.rating DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get reading statistics for user
CREATE OR REPLACE FUNCTION get_user_reading_stats(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_books_read', (
            SELECT COUNT(*) FROM user_ratings 
            WHERE user_id = target_user_id
        ),
        'total_reading_time_hours', (
            SELECT COALESCE(SUM(reading_time_minutes), 0) / 60.0 
            FROM reading_history 
            WHERE user_id = target_user_id
        ),
        'average_rating', (
            SELECT ROUND(AVG(rating), 2) 
            FROM user_ratings 
            WHERE user_id = target_user_id
        ),
        'favorite_genres', (
            SELECT json_agg(genre_stats.genre)
            FROM (
                SELECT unnest(b.genres) as genre, COUNT(*) as count
                FROM user_ratings ur
                JOIN books b ON ur.book_id = b.id
                WHERE ur.user_id = target_user_id
                GROUP BY unnest(b.genres)
                ORDER BY count DESC
                LIMIT 5
            ) genre_stats
        ),
        'books_in_progress', (
            SELECT COUNT(*) 
            FROM reading_history 
            WHERE user_id = target_user_id 
            AND reading_progress > 0 
            AND reading_progress < 100
        ),
        'completed_books', (
            SELECT COUNT(*) 
            FROM reading_history 
            WHERE user_id = target_user_id 
            AND reading_progress = 100
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update book view count
CREATE OR REPLACE FUNCTION increment_book_views(book_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE books 
    SET views_count = views_count + 1
    WHERE id = book_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update book download count
CREATE OR REPLACE FUNCTION increment_book_downloads(book_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE books 
    SET downloads_count = downloads_count + 1
    WHERE id = book_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get popular books
CREATE OR REPLACE FUNCTION get_popular_books(
    time_period INTEGER DEFAULT 30, -- days
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
    book_id UUID,
    title TEXT,
    author TEXT,
    rating DECIMAL,
    cover_url TEXT,
    views_count INTEGER,
    downloads_count INTEGER,
    avg_user_rating DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as book_id,
        b.title,
        b.author,
        b.rating,
        b.cover_url,
        b.views_count,
        b.downloads_count,
        ROUND(AVG(ur.rating), 2) as avg_user_rating
    FROM books b
    LEFT JOIN user_ratings ur ON b.id = ur.book_id
    WHERE b.created_at >= NOW() - INTERVAL '1 day' * time_period
    GROUP BY b.id, b.title, b.author, b.rating, b.cover_url, b.views_count, b.downloads_count
    ORDER BY 
        (b.views_count + b.downloads_count * 2) DESC,
        AVG(ur.rating) DESC NULLS LAST,
        b.rating DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;