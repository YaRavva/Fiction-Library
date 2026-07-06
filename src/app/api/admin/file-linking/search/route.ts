import { NextRequest, NextResponse } from "next/server";
import { scoreFileToBook, type FileOption, type BookOption } from "@/lib/book-file-scorer";
import { serverSupabase } from "@/lib/serverSupabase";

/**
 * POST /api/admin/file-linking/search
 * Search for file matches for a book
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, author, limit = 5 } = body;

        if (!title || !author) {
            return NextResponse.json(
                { error: "title and author are required" },
                { status: 400 }
            );
        }

        // Get all files from telegram_files
        const { data: files, error: filesError } = await serverSupabase
            .from("telegram_files")
            .select("message_id, file_name, mime_type, file_size")
            .order("message_id", { ascending: false })
            .limit(2000);

        if (filesError) {
            throw new Error(`Failed to fetch files: ${filesError.message}`);
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ matches: [] });
        }

        // Create BookOption
        const bookOption: BookOption = {
            id: "temp",
            title,
            author,
        };

        // Score each file
        const scoredFiles = files
            .map((file) => {
                const fileOption: FileOption = {
                    message_id: file.message_id,
                    file_name: file.file_name,
                    mime_type: file.mime_type,
                    file_size: file.file_size,
                };

                const result = scoreFileToBook(fileOption, bookOption);

                return {
                    message_id: file.message_id,
                    filename: file.file_name,
                    score: result.score,
                    matchedWords: result.matchedWords,
                    titleMatchCount: result.titleMatchCount,
                    authorMatch: result.authorMatch,
                    fileAuthorParsed: result.fileAuthorParsed,
                    fileTitleParsed: result.fileTitleParsed,
                };
            })
            .filter((f) => f.score >= 40) // Lower threshold for manual review
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return NextResponse.json({ matches: scoredFiles });
    } catch (error: any) {
        console.error("Error searching file matches:", error);
        return NextResponse.json(
            { error: error.message || "Failed to search matches" },
            { status: 500 }
        );
    }
}
