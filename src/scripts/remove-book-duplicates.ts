import { createClient } from "@supabase/supabase-js";
import {
	normalizeBookText,
	removeBookDuplicates,
} from "../lib/book-deduplication-service";
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
	if (typeof window !== "undefined" && (window as Record<string, unknown>).setStatsUpdateReport) {
		try {
			((window as Record<string, unknown>).setStatsUpdateReport as (msg: string) => void)(`${consoleMessage}\n`);
		} catch (error) {
			console.error(
				"❌ Ошибка при отправке сообщения в окно результатов:",
				error,
			);
		}
	}
}

async function runRemoveDuplicates() {
	logMessage("Запуск процесса удаления дубликатов книг...", "info");

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

		// Группируем книги по автору и названию для поиска дубликатов
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

		// Находим группы с более чем одной книгой (дубликаты)
		const duplicateGroups = Array.from(booksByAuthorTitle.entries())
			.filter(([_, books]) => books.length > 1)
			.map(([_key, books]) => ({
				author: books[0].author,
				title: books[0].title,
				books,
			}));

		logMessage(`Найдено ${duplicateGroups.length} групп дубликатов книг:`);

		if (duplicateGroups.length === 0) {
			logMessage("Дубликатов не найдено, завершение работы", "success");
			return;
		}

		// Подтверждение перед удалением
		logMessage("ВНИМАНИЕ: Начнется процесс удаления дубликатов!", "warning");
		logMessage(
			"Будет оставлена по одной книге из каждой группы (новейшая)",
			"info",
		);
		logMessage(
			`Всего будет удалено дубликатов: ${duplicateGroups.reduce((sum, group) => sum + (group.books.length - 1), 0)}`,
			"info",
		);

		const confirmation = process.argv[2];
		if (confirmation !== "--confirm") {
			logMessage(
				"Процесс остановлен. Для подтверждения удаления используйте:",
				"error",
			);
			logMessage("   npx tsx remove-book-duplicates.ts --confirm", "error");
			return;
		}

		logMessage("Начинаем процесс удаления дубликатов...", "info");

		let totalDeleted = 0;
		let totalErrors = 0;

		for (const group of duplicateGroups) {
			logMessage(`Обработка группы: "${group.author}" - "${group.title}"`);
			logMessage(`  Найдено книг: ${group.books.length}`);

			// Выполняем удаление дубликатов в группе
			const result = await removeBookDuplicates(group.books);

			logMessage(`  ${result.message}`);

			totalDeleted += result.deletedCount;
			if (result.message.includes("ошибок:")) {
				const errorMatch = result.message.match(/ошибок: (\d+)/);
				if (errorMatch) {
					totalErrors += parseInt(errorMatch[1], 10);
				}
			}
		}

		logMessage(`Удаление дубликатов завершено!`, "success");
		logMessage(`Всего удалено: ${totalDeleted} книг`, "success");
		if (totalErrors > 0) {
			logMessage(`Ошибок: ${totalErrors}`, "error");
		}
	} catch (error) {
		logMessage(
			`Ошибка при выполнении удаления дубликатов: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
			"error",
		);
		throw error;
	}
}

// Запускаем процесс удаления дубликатов
runRemoveDuplicates()
	.then(() => {
		logMessage("Процесс удаления дубликатов завершен", "success");
	})
	.catch((error) => {
		logMessage(
			`Процесс удаления дубликатов завершен с ошибкой: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
			"error",
		);
	});
