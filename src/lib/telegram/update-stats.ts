import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { normalizeBookText } from "../book-deduplication-service";
import { TelegramService } from "./client";
import { MetadataParser } from "./parser";

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface TelegramStats {
	id?: string;
	books_in_database: number;
	books_in_telegram: number;
	missing_books: number;
	books_without_files: number;
	updated_at: string;
}

// Вспомогательная функция для логирования в консоль и в окно результатов
function logToBoth(message: string) {
	console.log(message);

	// Отправляем сообщение в окно результатов, если функция доступна
	if (typeof window !== "undefined" && (window as any).setStatsUpdateReport) {
		try {
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const logMessage = `[${timestamp}] ${message}\n`;
			(window as any).setStatsUpdateReport(logMessage);
		} catch (error) {
			console.warn("❌ Ошибка при отправке лога в окно результатов:", error);
		}
	}
}

// Вспомогательная функция для выполнения асинхронной операции с таймаутом и корректной отменой
function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	timeoutMessage: string,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error(timeoutMessage));
		}, timeoutMs);

		promise
			.then((result) => {
				clearTimeout(timeoutId);
				resolve(result);
			})
			.catch((error) => {
				clearTimeout(timeoutId);
				reject(error);
			});
	});
}

export async function updateTelegramStats(): Promise<TelegramStats | null> {
	logToBoth("📊 Обновление статистики Telegram...");

	try {
		// Получаем количество книг в базе данных
		logToBoth("\n📚 Получение количества книг в базе данных...");
		const { count: booksInDatabase, error: booksCountError } =
			await supabaseAdmin
				.from("books")
				.select("*", { count: "exact", head: true });

		if (booksCountError) {
			logToBoth(`❌ Ошибка при получении количества книг: ${booksCountError}`);
			return null;
		}

		logToBoth(`✅ Книг в базе данных: ${booksInDatabase || 0}`);

		// Получаем количество книг без файлов
		logToBoth("\n📁 Получение количества книг без файлов...");
		const { count: booksWithoutFiles, error: booksWithoutFilesError } =
			await supabaseAdmin
				.from("books")
				.select("*", { count: "exact", head: true })
				.is("file_url", null);

		if (booksWithoutFilesError) {
			logToBoth(
				`❌ Ошибка при получении количества книг без файлов: ${booksWithoutFilesError}`,
			);
			return null;
		}

		logToBoth(`✅ Книг без файлов: ${booksWithoutFiles || 0}`);

		// Получаем количество уникальных книг в Telegram канале
		logToBoth("\n📡 Подсчет уникальных книг в Telegram канале...");
		let booksInTelegram = 0;

		try {
			// Инициализируем Telegram клиент
			const telegramService = await TelegramService.getInstance();

			// Получаем канал с метаданными
			const channel = await telegramService.getMetadataChannel();

			// Convert BigInteger to string for compatibility
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);

			logToBoth(`✅ Подключено к каналу ID: ${channelId}`);

			// Загружаем все сообщения из канала батчами по 10000 для подсчета уникальных книг в Telegram
			let offsetId: number | undefined;
			const batchSize = 10000; // Увеличиваем размер батча до 10000
			const bookSet = new Set<string>(); // Для отслеживания уникальных книг в Telegram
			let processed = 0;
			let batchNumber = 0;

			logToBoth(
				`\n📥 Начало сканирования Telegram канала батчами по ${batchSize} сообщений...`,
			);

			while (true) {
				batchNumber++;
				logToBoth(`📦 Обработка батча ${batchNumber}...`);

				try {
					// Выполняем получение сообщений с таймаутом 60 секунд для больших батчей
					const messagesPromise = telegramService.getMessages(
						channelId,
						batchSize,
						offsetId,
					) as Promise<any[]>;
					const messages = await withTimeout(
						messagesPromise,
						60000,
						"TIMEOUT: getMessages",
					);

					if (!messages || messages.length === 0) {
						logToBoth(`✅ Больше нет сообщений для обработки`);
						break;
					}

					// Обрабатываем каждое сообщение
					for (const message of messages) {
						// Извлекаем текст сообщения
						let messageText = "";
						if (message && typeof message === "object") {
							if (
								"message" in message &&
								message.message &&
								typeof message.message === "string"
							) {
								messageText = message.message;
							} else if (
								"text" in message &&
								message.text &&
								typeof message.text === "string"
							) {
								messageText = message.text;
							}
						}

						if (
							messageText &&
							typeof messageText === "string" &&
							messageText.trim() !== ""
						) {
							try {
								// Пытаемся распарсить сообщение как метаданные книги
								const metadata = MetadataParser.parseMessage(messageText);

								// Проверяем, выглядит ли это как книга (есть автор и название)
								if (metadata.author && metadata.title) {
									const normalizedAuthor = normalizeBookText(metadata.author);
									const normalizedTitle = normalizeBookText(metadata.title);
									const bookKey = `${normalizedAuthor}|${normalizedTitle}`;

									// Добавляем в набор уникальных книг
									if (!bookSet.has(bookKey)) {
										bookSet.add(bookKey);
									}
								}
							} catch (_parseError) {
								// Не сообщение с книгой, пропускаем
							}
						}

						processed++;

						// Показываем прогресс каждые 5000 сообщений
						if (processed % 5000 === 0) {
							logToBoth(
								`📊 Прогресс: ${processed} сообщений обработано, ${bookSet.size} уникальных книг найдено`,
							);
						}
					}

					logToBoth(
						`✅ Обработано ${messages.length} сообщений в батче ${batchNumber}, всего обработано: ${processed}, уникальных книг: ${bookSet.size}`,
					);

					// Устанавливаем offsetId для следующей партии
					const lastMessage = messages[messages.length - 1];
					if (lastMessage?.id) {
						offsetId = lastMessage.id;
					} else {
						logToBoth(
							`✅ Не удалось получить ID последнего сообщения, завершаем сканирование`,
						);
						break;
					}

					// Добавляем задержку, чтобы не перегружать Telegram API
					// Увеличиваем задержку при работе с большими батчами
					await new Promise((resolve) => setTimeout(resolve, 200));
				} catch (batchError) {
					if (
						batchError instanceof Error &&
						batchError.message.includes("TIMEOUT")
					) {
						logToBoth(
							"⏰ Таймаут при получении сообщений, завершаем сканирование...",
						);
						break;
					} else {
						logToBoth(
							`❌ Ошибка при получении пакета сообщений: ${batchError}`,
						);
						break;
					}
				}
			}

			booksInTelegram = bookSet.size;
			logToBoth(`✅ Найдено ${booksInTelegram} уникальных книг в Telegram`);

			// Отключаем Telegram клиент с таймаутом 5 секунд
			if (telegramService && typeof telegramService.disconnect === "function") {
				try {
					// Сохраняем результат в переменную, чтобы избежать потенциальных проблем с асинхронностью
					const disconnectPromise = telegramService.disconnect();
					await withTimeout(disconnectPromise, 5000, "TIMEOUT: disconnect");
					logToBoth("📱 Telegram клиент отключен");
				} catch (disconnectError) {
					if (
						disconnectError instanceof Error &&
						disconnectError.message === "TIMEOUT: disconnect"
					) {
						logToBoth("⚠️ Таймаут при отключении Telegram клиента");
					} else {
						logToBoth(
							`❌ Ошибка при отключении Telegram клиента: ${disconnectError}`,
						);
					}
				}
			}

			// Добавляем небольшую задержку, чтобы позволить внутренним асинхронным операциям завершиться
			// Это может помочь предотвратить появление таймаутов после завершения основного процесса
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Принудительно отключаемся ещё раз, если клиент существует, для полной уверенности
			if (telegramService && typeof telegramService.disconnect === "function") {
				try {
					await telegramService.disconnect();
					logToBoth("📱 Telegram клиент окончательно отключен");
				} catch (finalDisconnectError) {
					logToBoth(
						`⚠️ Ошибка при окончательном отключении: ${finalDisconnectError}`,
					);
				}
			}
		} catch (telegramError) {
			logToBoth(`❌ Ошибка при подсчете книг в Telegram: ${telegramError}`);
			return null;
		}

		// Вычисляем количество отсутствующих книг
		const missingBooks = Math.max(0, booksInTelegram - (booksInDatabase || 0));

		// Сохраняем статистику в базе данных
		logToBoth("\n💾 Сохранение статистики в базе данных...");
		const statsData: TelegramStats = {
			books_in_database: booksInDatabase || 0,
			books_in_telegram: booksInTelegram,
			missing_books: missingBooks,
			books_without_files: booksWithoutFiles || 0,
			updated_at: new Date().toISOString(),
		};

		logToBoth(`Данные для сохранения: ${JSON.stringify(statsData)}`);

		// Обновляем или создаем запись в таблице telegram_stats
		const { error: upsertError } = await supabaseAdmin
			.from("telegram_stats")
			.upsert(statsData, { onConflict: "id" });

		if (upsertError) {
			logToBoth(`❌ Ошибка при сохранении статистики: ${upsertError}`);
			return null;
		}

		logToBoth("✅ Статистика успешно сохранена в базу данных");

		// Выводим итоговые результаты
		logToBoth("\n📈 === ИТОГОВАЯ СТАТИСТИКА ===");
		logToBoth(`📚 Книг в базе данных: ${statsData.books_in_database}`);
		logToBoth(`📡 Книг в Telegram: ${statsData.books_in_telegram}`);
		logToBoth(`❌ Отсутствующих книг: ${statsData.missing_books}`);
		logToBoth(`📁 Книг без файлов: ${statsData.books_without_files}`);
		logToBoth(
			`🕒 Последнее обновление: ${new Date(statsData.updated_at).toLocaleString()}`,
		);

		logToBoth("\n✅ Обновление статистики завершено успешно");

		return statsData;
	} catch (error) {
		logToBoth(`❌ Ошибка при обновлении статистики: ${error}`);
		return null;
	}
}
