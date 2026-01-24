import { taskManager } from "./task-manager";
import { TelegramSyncService } from "./telegram/sync";

/**
 * Фоновый обработчик для синхронизации метаданных
 */
export class BackgroundSyncHandler {
	/**
	 * Запускает фоновую синхронизацию метаданных
	 * @param taskId ID задачи
	 * @param limit Количество сообщений для синхронизации
	 */
	static async startSync(taskId: string, limit: number = 10): Promise<void> {
		try {
			// Обновляем статус задачи
			taskManager.updateTaskStatus(
				taskId,
				"running",
				"📥 Получение сообщений для синхронизации...",
			);

			// Получаем экземпляр сервиса синхронизации
			const syncService = await TelegramSyncService.getInstance();

			// Начинаем синхронизацию метаданных
			console.log(`🚀 Начинаем синхронизацию метаданных (лимит: ${limit})`);

			// Для отслеживания истории обработанных сообщений
			let processedMessagesHistory = "";
			let addedCount = 0;
			let updatedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;
			let processedCount = 0;

			taskManager.updateTaskProgress(
				taskId,
				0,
				"📥 Начинаем синхронизацию метаданных...",
			);

			// Выполняем синхронизацию
			const results = await syncService.syncBooks(limit);

			// Обрабатываем результаты
			for (const detail of results.details) {
				processedCount++;
				const progress = Math.round(
					(processedCount / results.details.length) * 100,
				);

				// Извлекаем информацию о книге из деталей
				const typedDetail = detail as {
					bookTitle?: string;
					bookAuthor?: string;
					bookId?: string;
					msgId?: string;
					status: string;
					reason?: string;
					error?: string;
				};

				const bookInfo =
					typedDetail.bookTitle && typedDetail.bookAuthor
						? `${typedDetail.bookAuthor} - ${typedDetail.bookTitle}`
						: typedDetail.bookId || "неизвестная книга";

				switch (typedDetail.status) {
					case "added":
						addedCount++;
						processedMessagesHistory += `${processedMessagesHistory ? "\n" : ""}✅ Добавлена книга: ${bookInfo} (сообщение ${typedDetail.msgId})`;
						break;
					case "updated":
						updatedCount++;
						processedMessagesHistory += `${processedMessagesHistory ? "\n" : ""}🔄 Обновлена книга: ${bookInfo} (сообщение ${typedDetail.msgId})`;
						break;
					case "skipped": {
						skippedCount++;
						const reason = typedDetail.reason || "неизвестная причина";
						// Переводим причины на русский
						let russianReason = reason;
						switch (reason) {
							case "existing book has better description":
								russianReason = "у существующей книги лучшее описание";
								break;
							case "existing book has genres":
								russianReason = "у существующей книги есть жанры";
								break;
							case "existing book has tags":
								russianReason = "у существующей книги есть теги";
								break;
							case "existing book has cover":
								russianReason = "у существующей книги есть обложка";
								break;
							case "existing book has telegram post id":
								russianReason = "у существующей книги есть ID сообщения";
								break;
							case "book already exists in database":
								russianReason = "книга уже существует в базе данных";
								break;
							case "book already exists":
								russianReason = "книга уже существует в базе данных";
								break;
							case "missing title or author":
								russianReason = "отсутствует название или автор";
								break;
							case "no text content":
								russianReason = "сообщение без текста";
								break;
							case "metadata complete":
								russianReason = "метаданные полные";
								break;
						}
						processedMessagesHistory += `${processedMessagesHistory ? "\n" : ""}⚠️ Пропущено: ${bookInfo} (сообщение ${typedDetail.msgId}, ${russianReason})`;
						break;
					}
					case "error": {
						errorCount++;
						const error = typedDetail.error || "неизвестная ошибка";
						processedMessagesHistory += `${processedMessagesHistory ? "\n" : ""}❌ Ошибка: ${bookInfo} (сообщение ${typedDetail.msgId}, ${error})`;
						break;
					}
				}

				// Отправляем промежуточный результат
				const statusMessage = `${processedMessagesHistory}\n📊 Прогресс: Добавлено: ${addedCount} | Обновлено: ${updatedCount} | Пропущено: ${skippedCount} | Ошибок: ${errorCount} | Всего: ${processedCount}/${results.details.length}`;
				taskManager.updateTaskProgress(taskId, progress, statusMessage, detail);
			}

			// Финальный прогресс
			const finalMessage = `${processedMessagesHistory}\n🏁 Завершено: Добавлено: ${addedCount} | Обновлено: ${updatedCount} | Пропущено: ${skippedCount} | Ошибок: ${errorCount} | Всего: ${results.details.length}`;
			taskManager.updateTaskStatus(taskId, "completed", finalMessage);
			taskManager.updateTaskProgress(taskId, 100, finalMessage, {
				addedCount,
				updatedCount,
				skippedCount,
				errorCount,
				totalCount: results.details.length,
				results,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Неизвестная ошибка синхронизации";
			taskManager.updateTaskStatus(
				taskId,
				"failed",
				`❌ Ошибка: ${errorMessage}`,
			);
			taskManager.updateTaskProgress(taskId, 100, `❌ Ошибка: ${errorMessage}`);
		}
	}
}
