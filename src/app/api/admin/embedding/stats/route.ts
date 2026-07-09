import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";

function isMissingColumnError(
	error: { message?: string; code?: string } | null,
) {
	return (
		error?.code === "42703" ||
		(error?.message?.toLowerCase().includes("column") &&
			error.message.toLowerCase().includes("embedding") &&
			error.message.toLowerCase().includes("does not exist"))
	);
}

export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;
		let booksEmbeddingReady = true;
		let filesEmbeddingReady = true;

		const { count: totalBooks, error: totalBooksError } = await auth.admin
			.from("books")
			.select("*", { count: "exact", head: true })
			.not("title", "is", null)
			.not("author", "is", null);

		if (totalBooksError) {
			throw new Error(`Failed to count books: ${totalBooksError.message}`);
		}

		const { count: embeddedBooks, error: embeddedBooksError } = await auth.admin
			.from("books")
			.select("*", { count: "exact", head: true })
			.not("embedding", "is", null);

		if (embeddedBooksError) {
			if (isMissingColumnError(embeddedBooksError)) {
				booksEmbeddingReady = false;
			} else {
				throw new Error(
					`Failed to count embedded books: ${embeddedBooksError.message}`,
				);
			}
		}

		const { count: totalFiles, error: totalFilesError } = await auth.admin
			.from("telegram_files")
			.select("*", { count: "exact", head: true })
			.is("duplicate_of_message_id", null)
			.not("file_name", "is", null);

		if (totalFilesError) {
			throw new Error(`Failed to count files: ${totalFilesError.message}`);
		}

		const { count: embeddedFiles, error: embeddedFilesError } = await auth.admin
			.from("telegram_files")
			.select("*", { count: "exact", head: true })
			.is("duplicate_of_message_id", null)
			.not("embedding", "is", null);

		if (embeddedFilesError) {
			if (isMissingColumnError(embeddedFilesError)) {
				filesEmbeddingReady = false;
			} else {
				throw new Error(
					`Failed to count embedded files: ${embeddedFilesError.message}`,
				);
			}
		}

		return NextResponse.json({
			stats: {
				books: {
					total: totalBooks || 0,
					embedded: booksEmbeddingReady ? embeddedBooks || 0 : 0,
					pending: booksEmbeddingReady
						? (totalBooks || 0) - (embeddedBooks || 0)
						: totalBooks || 0,
				},
				files: {
					total: totalFiles || 0,
					embedded: filesEmbeddingReady ? embeddedFiles || 0 : 0,
					pending: filesEmbeddingReady
						? (totalFiles || 0) - (embeddedFiles || 0)
						: totalFiles || 0,
				},
				schema: {
					booksEmbeddingReady,
					filesEmbeddingReady,
					migrationRequired: !booksEmbeddingReady || !filesEmbeddingReady,
				},
			},
		});
	} catch (error: unknown) {
		console.error("Error fetching embedding stats:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Failed to fetch stats",
			},
			{ status: 500 },
		);
	}
}
