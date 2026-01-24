import { resolve } from "node:path";
import { config } from "dotenv";

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, "../../.env") });

interface Book {
	title: string;
	author: string;
	description?: string;
	publication_year?: number;
	file_format?: string;
	genres?: string[];
	tags?: string[];
}

async function supabaseInsertExample() {
	console.log("Пример вставки данных в Supabase в проекте Fiction Library");

	try {
		// Проверяем наличие необходимых переменных окружения
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!supabaseUrl || !supabaseServiceKey) {
			console.error("❌ Отсутствуют необходимые переменные окружения Supabase");
			return;
		}

		console.log("✅ Переменные окружения найдены");

		// Импортируем Supabase клиент
		const { createClient } = await import("@supabase/supabase-js");
		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Пример данных для вставки
		const newBook: Book = {
			title: "Война и мир",
			author: "Лев Толстой",
			description:
				"Роман-эпопея, описывающий события Отечественной войны 1812 года",
			publication_year: 1969,
			file_format: "fb2",
			genres: ["классика", "роман", "исторический"],
			tags: ["война", "XIX век", "Россия"],
		};

		// Вставка новой книги в базу данных
		console.log("\n➕ Пример: Вставка новой книги...");
		const { data, error } = await supabase
			.from("books")
			.insert(newBook)
			.select("id, title, author")
			.single();

		if (error) {
			console.error("❌ Ошибка при вставке книги:", error.message);
			// Проверим, возможно книга уже существует
			if (error.code === "23505") {
				console.log("ℹ️  Книга с такими данными уже существует в базе");
			}
		} else {
			console.log(`✅ Книга успешно добавлена:`);
			console.log(`  ID: ${data.id}`);
			console.log(`  Название: "${data.title}"`);
			console.log(`  Автор: ${data.author}`);
		}

		// Пример обновления данных
		console.log("\n🔄 Пример: Обновление данных книги...");
		if (data?.id) {
			const { data: updatedData, error: updateError } = await supabase
				.from("books")
				.update({
					downloads_count: 1,
					views_count: 5,
				})
				.eq("id", data.id)
				.select("id, title, downloads_count, views_count")
				.single();

			if (updateError) {
				console.error("❌ Ошибка при обновлении книги:", updateError.message);
			} else {
				console.log(`✅ Книга успешно обновлена:`);
				console.log(`  Название: "${updatedData.title}"`);
				console.log(`  Количество загрузок: ${updatedData.downloads_count}`);
				console.log(`  Количество просмотров: ${updatedData.views_count}`);
			}
		}

		console.log("\n✅ Все примеры вставки/обновления выполнены успешно!");
	} catch (error) {
		console.error("❌ Ошибка в примере вставки данных в Supabase:", error);
	}
}

supabaseInsertExample().catch(console.error);
