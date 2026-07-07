import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const MIGRATION_SQL = `
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
`;

/**
 * POST /api/admin/migrate-pgvector
 * Run pgvector migration via Supabase SQL API
 */
export async function POST(request: Request) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
			return NextResponse.json(
				{ error: "Supabase credentials not configured" },
				{ status: 500 },
			);
		}

		// Use Supabase SQL API (available on project URL)
		const response = await fetch(`${SUPABASE_URL}/sql`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_SERVICE_KEY,
				Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
			},
			body: JSON.stringify({
				query: MIGRATION_SQL,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Supabase SQL API error:", errorText);
			return NextResponse.json(
				{ error: `Migration failed: ${errorText}` },
				{ status: 500 },
			);
		}

		const result = await response.json();

		return NextResponse.json({
			success: true,
			message: "Migration completed successfully!",
			result,
		});
	} catch (error: any) {
		console.error("Migration error:", error);
		return NextResponse.json(
			{ error: error.message || "Migration failed" },
			{ status: 500 },
		);
	}
}
