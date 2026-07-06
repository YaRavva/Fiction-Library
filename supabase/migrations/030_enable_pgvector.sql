-- Migration 030: Enable pgvector and add embedding columns
-- Enables vector similarity search for book-file matching

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create index for fast cosine similarity search
-- Using IVFFlat index for datasets < 1M rows
CREATE INDEX IF NOT EXISTS books_embedding_idx 
    ON books 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 4. Create index for file_names table (for file embeddings)
ALTER TABLE IF EXISTS file_names ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 5. Create match_books function for vector search
CREATE OR REPLACE FUNCTION match_books(
    query_embedding vector(1536),
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

-- 6. Create match_books_for_file function (combines vector + keyword search)
CREATE OR REPLACE FUNCTION match_books_for_file(
    file_name text,
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.4,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title varchar,
    author varchar,
    similarity float,
    keyword_score float
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    search_terms text[];
    term text;
    keyword_results record;
    combined_score float;
BEGIN
    -- Extract search terms from filename
    search_terms := string_to_array(
        lower(regexp_replace(file_name, '[^a-zA-Zа-яА-Я0-9]', ' ', 'g')),
        ' '
    );
    
    -- Find books matching by vector similarity
    FOR keyword_results IN
        SELECT
            b.id,
            b.title,
            b.author,
            1 - (b.embedding <=> query_embedding) AS vector_sim,
            -- Simple keyword matching score
            CASE 
                WHEN lower(b.title) ILIKE '%' || file_name || '%' THEN 1.0
                WHEN lower(b.author) ILIKE '%' || file_name || '%' THEN 0.8
                ELSE 0.0
            END AS kw_score
        FROM books b
        WHERE b.embedding IS NOT NULL
    LOOP
        -- Combine scores (70% vector, 30% keyword)
        combined_score := (keyword_results.vector_sim * 0.7) + (keyword_results.kw_score * 0.3);
        
        IF combined_score > match_threshold THEN
            id := keyword_results.id;
            title := keyword_results.title;
            author := keyword_results.author;
            similarity := keyword_results.vector_sim;
            keyword_score := keyword_results.kw_score;
            RETURN NEXT;
        END IF;
    END LOOP;
    
    -- Sort by combined score
    RETURN QUERY
    SELECT * FROM (
        SELECT
            b.id,
            b.title,
            b.author,
            1 - (b.embedding <=> query_embedding) AS similarity,
            CASE 
                WHEN lower(b.title) ILIKE '%' || file_name || '%' THEN 1.0
                WHEN lower(b.author) ILIKE '%' || file_name || '%' THEN 0.8
                ELSE 0.0
            END AS keyword_score
        FROM books b
        WHERE b.embedding IS NOT NULL
          AND 1 - (b.embedding <=> query_embedding) > match_threshold
        ORDER BY 
            (1 - (b.embedding <=> query_embedding)) * 0.7 + 
            (CASE 
                WHEN lower(b.title) ILIKE '%' || file_name || '%' THEN 1.0
                WHEN lower(b.author) ILIKE '%' || file_name || '%' THEN 0.8
                ELSE 0.0
            END) * 0.3 DESC
        LIMIT match_count
    ) sub;
END;
$$;

-- 7. Add comment for documentation
COMMENT ON COLUMN books.embedding IS 'Vector embedding for semantic similarity search (1536 dimensions, OpenAI ada-002 compatible)';
COMMENT ON FUNCTION match_books IS 'Find books by vector similarity using cosine distance';
COMMENT ON FUNCTION match_books_for_file IS 'Find books by combining vector similarity with keyword matching';
