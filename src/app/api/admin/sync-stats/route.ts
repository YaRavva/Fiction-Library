import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		console.log("📥 Получен запрос на получение статистики синхронизации");

		// Создаем клиент Supabase с правами администратора
		const supabase = getSupabaseAdmin();

		if (!supabase) {
			throw new Error(
				"Не удалось создать клиент Supabase с правами администратора",
			);
		}

		// Получаем общее количество сообщений в Telegram (примерное значение)
		const telegramTotal = 995;

		// Получаем общее количество книг в базе данных
		const { count: databaseTotal, error: countError } = await supabase
			.from("books")
			.select("*", { count: "exact", head: true });

		if (countError) {
			throw new Error(
				`Ошибка получения количества книг: ${countError.message}`,
			);
		}

		// Получаем количество обработанных сообщений
		const { count: processedMessages, error: processedError } = await supabase
			.from("telegram_processed_messages")
			.select("*", { count: "exact", head: true });

		if (processedError) {
			throw new Error(
				`Ошибка получения количества обработанных сообщений: ${processedError.message}`,
			);
		}

		// Получаем количество книг без файлов
		const { count: missingFiles, error: filesError } = await supabase
			.from("books")
			.select("*", { count: "exact", head: true })
			.is("file_url", null);

		if (filesError) {
			throw new Error(
				`Ошибка получения количества книг без файлов: ${filesError.message}`,
			);
		}

		const stats = {
			telegramTotal,
			databaseTotal: databaseTotal || 0,
			missingBooks: telegramTotal - (databaseTotal || 0),
			missingFiles: missingFiles || 0,
			processedBooks: processedMessages || 0,
			remainingBooks: telegramTotal - (processedMessages || 0),
		};

		console.log("✅ Статистика синхронизации получена:", stats);

		return NextResponse.json({
			success: true,
			stats,
		});
	} catch (error) {
		console.error("❌ Ошибка получения статистики синхронизации:", error);
		return NextResponse.json(
			{
				success: false,
				message:
					error instanceof Error
						? error.message
						: "Неизвестная ошибка получения статистики",
			},
			{ status: 500 },
		);
	}
}
