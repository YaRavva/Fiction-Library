import { NextResponse } from "next/server";

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";
const PROJECT_REF = "yobwiopkewzyrabwzzgo";

const MIGRATION_SQL = `
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS books_embedding_idx 
    ON books 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 4. Create match_books function for vector search
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
`;

/**
 * POST /api/admin/migrate-pgvector
 * Run pgvector migration via Supabase Management API
 */
export async function POST() {
    try {
        if (!SUPABASE_ACCESS_TOKEN) {
            return NextResponse.json(
                { error: "SUPABASE_ACCESS_TOKEN not configured" },
                { status: 500 }
            );
        }

        // Use Supabase Management API to run SQL
        const response = await fetch(
            `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                },
                body: JSON.stringify({
                    query: MIGRATION_SQL,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Supabase Management API error:", errorText);
            return NextResponse.json(
                { error: `Migration failed: ${errorText}` },
                { status: 500 }
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
            { status: 500 }
        );
    }
}
