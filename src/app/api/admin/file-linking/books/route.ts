import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { serverSupabase } from "@/lib/serverSupabase";

/**
 * GET /api/admin/file-linking/books
 * Get books without files
 */
export async function GET(request: Request) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const { data: books, error } = await serverSupabase
			.from("books")
			.select("id, title, author, telegram_post_id")
			.is("file_url", null)
			.not("title", "is", null)
			.not("author", "is", null)
			.order("title");

		if (error) {
			throw new Error(`Failed to fetch books: ${error.message}`);
		}

		return NextResponse.json({ books: books || [] });
	} catch (error: any) {
		console.error("Error fetching books without files:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to fetch books" },
			{ status: 500 },
		);
	}
}
