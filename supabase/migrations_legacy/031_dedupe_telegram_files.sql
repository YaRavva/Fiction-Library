-- Migration 031: mark duplicate Telegram files and keep canonical rows only

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

DROP FUNCTION IF EXISTS match_telegram_files(vector, float, int);

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

COMMENT ON FUNCTION refresh_telegram_file_duplicates IS 'Marks duplicate Telegram file rows and keeps the largest, then newest, row as canonical';
