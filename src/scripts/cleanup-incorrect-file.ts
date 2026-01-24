import dotenv from "dotenv";
import { serverSupabase } from "../lib/serverSupabase";

dotenv.config();

async function cleanupIncorrectFile() {
	try {
		console.log("🚀 Начинаем очистку неправильного файла...");

		// Ищем книгу с неправильным URL
		const supabase: any = serverSupabase;
		const { data: book, error } = await supabase
			.from("books")
			.select("*")
			.eq("title", "цикл Мицелий")
			.single();

		if (error) {
			console.error("❌ Ошибка при поиске книги:", error);
			return;
		}

		if (!book) {
			console.log("⚠️ Книга не найдена");
			return;
		}

		const anyBook = book as any;
		console.log(`✅ Найдена книга: "${anyBook.title}" (ID: ${anyBook.id})`);
		console.log(`  Текущий URL файла: ${anyBook.file_url}`);
		console.log(`  Текущий путь в хранилище: ${anyBook.storage_path}`);
		console.log(`  Telegram ID файла: ${anyBook.telegram_file_id}`);

		// Проверяем, что URL файла использует неправильный формат
		if (anyBook.file_url?.includes("/books/") && anyBook.telegram_file_id) {
			console.log("⚠️ Обнаружен файл с неправильным форматом имени");

			// Очищаем привязку файла в базе данных поэтапно
			console.log("🗑️ Очищаем привязку файла в базе данных...");

			// Обновляем file_url
			const { error: updateError1 } = await supabase
				.from("books")
				.update({
					file_url: null,
				})
				.eq("id", anyBook.id);

			if (updateError1) {
				console.error("❌ Ошибка при очистке file_url:", updateError1);
				return;
			}

			// Обновляем file_size
			const { error: updateError2 } = await supabase
				.from("books")
				.update({
					file_size: null,
				})
				.eq("id", anyBook.id);

			if (updateError2) {
				console.error("❌ Ошибка при очистке file_size:", updateError2);
				return;
			}

			// Обновляем file_format
			const { error: updateError3 } = await supabase
				.from("books")
				.update({
					file_format: null,
				})
				.eq("id", anyBook.id);

			if (updateError3) {
				console.error("❌ Ошибка при очистке file_format:", updateError3);
				return;
			}

			// Обновляем telegram_file_id
			const { error: updateError4 } = await supabase
				.from("books")
				.update({
					telegram_file_id: null,
				})
				.eq("id", anyBook.id);

			if (updateError4) {
				console.error("❌ Ошибка при очистке telegram_file_id:", updateError4);
				return;
			}

			// Обновляем downloads_count
			const { error: updateError6 } = await supabase
				.from("books")
				.update({
					downloads_count: null,
				})
				.eq("id", anyBook.id);

			if (updateError6) {
				console.error("❌ Ошибка при очистке downloads_count:", updateError6);
				return;
			}

			// Обновляем updated_at
			const { error: updateError7 } = await supabase
				.from("books")
				.update({
					updated_at: new Date().toISOString(),
				})
				.eq("id", anyBook.id);

			if (updateError7) {
				console.error("❌ Ошибка при обновлении updated_at:", updateError7);
				return;
			}

			console.log("✅ Привязка файла успешно очищена в базе данных");
		} else {
			console.log("✅ Файл уже использует правильный формат имени");
		}
	} catch (error) {
		console.error("❌ Ошибка в скрипте очистки:", error);
	}
}

cleanupIncorrectFile();
