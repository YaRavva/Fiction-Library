import { createClient } from "@supabase/supabase-js";
import { normalizeBookText } from "../lib/book-deduplication-service";
import "dotenv/config";

// Функция для форматированного вывода в консоль и в окно результатов (если доступно)
function logMessage(
	message: string,
	type: "info" | "success" | "warning" | "error" = "info",
) {
	// Выводим в консоль
	const timestamp = new Date().toLocaleTimeString("ru-RU");
	let consoleMessage = `[${timestamp}] `;

	switch (type) {
		case "success":
			consoleMessage += `✅ ${message}`;
			break;
		case "warning":
			consoleMessage += `⚠️ ${message}`;
			break;
		case "error":
			consoleMessage += `❌ ${message}`;
			break;
		default:
			consoleMessage += `🔍 ${message}`;
	}

	console.log(consoleMessage);

	// Если скрипт запускается в контексте админки, отправляем в окно результатов
	if (typeof window !== "undefined" && (window as any).setStatsUpdateReport) {
		try {
			(window as any).setStatsUpdateReport(`${consoleMessage}\n`);
		} catch (error) {
			console.error(
				"❌ Ошибка при отправке сообщения в окно результатов:",
				error,
			);
		}
	}
}

async function runDeduplication() {
	logMessage("Запуск процесса дедупликации книг...");

	// Проверяем наличие необходимых переменных окружения
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		logMessage(
			"Необходимо установить переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY",
			"error",
		);
		return;
	}

	// Создаем клиент Supabase с сервисной ролью
	const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: {
			persistSession: false,
		},
	});

	try {
		// Получаем все книги из базы данных с постраничной загрузкой (аналогично check-book-duplicates.ts)
		logMessage("Получение всех книг из базы данных...");
		const allBooks = [];
		let lastCreatedAt = null;
		const batchSize = 1000; // Получаем по 1000 записей за раз

		while (true) {
			let query = supabase
				.from("books")
				.select("*")
				.order("created_at", { ascending: false }) // Сортируем по дате создания, новые первыми
				.limit(batchSize);

			if (lastCreatedAt) {
				query = query.lt("created_at", lastCreatedAt); // Получаем книги, созданные раньше lastCreatedAt
			}

			const { data: batch, error } = await query;

			if (error) {
				throw new Error(`Ошибка при получении книг: ${error.message}`);
			}

			if (!batch || batch.length === 0) {
				break;
			}

			allBooks.push(...batch);
			lastCreatedAt = batch[batch.length - 1].created_at; // Берем самую раннюю дату из текущей партии

			logMessage(
				`Получено ${batch.length} книг, всего: ${allBooks.length}`,
				"info",
			);

			// Если получено меньше batch size, значит это последняя страница
			if (batch.length < batchSize) {
				break;
			}

			// Небольшая пауза между запросами, чтобы не перегружать сервер
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		if (allBooks.length === 0) {
			logMessage("В базе данных нет книг для проверки", "warning");
			return;
		}

		logMessage(`Всего получено книг: ${allBooks.length}`, "success");

		// Группируем книги по автору и названию для поиска потенциальных дубликатов
		const booksByAuthorTitle = new Map<string, typeof allBooks>();

		for (const book of allBooks) {
			// Пропускаем книги с пустыми названиями или авторами
			if (!book.title || !book.author) {
				continue;
			}
			const normalizedAuthor = normalizeBookText(book.author);
			const normalizedTitle = normalizeBookText(book.title);
			const key = `${normalizedAuthor}|${normalizedTitle}`;

			if (!booksByAuthorTitle.has(key)) {
				booksByAuthorTitle.set(key, []);
			}
			booksByAuthorTitle.get(key)?.push(book);
		}

		// Находим группы с более чем одной книгой (потенциальные дубликаты)
		const duplicateGroups = Array.from(booksByAuthorTitle.entries())
			.filter(([_, books]) => books.length > 1)
			.map(([_key, books]) => ({
				author: books[0].author,
				title: books[0].title,
				books,
			}));

		logMessage(
			`Найдено ${duplicateGroups.length} групп потенциальных дубликатов книг:`,
		);

		let totalDuplicatesFound = 0;
		for (const group of duplicateGroups) {
			logMessage(`Автор: "${group.author}", Название: "${group.title}"`);
			logMessage(`  Количество книг в группе: ${group.books.length}`);
			totalDuplicatesFound += group.books.length - 1; // Исключаем одну оставшуюся книгу

			// Показываем информацию о каждой книге в группе
			for (let i = 0; i < group.books.length; i++) {
				const book = group.books[i];
				logMessage(
					`    ${i + 1}. ID: ${book.id}, Дата создания: ${book.created_at}, Файл: ${book.file_url ? "ДА" : "НЕТ"}`,
				);
			}
		}

		if (duplicateGroups.length === 0) {
			logMessage("Дубликатов не найдено", "success");
			return;
		}

		logMessage(`Всего найдено дубликатов: ${totalDuplicatesFound}`, "success");

		// Предлагаем пользователю запустить процесс удаления
		logMessage(
			"Хотите запустить процесс удаления дубликатов? (оставляя по одной книге из каждой группы, новейшую) [y/N]:",
			"info",
		);

		// В целях безопасности в этом скрипте мы не будем автоматически удалять
		// Пользователь должен запустить отдельный скрипт для выполнения удаления
		logMessage(
			"Для выполнения удаления дубликатов запустите скрипт с подтверждением.",
			"info",
		);
		logMessage("Рекомендуемый процесс:", "info");
		logMessage("   1. Просмотрите найденные дубликаты выше", "info");
		logMessage("   2. При необходимости внесите корректировки вручную", "info");
		logMessage(
			"   3. Запустите отдельный процесс удаления при необходимости",
			"info",
		);

		// Выводим статистику
		logMessage("Сводка:", "info");
		logMessage(`  - Всего книг в базе: ${allBooks.length}`, "info");
		logMessage(`  - Групп дубликатов: ${duplicateGroups.length}`, "info");
		logMessage(`  - Найдено дубликатов: ${totalDuplicatesFound}`, "info");
		logMessage(
			`  - Оценка уникальных книг: ${allBooks.length - totalDuplicatesFound}`,
			"info",
		);
	} catch (error) {
		logMessage(
			`Ошибка при выполнении дедупликации: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
			"error",
		);
		throw error;
	}
}

// Запускаем процесс дедупликации
runDeduplication()
	.then(() => {
		logMessage("Проверка дедупликации завершена", "success");
	})
	.catch((error) => {
		logMessage(
			`Проверка дедупликации завершена с ошибкой: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
			"error",
		);
	});
