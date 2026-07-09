import { resolve } from "node:path";
import { config } from "dotenv";
import { getSupabaseAdmin } from "../lib/supabase";

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, "../../.env");
config({ path: envPath });

async function checkRealBooks() {
	try {
		console.log("🔍 Проверяем реальные книги в базе данных...");
		const supabase = getSupabaseAdmin();

		if (!supabase) {
			console.error("❌ Не удалось создать клиент Supabase");
			return;
		}

		// Получаем несколько книг для проверки
		// @ts-expect-error
		const { data: books, error } = await supabase
			.from("books")
			.select("author, title, cover_url, telegram_post_id")
			.limit(5);

		if (error) {
			console.error("❌ Ошибка получения книг:", error.message);
			return;
		}

		console.log(`📚 Найдено ${books?.length || 0} книг:`);
		books?.forEach((book: Record<string, unknown>, index: number) => {
			console.log(`${index + 1}. ${book.author} - ${book.title}`);
			// @ts-expect-error
			console.log(`   Обложка: ${book.cover_url ? "Есть" : "Нет"}`);
			// @ts-expect-error
			console.log(`   Telegram ID: ${book.telegram_post_id || "Нет"}`);
			console.log("");
		});
	} catch (error) {
		console.error("❌ Ошибка:", error);
	}
}

// Запускаем проверку
checkRealBooks();
