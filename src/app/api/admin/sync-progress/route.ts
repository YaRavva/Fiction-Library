import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";

/**
 * GET /api/admin/sync-progress
 * Получает статистику прогресса синхронизации
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		// Получаем статистику синхронизации
		const stats: {
			totalBooks?: number;
			processedBooks?: number;
			unprocessedBooks?: number;
			recentUnprocessed?: {
				id: string;
				title: string;
				author: string;
				created_at: string;
			}[];
			processedMessages?: number;
			completionPercentage?: number;
		} = {};

		// Получаем общее количество книг в БД
		const { count: totalBooks, error: countError } = await auth.admin
			.from("books")
			.select("*", { count: "exact", head: true });

		if (countError) {
			throw new Error(
				`Ошибка получения общего количества книг: ${countError.message}`,
			);
		}
		stats.totalBooks = totalBooks || 0;

		// Получаем количество обработанных книг
		const { count: processedBooks, error: processedError } = await auth.admin
			.from("books")
			.select("*", { count: "exact", head: true })
			.eq("metadata_processed", true);

		if (processedError) {
			throw new Error(
				`Ошибка получения количества обработанных книг: ${processedError.message}`,
			);
		}
		stats.processedBooks = processedBooks || 0;

		// Получаем количество необработанных книг
		const { count: unprocessedBooks, error: unprocessedError } =
			await auth.admin
				.from("books")
				.select("*", { count: "exact", head: true })
				.eq("metadata_processed", false);

		if (unprocessedError) {
			throw new Error(
				`Ошибка получения количества необработанных книг: ${unprocessedError.message}`,
			);
		}
		stats.unprocessedBooks = unprocessedBooks || 0;

		// Получаем список последних необработанных книг
		const { data: recentUnprocessed, error: recentError } = await auth.admin
			.from("books")
			.select("id, title, author, created_at")
			.eq("metadata_processed", false)
			.order("created_at", { ascending: false })
			.limit(5);

		if (recentError) {
			throw new Error(
				`Ошибка получения списка необработанных книг: ${recentError.message}`,
			);
		}
		stats.recentUnprocessed = recentUnprocessed || [];

		// Получаем статистику по обработанным сообщениям
		const { count: processedMessages, error: messagesError } = await auth.admin
			.from("telegram_processed_messages")
			.select("*", { count: "exact", head: true });

		if (messagesError) {
			throw new Error(
				`Ошибка получения количества обработанных сообщений: ${messagesError.message}`,
			);
		}
		stats.processedMessages = processedMessages || 0;

		// Вычисляем процент завершения
		stats.completionPercentage =
			totalBooks && processedBooks
				? Math.round((processedBooks / totalBooks) * 100)
				: 0;

		return NextResponse.json({
			message: "Sync progress retrieved successfully",
			stats,
		});
	} catch (error) {
		console.error("Sync progress error:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
