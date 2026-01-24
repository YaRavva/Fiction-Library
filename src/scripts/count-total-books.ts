import { resolve } from "node:path";
import { config } from "dotenv";
import { getSupabaseAdmin } from "../lib/supabase";

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, "../../.env");
config({ path: envPath });

async function countTotalBooks() {
	try {
		console.log("🔍 Подсчитываем общее количество книг...");
		const supabase = getSupabaseAdmin();

		if (!supabase) {
			console.error("❌ Не удалось создать клиент Supabase");
			return;
		}

		// @ts-expect-error
		const { count, error } = await supabase
			.from("books")
			.select("*", { count: "exact", head: true });

		if (error) {
			console.error("❌ Ошибка подсчета книг:", error.message);
			return;
		}

		console.log(`📚 Всего книг: ${count}`);

		// Подсчитаем книги без автора или названия
		// @ts-expect-error
		const { count: emptyMetadataCount, error: emptyMetadataError } =
			await supabase
				.from("books")
				.select("*", { count: "exact", head: true })
				.or("author.is.null,title.is.null");

		if (emptyMetadataError) {
			console.error(
				"❌ Ошибка подсчета книг без метаданных:",
				emptyMetadataError.message,
			);
			return;
		}

		console.log(`📄 Книг без автора или названия: ${emptyMetadataCount}`);
		console.log(
			`📊 Процент книг без метаданных: ${(((emptyMetadataCount || 0) / (count || 1)) * 100).toFixed(2)}%`,
		);
	} catch (error) {
		console.error("❌ Ошибка:", error);
	}
}

// Запускаем подсчет
countTotalBooks();
