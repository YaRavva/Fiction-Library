import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * GET /api/admin/sync-progress
 * Получает статистику прогресса синхронизации
 */
export async function GET(request: NextRequest) {
	try {
		// Проверяем авторизацию
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Получаем токен из заголовка
		const token = authHeader.replace("Bearer ", "");

		// Проверяем пользователя через Supabase
		const {
			data: { user },
			error: authError,
		} = await supabaseAdmin.auth.getUser(token);

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Проверяем, что пользователь - админ
		const { data: profile, error: profileError } = await supabaseAdmin
			.from("user_profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (profileError || profile?.role !== "admin") {
			return NextResponse.json(
				{ error: "Forbidden: Admin access required" },
				{ status: 403 },
			);
		}

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
		const { count: totalBooks, error: countError } = await supabaseAdmin
			.from("books")
			.select("*", { count: "exact", head: true });

		if (countError) {
			throw new Error(
				`Ошибка получения общего количества книг: ${countError.message}`,
			);
		}
		stats.totalBooks = totalBooks || 0;

		// Получаем количество обработанных книг
		const { count: processedBooks, error: processedError } = await supabaseAdmin
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
			await supabaseAdmin
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
		const { data: recentUnprocessed, error: recentError } = await supabaseAdmin
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
		const { count: processedMessages, error: messagesError } =
			await supabaseAdmin
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
