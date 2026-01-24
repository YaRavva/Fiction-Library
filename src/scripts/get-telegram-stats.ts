import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface TelegramStats {
	id: string;
	books_in_database: number;
	books_in_telegram: number;
	missing_books: number;
	books_without_files: number;
	updated_at: string;
}

async function getTelegramStats() {
	console.log("📊 Получение статистики Telegram из базы данных...");

	try {
		// Получаем последние сохраненные статистические данные
		const { data: stats, error: statsError } = await supabaseAdmin
			.from("telegram_stats")
			.select("*")
			.order("updated_at", { ascending: false })
			.limit(1)
			.single();

		if (statsError) {
			console.error("❌ Ошибка при получении статистики:", statsError);
			return;
		}

		if (!stats) {
			console.log("⚠️  Статистика не найдена в базе данных");
			return;
		}

		const telegramStats = stats as TelegramStats;

		console.log("\n📈 === СТАТИСТИКА TELEGRAM ===");
		console.log(`🆔 ID: ${telegramStats.id}`);
		console.log(`📚 Книг в базе данных: ${telegramStats.books_in_database}`);
		console.log(`📡 Книг в Telegram: ${telegramStats.books_in_telegram}`);
		console.log(`❌ Отсутствующих книг: ${telegramStats.missing_books}`);
		console.log(`📁 Книг без файлов: ${telegramStats.books_without_files}`);
		console.log(
			`🕒 Последнее обновление: ${new Date(telegramStats.updated_at).toLocaleString()}`,
		);

		// Рассчитываем дополнительные метрики
		if (
			telegramStats.books_in_database > 0 &&
			telegramStats.books_in_telegram > 0
		) {
			const coveragePercent = (
				(telegramStats.books_in_database / telegramStats.books_in_telegram) *
				100
			).toFixed(2);
			console.log(`📊 Покрытие базы данных: ${coveragePercent}%`);
		}

		if (telegramStats.books_in_database > 0) {
			const withoutFilesPercent = (
				(telegramStats.books_without_files / telegramStats.books_in_database) *
				100
			).toFixed(2);
			console.log(`📊 Книг без файлов: ${withoutFilesPercent}%`);
		}

		console.log("\n✅ Статистика успешно получена");
	} catch (error) {
		console.error("❌ Ошибка при получении статистики:", error);
	}
}

// Run the script
getTelegramStats().catch(console.error);
