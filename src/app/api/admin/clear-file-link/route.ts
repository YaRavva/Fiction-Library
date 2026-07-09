import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import type { Database } from "@/lib/database.types";

/**
 * POST /api/admin/clear-file-link
 * Очищает привязку файла к книге
 *
 * Body:
 * - bookId: string (ID книги)
 */
export async function POST(request: NextRequest) {
	try {
		const authResult = await requireAdminRequest(request);
		if ("error" in authResult) return authResult.error;
		const auth = authResult as {
			admin: SupabaseClient<Database>;
			user: { id: string };
		};

		// Получаем параметры из body
		const body = await request.json();
		const { bookId } = body;

		if (!bookId) {
			return NextResponse.json(
				{ error: "bookId is required" },
				{ status: 400 },
			);
		}

		// Проверяем, что книга существует
		const { data: book, error: bookError } = (await auth.admin
			.from("books")
			.select("*")
			.eq("id", bookId)
			.single()) as {
			data: Database["public"]["Tables"]["books"]["Row"] | null;
			error: any;
		};

		if (bookError || !book) {
			return NextResponse.json({ error: "Book not found" }, { status: 404 });
		}

		console.log(
			`🧹 Начинаем очистку привязки файла для книги "${book.title}"...`,
		);

		try {
			// Очищаем привязку файла к книге
			const { data: _data, error } = await (auth.admin as any)
				.from("books")
				.update({
					file_url: null,
					file_size: null,
					file_format: null,
					telegram_file_id: null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", bookId)
				.select()
				.single();

			if (error) {
				throw new Error(`Ошибка обновления книги: ${error.message}`);
			}

			console.log(
				`✅ Привязка файла успешно очищена для книги "${book.title}"`,
			);

			return NextResponse.json({
				success: true,
				message: `Привязка файла успешно очищена для книги "${book.title}"`,
			});
		} catch (clearError) {
			console.error("Error clearing file link:", clearError);
			return NextResponse.json(
				{
					error: "Failed to clear file link for book",
					details: (clearError as Error).message,
				},
				{ status: 500 },
			);
		}
	} catch (error) {
		console.error("Error in clear-file-link API:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
