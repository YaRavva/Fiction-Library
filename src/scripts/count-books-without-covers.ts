import { resolve } from "node:path";
import { config } from "dotenv";
import { getSupabaseAdmin } from "../lib/supabase";

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, "../../.env");
config({ path: envPath });

async function countBooksWithoutCovers() {
	try {
		console.log("🔍 Подсчитываем книги без обложек...");
		const supabase = getSupabaseAdmin();

		if (!supabase) {
			console.error("❌ Не удалось создать клиент Supabase");
			return;
		}

		// @ts-expect-error
		const { data: booksWithoutCovers, error } = await supabase
			.from("books")
			.select("author, title, cover_url, telegram_post_id")
			.is("cover_url", null)
			.limit(50);

		if (error) {
			console.error("❌ Ошибка получения книг:", error.message);
			return;
		}

		console.log(`📊 Книг без обложек: ${booksWithoutCovers?.length || 0}`);

		// Выводим список книг без обложек
		if (booksWithoutCovers && booksWithoutCovers.length > 0) {
			console.log("\n📚 Книги без обложек:");
			// @ts-expect-error
			booksWithoutCovers.forEach((book: any, index: number) => {
				console.log(
					`${index + 1}. ${book.author || "Без автора"} - ${book.title || "Без названия"}`,
				);
				console.log(`   Telegram ID: ${book.telegram_post_id || "Нет"}`);
			});
		}
	} catch (error) {
		console.error("❌ Ошибка:", error);
	}
}

// Запускаем подсчет
countBooksWithoutCovers();
