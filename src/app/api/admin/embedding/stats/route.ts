import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

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
			throw new Error(
				`Failed to count embedded books: ${embeddedBooksError.message}`,
			);
		}

		const { count: totalFiles, error: totalFilesError } = await auth.admin
			.from("telegram_files")
			.select("*", { count: "exact", head: true })
			.not("file_name", "is", null);

		if (totalFilesError) {
			throw new Error(`Failed to count files: ${totalFilesError.message}`);
		}

		const { count: embeddedFiles, error: embeddedFilesError } = await auth.admin
			.from("telegram_files")
			.select("*", { count: "exact", head: true })
			.not("embedding", "is", null);

		if (embeddedFilesError) {
			throw new Error(
				`Failed to count embedded files: ${embeddedFilesError.message}`,
			);
		}

		return NextResponse.json({
			stats: {
				books: {
					total: totalBooks || 0,
					embedded: embeddedBooks || 0,
					pending: (totalBooks || 0) - (embeddedBooks || 0),
				},
				files: {
					total: totalFiles || 0,
					embedded: embeddedFiles || 0,
					pending: (totalFiles || 0) - (embeddedFiles || 0),
				},
			},
		});
	} catch (error: any) {
		console.error("Error fetching embedding stats:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to fetch stats" },
			{ status: 500 },
		);
	}
}
