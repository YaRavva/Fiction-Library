-- Migration 030: Enable pgvector and add embedding columns

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
    message_id bigint,
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
      AND tf.file_name IS NOT NULL
      AND 1 - (tf.embedding <=> query_embedding) > match_threshold
    ORDER BY tf.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON COLUMN books.embedding IS 'Vector embedding for semantic similarity search (1024 dimensions, voyage-ai/voyage-4 compatible)';
COMMENT ON COLUMN telegram_files.embedding IS 'Vector embedding for Telegram file name similarity search (1024 dimensions, voyage-ai/voyage-4 compatible)';
COMMENT ON FUNCTION match_books IS 'Find books by vector similarity using cosine distance';
COMMENT ON FUNCTION match_telegram_files IS 'Find Telegram files by vector similarity using cosine distance';
