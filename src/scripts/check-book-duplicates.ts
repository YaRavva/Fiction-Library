import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Функция нормализации текста для сравнения
function normalizeText(text: string): string {
	if (!text) return "";

	// Применяем Unicode нормализацию для устранения различий в представлении символов
	let normalized = text.normalize("NFKC");

	// Приводим к нижнему регистру
	normalized = normalized.toLowerCase();

	// Удаляем эмодзи
	normalized = normalized.replace(
		/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
		"",
	);

	// Удаляем годы в скобках (в формате (2023), (2019) и т.д.) и любые другие числа в скобках
	normalized = normalized.replace(/\(\d{4}\)/g, "");

	// Удаляем текст "ru", "ru", "en" и другие языковые обозначения
	normalized = normalized.replace(/\b[rRyYоOuUeEaAnN]\s*[uU]\b/g, "");

	// Удаляем любые другие символы в скобках, кроме чисел (для обработки скобок с годами издания)
	normalized = normalized.replace(/\((?!\d{4}\))[^)]+\)/g, "");

	// Удаляем лишние пробелы
	normalized = normalized.trim().replace(/\s+/g, " ");

	return normalized;
}

async function checkBookDuplicates() {
	console.log("🔍 Начинаем проверку дубликатов книг...");

	// Проверяем наличие необходимых переменных окружения
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		console.error(
			"❌ Необходимо установить переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY",
		);
		console.log(
			"ℹ️  Добавьте в файл .env значения для NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY",
		);
		return;
	}

	try {
		// Создаем клиент Supabase с сервисной ролью
		const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
			auth: {
				persistSession: false,
			},
		});

		// Получаем все книги из базы данных (без ограничения по количеству)
		console.log("📥 Получаем все книги из базы данных...");
		const allBooks = [];
		let lastCreatedAt = null;
		const batchSize = 1000; // Получаем по 1000 записей за раз

		while (true) {
			let query = supabase
				.from("books")
				.select("id, title, author, created_at")
				.order("created_at", { ascending: true })
				.limit(batchSize);

			if (lastCreatedAt) {
				query = query.gt("created_at", lastCreatedAt);
			}

			const { data: batch, error } = await query;

			if (error) {
				throw new Error(`Ошибка при получении книг: ${error.message}`);
			}

			if (!batch || batch.length === 0) {
				break;
			}

			allBooks.push(...batch);
			lastCreatedAt = batch[batch.length - 1].created_at;

			console.log(
				`  → Получено ${batch.length} книг, всего: ${allBooks.length}`,
			);

			// Если получено меньше batch size, значит это последняя страница
			if (batch.length < batchSize) {
				break;
			}

			// Небольшая пауза между запросами, чтобы не перегружать сервер
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		console.log(`✅ Всего получено книг: ${allBooks.length}`);

		const duplicateGroups = allBooks;

		if (!duplicateGroups || duplicateGroups.length === 0) {
			console.log("⚠️ В базе данных нет книг для проверки");
			return;
		}

		// Группируем книги по автору и названию, используя нормализованные значения
		const booksByAuthorTitle = new Map<string, typeof duplicateGroups>();

		for (const book of duplicateGroups) {
			// Пропускаем книги с пустыми названиями или авторами
			if (!book.title || !book.author) {
				continue;
			}
			const normalizedAuthor = normalizeText(book.author);
			const normalizedTitle = normalizeText(book.title);
			const key = `${normalizedAuthor}|${normalizedTitle}`;
			if (!booksByAuthorTitle.has(key)) {
				booksByAuthorTitle.set(key, []);
			}
			booksByAuthorTitle.get(key)?.push(book);
		}

		// Находим группы с более чем одной книгой (дубликаты)
		const duplicateGroupsList = Array.from(booksByAuthorTitle.entries())
			.filter(([_, books]) => books.length > 1)
			.map(([_key, books]) => ({
				author: books[0].author,
				title: books[0].title,
				books,
			}));

		console.log(
			`\n📊 Найдено ${duplicateGroupsList.length} групп потенциальных дубликатов книг:`,
		);

		// Отображаем результаты
		for (const group of duplicateGroupsList) {
			console.log(`\n📖 Автор: "${group.author}", Название: "${group.title}"`);
			console.log(`  Количество книг в группе: ${group.books.length}`);

			for (const book of group.books) {
				console.log(`    - ${book.author} - ${book.title}`);
			}
		}

		// Также выполним проверку с помощью SQL-запроса для нахождения точных дубликатов
		console.log("\n🔍 Выполняем альтернативную проверку дубликатов...");

		// Проверяем дубликаты, используя функцию окна
		const { data: allBooksSql, error: fetchError } = await supabase
			.from("books")
			.select("id, title, author");

		if (fetchError) {
			console.error("Ошибка получения книг для SQL-анализа:", fetchError);
		} else if (allBooksSql) {
			// Группируем локально для нахождения дубликатов, используя нормализованные значения
			const booksGrouped = new Map<string, typeof allBooksSql>();

			for (const book of allBooksSql) {
				if (!book.title || !book.author) {
					continue;
				}
				const normalizedAuthor = normalizeText(book.author);
				const normalizedTitle = normalizeText(book.title);
				const key = `${normalizedAuthor}|${normalizedTitle}`;
				if (!booksGrouped.has(key)) {
					booksGrouped.set(key, []);
				}
				booksGrouped.get(key)?.push(book);
			}

			const exactDuplicates = Array.from(booksGrouped.entries())
				.filter(([_, books]) => books.length > 1)
				.flatMap(([_, books]) => books);

			if (exactDuplicates.length > 0) {
				console.log(
					`\n📊 Найдено ${exactDuplicates.length} потенциально дублирующихся книг:`,
				);
				const groupedExact = new Map<string, typeof exactDuplicates>();

				for (const book of exactDuplicates) {
					if (!book.title || !book.author) {
						continue;
					}
					const normalizedAuthor = normalizeText(book.author);
					const normalizedTitle = normalizeText(book.title);
					const key = `${normalizedAuthor}|${normalizedTitle}`;
					if (!groupedExact.has(key)) {
						groupedExact.set(key, []);
					}
					groupedExact.get(key)?.push(book);
				}

				for (const [key, books] of groupedExact.entries()) {
					const [author, title] = key.split("|");
					console.log(
						`\n📖 Автор: "${author}", Название: "${title}" (${books.length} дубликатов)`,
					);
					for (const book of books) {
						console.log(`    - ${book.author} - ${book.title}`);
					}
				}
			} else {
				console.log("\n✅ Точных дубликатов не найдено");
			}

			// Подсчет альтернативных дубликатов
			const alternativeDuplicateGroups = Array.from(
				booksGrouped.entries(),
			).filter(([_, books]) => books.length > 1);

			console.log(
				`\n📊 Альтернативная проверка: ${alternativeDuplicateGroups.length} групп потенциальных дубликатов (${exactDuplicates.length} книг)`,
			);
		}

		// Подсчитываем общее количество дублирующихся книг
		const totalDuplicateBooks1 = duplicateGroupsList.reduce(
			(sum, group) => sum + group.books.length,
			0,
		);
		const totalDuplicateBooks2 = Array.from(booksByAuthorTitle.entries())
			.filter(([_, books]) => books.length > 1)
			.reduce((sum, [_, books]) => sum + books.length, 0);

		console.log(`\n📊 Сводка:`);
		console.log(
			`  - Основная проверка: ${duplicateGroupsList.length} групп дубликатов (${totalDuplicateBooks1} книг)`,
		);
		console.log(
			`  - Альтернативная проверка: ${Array.from(booksByAuthorTitle.entries()).filter(([_, books]) => books.length > 1).length} групп дубликатов (${totalDuplicateBooks2} книг)`,
		);
		console.log(`  - Всего дублирующихся книг: ${totalDuplicateBooks1}`);
	} catch (error) {
		console.error("❌ Ошибка при проверке дубликатов книг:", error);
		throw error;
	}
}

// Выполняем проверку
checkBookDuplicates()
	.then(() => {
		console.log("\n✅ Проверка дубликатов завершена");
	})
	.catch((error) => {
		console.error("\n❌ Проверка дубликатов завершена с ошибкой:", error);
	});
