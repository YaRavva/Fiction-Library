import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { serverSupabase } from "@/lib/serverSupabase";
import { EnhancedFileProcessingService } from "@/lib/telegram/file-processing-service-enhanced";

/**
 * POST /api/admin/file-linking/link
 * Link a file to a book
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const body = await request.json();
		const { bookId, messageId } = body;

		if (!bookId || !messageId) {
			return NextResponse.json(
				{ error: "bookId and messageId are required" },
				{ status: 400 },
			);
		}

		// Verify book exists
		const { data: book, error: bookError } = await serverSupabase
			.from("books")
			.select("id, title, author")
			.eq("id", bookId)
			.single();

		if (bookError || !book) {
			return NextResponse.json({ error: "Book not found" }, { status: 404 });
		}

		const telegramFileId = String(parseInt(String(messageId), 10));
		const { data: alreadyLinkedBook, error: linkedBookError } =
			await serverSupabase
				.from("books")
				.select("id, title, author")
				.eq("telegram_file_id", telegramFileId)
				.neq("id", bookId)
				.maybeSingle();

		if (linkedBookError) {
			throw new Error(
				`Failed to check existing file link: ${linkedBookError.message}`,
			);
		}

		if (alreadyLinkedBook) {
			return NextResponse.json(
				{
					error: "File is already linked to another book",
					linkedBook: alreadyLinkedBook,
				},
				{ status: 409 },
			);
		}

		const service = await EnhancedFileProcessingService.getInstance();
		const result = await service.processSingleFileById(
			Number(telegramFileId),
			bookId,
		);

		if (result.error) {
			return NextResponse.json({ error: result.error }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			bookId,
			messageId,
			result,
		});
	} catch (error: any) {
		console.error("Error linking file:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to link file" },
			{ status: 500 },
		);
	}
}
