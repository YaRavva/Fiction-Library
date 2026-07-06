import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

/**
 * GET /api/admin/embedding/stats
 * Get embedding statistics
 */
export async function GET() {
    try {
        // Count total books
        const { count: total, error: totalError } = await serverSupabase
            .from("books")
            .select("*", { count: "exact", head: true })
            .not("title", "is", null)
            .not("author", "is", null);

        if (totalError) {
            throw new Error(`Failed to count books: ${totalError.message}`);
        }

        // Count books with embeddings
        const { count: embedded, error: embeddedError } = await serverSupabase
            .from("books")
            .select("*", { count: "exact", head: true })
            .not("embedding", "is", null);

        if (embeddedError) {
            throw new Error(`Failed to count embedded books: ${embeddedError.message}`);
        }

        return NextResponse.json({
            stats: {
                total: total || 0,
                embedded: embedded || 0,
                pending: (total || 0) - (embedded || 0),
            },
        });
    } catch (error: any) {
        console.error("Error fetching embedding stats:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
