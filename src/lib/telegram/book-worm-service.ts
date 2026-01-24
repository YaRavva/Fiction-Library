import {
	checkForBookDuplicates,
	normalizeBookText,
} from "../book-deduplication-service";
import { FileBookMatcherService } from "../file-book-matcher-service";
import { putObject } from "../s3-service";
import { serverSupabase } from "../serverSupabase";
import { TelegramService } from "./client";
import { EnhancedFileProcessingService } from "./file-processing-service-enhanced";
import { TelegramFileService } from "./file-service";
import { TelegramMetadataService } from "./metadata-service";
import { type BookMetadata, MetadataParser } from "./parser";

interface Book {
	id: string;
	title: string;
	author: string;
	telegram_post_id: number | null;
	file_url?: string | null;
	telegram_file_id?: string | null;
}

export class BookWormService {
	private static instance: BookWormService;
	private telegramService: TelegramService | null = null;
	private metadataService: TelegramMetadataService | null = null;
	private fileService: TelegramFileService | null = null;
	private enhancedFileService: EnhancedFileProcessingService | null = null;

	private constructor() {}

	public static async getInstance(): Promise<BookWormService> {
		if (!BookWormService.instance) {
			BookWormService.instance = new BookWormService();
			await BookWormService.instance.initialize();
		}
		return BookWormService.instance;
	}

	private async initialize() {
		this.telegramService = await TelegramService.getInstance();
		this.metadataService = await TelegramMetadataService.getInstance();
		this.fileService = await TelegramFileService.getInstance();
		this.enhancedFileService =
			await EnhancedFileProcessingService.getInstance();
	}

	/**
	 * Запускает процесс BookWorm для обработки новых сообщений
	 */
	public async startBookWorm(): Promise<void> {
		console.log("🚀 Запуск BookWorm сервиса...");
		try {
			// Загружаем файлы для сопоставления
			console.log("📥 Загрузка файлов из Telegram...");
			if (!this.fileService) throw new Error("FileService not initialized");
			const allFilesToProcess = await this.fileService.getFilesToProcess(2000); // Загружаем 2000 файлов
			console.log(
				`📊 Загружено ${allFilesToProcess.length} файлов для сопоставления`,
			);

			// Получаем все книги, которые уже есть в базе данных
			console.log("📚 Загрузка книг из базы данных...");
			const { data: books, error: booksError } = await serverSupabase
				.from("books")
				.select(
					"id, title, author, telegram_post_id, file_url, telegram_file_id",
				)
				.not("title", "is", null)
				.not("author", "is", null);

			if (booksError) {
				throw new Error(`Ошибка при загрузке книг: ${booksError.message}`);
			}

			if (!books || books.length === 0) {
				console.log("⚠️  В базе данных нет книг для сопоставления");
				return;
			}

			console.log(`✅ Загружено ${books.length} книг для сопоставления`);

			// Для каждой книги ищем соответствующий файл
			let processedCount = 0;
			let matchedCount = 0;

			for (const book of books) {
				processedCount++;
				console.log(`
📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${books.length})`);

				// Проверяем, есть ли уже файл для этой книги
				if (book.file_url || book.telegram_file_id) {
					console.log(`  ✅ У книги уже есть файл, пропускаем`);
					continue;
				}

				// Ищем соответствующий файл для книги
				const matchingFile = await this.findMatchingFile(
					book,
					allFilesToProcess,
				);

				if (matchingFile) {
					console.log(
						`    📨 Найден соответствующий файл: ${matchingFile.filename}`,
					);
					console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);

					try {
						// Обрабатываем найденный файл
						const _result =
							await this.enhancedFileService?.processSingleFileById(
								parseInt(matchingFile.messageId as string, 10),
							);
						console.log(`    ✅ Файл успешно обработан и привязан к книге`);
						matchedCount++;
					} catch (processError) {
						console.error(`    ❌ Ошибка обработки файла:`, processError);
					}
				} else {
					console.log(`  ⚠️  Соответствующий файл не найден`);
				}
			}

			console.log(`
🏁 BookWorm завершен. Обработано: ${processedCount}, найдено совпадений: ${matchedCount}`);
		} catch (error) {
			console.error("❌ Ошибка в BookWorm сервисе:", error);
			throw error;
		}
	}

	/**
	 * Находит соответствующий файл для книги с использованием универсального алгоритма релевантного поиска
	 */
	private async findMatchingFile(
		book: Book,
		files: any[],
	): Promise<any | null> {
		// Проверяем, что у книги есть название и автор
		if (
			!book.title ||
			!book.author ||
			book.title.trim() === "" ||
			book.author.trim() === ""
		) {
			console.log(`    ️  Книга не имеет названия или автора, пропускаем`);
			return null;
		}

		console.log(
			`    🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`,
		);

		// Преобразуем файлы для сопоставления
		const filesForMatching = files.map((file: any) => ({
			message_id: file.messageId || file.message_id || 0,
			file_name: file.filename || "",
			mime_type: file.mime_type || "unknown",
			file_size: file.file_size || file.size || undefined,
		}));

		// Используем универсальный сервис для сопоставления
		const matches = FileBookMatcherService.findBestMatchesForBook(
			{ id: book.id, title: book.title, author: book.author },
			filesForMatching,
		);

		if (matches.length > 0) {
			// Берем лучшее совпадение (оно уже отсортировано по убыванию релевантности)
			const bestMatch = matches[0];

			// Найдем соответствующий файл из исходного списка
			const sourceFile = files.find(
				(file: any) =>
					(file.messageId && file.messageId === bestMatch.file.message_id) ||
					(file.message_id && file.message_id === bestMatch.file.message_id),
			);

			if (sourceFile && bestMatch.score >= 60) {
				// Используем тот же порог, что и в универсальном сервисе
				console.log(
					`    ✅ Найдено совпадение с рейтингом ${bestMatch.score}: ${sourceFile.filename}`,
				);
				console.log(`📊 Ранжирование совпадений:`);
				for (let i = 0; i < Math.min(3, matches.length); i++) {
					const match = matches[i];
					const matchSourceFile = files.find(
						(file: any) =>
							(file.messageId && file.messageId === match.file.message_id) ||
							(file.message_id && file.message_id === match.file.message_id),
					);
					if (matchSourceFile) {
						console.log(
							`    ${i + 1}. "${book.title}" автора ${book.author} (счет: ${match.score})`,
						);
					}
				}

				return sourceFile;
			} else if (sourceFile) {
				console.log(
					`    ⚠️  Найдено совпадение, но оценка ниже порога (${bestMatch.score} < 65): ${sourceFile.filename}`,
				);
			}
		}

		console.log(
			`    ⚠️  Совпадения не найдены или совпадение недостаточно точное`,
		);
		return null;
	}

	/**
	 * Загружает метаданные из Telegram канала
	 */
	/**
	 * Загружает метаданные из Telegram канала
	 * @param fullSync Если true, выполняет полную синхронизацию без ограничений
	 */
	public async loadMetadataFromTelegram(
		fullSync: boolean = false,
	): Promise<void> {
		console.log("📥 Загрузка метаданных из Telegram...");
		try {
			if (!this.telegramService || !this.metadataService) {
				throw new Error(
					"TelegramService или MetadataService не инициализированы",
				);
			}

			// Получаем канал с метаданными
			const channel = await this.telegramService.getMetadataChannel();
			console.log(
				`✅ Подключено к каналу: ${channel.title || channel.username}`,
			);

			// Инициализируем загрузку метаданных
			const limit = fullSync ? 5000 : 1000; // Для полной синхронизации больше лимит
			const { processed, added, updated, errors } =
				await this.metadataService.syncBooks(limit);

			console.log(`
📊 Результаты загрузки:`);
			console.log(`  Обработано сообщений: ${processed}`);
			console.log(`  Добавлено книг: ${added}`);
			console.log(`  Обновлено книг: ${updated}`);
			console.log(`  Ошибок: ${errors}`);
		} catch (error) {
			console.error("❌ Ошибка при загрузке метаданных:", error);
			throw error;
		}
	}

	/**
	 * Загружает файлы из Telegram и сопоставляет их с книгами
	 */
	public async loadAndMatchFiles(): Promise<void> {
		console.log("📥 Загрузка и сопоставление файлов из Telegram...");
		try {
			if (!this.fileService) {
				throw new Error("FileService не инициализирован");
			}

			// Загружаем все файлы из Telegram
			console.log("📁 Получение списка файлов из Telegram...");
			const files = await this.fileService.getFilesToProcess(2000); // Загружаем 2000 файлов
			console.log(`✅ Получено ${files.length} файлов`);

			// Получаем книги без файлов
			const { data: booksWithoutFiles, error: booksError } =
				await serverSupabase
					.from("books")
					.select("id, title, author")
					.is("file_url", null)
					.not("title", "is", null)
					.not("author", "is", null);

			if (booksError) {
				throw new Error(
					`Ошибка при загрузке книг без файлов: ${booksError.message}`,
				);
			}

			console.log(
				`📚 Найдено ${booksWithoutFiles?.length || 0} книг без файлов`,
			);

			if (
				booksWithoutFiles &&
				booksWithoutFiles.length > 0 &&
				files.length > 0
			) {
				// Для каждой книги ищем соответствующий файл
				for (const book of booksWithoutFiles) {
					console.log(`
📖 Поиск файла для: "${book.title}" автора ${book.author}`);

					const matchingFile = await this.findMatchingFile(book, files);
					if (matchingFile) {
						console.log(`  ✅ Найден файл: ${matchingFile.filename}`);
						// Здесь можно добавить логику для загрузки и связывания файла с книгой
					} else {
						console.log(`  ❌ Файл не найден`);
					}
				}
			} else {
				console.log("Нет книг без файлов или файлов для сопоставления");
			}
		} catch (error) {
			console.error("❌ Ошибка при загрузке и сопоставлении файлов:", error);
			throw error;
		}
	}

	/**
	 * Запускает синхронизацию обновления книг (режим update)
	 */
	public async runUpdateSync(): Promise<any> {
		console.log("🔄 Запуск синхронизации обновления книг...");

		try {
			// Проверяем, что сервисы инициализированы
			if (!this.fileService || !this.metadataService || !this.telegramService) {
				throw new Error(
					"Необходимые сервисы не инициализированы. Убедитесь, что BookWormService создан через getInstance().",
				);
			}

			// 1. Получаем ID последнего обработанного сообщения
			console.log("🔍 Получаем ID последнего обработанного сообщения...");
			const { data: lastProcessed } = await serverSupabase
				.from("telegram_processed_messages")
				.select("message_id")
				.not("message_id", "is", null)
				.order("message_id", { ascending: false })
				.limit(1)
				.single();

			let lastMessageId: number | undefined;
			if (lastProcessed && (lastProcessed as any).message_id) {
				lastMessageId = parseInt((lastProcessed as any).message_id, 10);
				console.log(`  📌 Последнее обработанное сообщение: ${lastMessageId}`);
			} else {
				console.log(
					"  🆕 Синхронизация с начала, нет предыдущих обработанных сообщений",
				);
			}

			// Получаем канал с метаданными
			const channel = await this.telegramService.getMetadataChannel();
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);

			// Получаем новые сообщения используя minId для эффективности
			// reverse: true означает получение от старых к новым (что важно для хронологии, но minId обычно лучше работает)
			// minId исключает само сообщение с minId
			console.log(
				`📥 Получаем новые сообщения из канала (после ID ${lastMessageId || 0})...`,
			);

			const newMessages = (await this.telegramService.getMessages(
				channelId,
				200, // Лимит на пакет
				undefined, // offsetId не используем, так как используем minId
				{
					minId: lastMessageId,
					reverse: true, // Сортировка от старых к новым
				},
			)) as any[]; // Type assertion for compatibility

			if (newMessages.length === 0) {
				console.log(
					"  ℹ️  Нет новых сообщений для обработки. Завершаем синхронизацию.",
				);
				return {
					processed: 0,
					added: 0,
					updated: 0,
					matched: 0,
					message: `Синхронизация обновления завершена. Нет новых сообщений. Последний ID: ${lastMessageId}`,
				};
			}

			console.log(
				`✅ Получено ${newMessages.length} новых сообщений для обработки`,
			);

			// Импортируем новые сообщения как метаданные книг
			console.log("💾 Обработка сообщений и подготовка метаданных...");

			// Параллельная обработка сообщений чанками (по 5 одновременно)
			const messageChunks = this.chunkArray(newMessages, 5);
			const metadataList: BookMetadata[] = [];
			const details: unknown[] = [];
			const detailedLogs: string[] = []; // Collect logs here

			let processedCount = 0;
			for (const chunk of messageChunks) {
				// Запускаем параллельную обработку чанка
				const results = await Promise.all(
					chunk.map((msg) => this.processSingleMessage(msg)),
				);

				// Собираем результаты
				for (const res of results) {
					if (res.metadata) {
						metadataList.push(res.metadata);
					}
					if (res.details) {
						details.push(res.details);
					}
					if (res.log) {
						detailedLogs.push(res.log);
					}
				}

				processedCount += chunk.length;
				console.log(
					`  ⏳ Обработано ${processedCount}/${newMessages.length} сообщений...`,
				);
			}

			console.log(
				`📊 Всего подготовлено метаданных для импорта: ${metadataList.length}`,
			);

			// Импортируем все метаданные с дедупликацией (Batch Insert/Update)
			console.log("💾 Импортируем метаданные в базу данных...");
			const resultImport =
				await this.metadataService.importMetadataWithDeduplication(
					metadataList,
				);

			console.log("✅ Импорт новых метаданных завершен");

			// Объединяем details и статистику
			const combinedDetails = [...details, ...resultImport.details];
			const totalSkipped =
				resultImport.skipped +
				details.filter((d) => (d as any).status === "skipped").length;

			// Выводим сводку
			console.log("\n📊 СВОДКА СИНХРОНИЗАЦИИ:");
			console.log(`   ========================================`);
			console.log(`   Обработано сообщений: ${newMessages.length}`);
			console.log(`   Добавлено книг: ${resultImport.added}`);
			console.log(`   Обновлено книг: ${resultImport.updated}`);
			console.log(`   Пропущено: ${totalSkipped}`);
			console.log(`   Ошибок: ${resultImport.errors}`);

			return {
				processed:
					resultImport.processed + newMessages.length - metadataList.length, // Total processed messages
				added: resultImport.added,
				updated: resultImport.updated,
				skipped: totalSkipped,
				errors: resultImport.errors,
				details: combinedDetails,
				matched: 0, // Files logic separated or handled implicitly later
				lastProcessedMessageId: lastMessageId,
				message: `Sync completed. Added: ${resultImport.added}, Updated: ${resultImport.updated}, Processed: ${newMessages.length}`,
				detailedLogs: detailedLogs.sort((a, b) => {
					// Sort logs by ID if they start with [ID:...]
					const idA = parseInt(a.match(/\[ID:(\d+)\]/)?.[1] || "0");
					const idB = parseInt(b.match(/\[ID:(\d+)\]/)?.[1] || "0");
					return idA - idB;
				}),
			};
		} catch (error) {
			console.error("❌ Ошибка в синхронизации обновления:", error);
			throw error;
		}
	}

	private chunkArray<T>(array: T[], size: number): T[][] {
		const chunked: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunked.push(array.slice(i, i + size));
		}
		return chunked;
	}

	private async processSingleMessage(msg: any): Promise<{
		metadata?: BookMetadata;
		details?: any;
		log?: string;
	}> {
		const anyMsg = msg as unknown as { [key: string]: unknown };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const msgText = (msg as { text?: string }).text;

		// Пропускаем сообщения без текста
		if (!msgText) {
			// Маркируем как обработанное
			await this.markMessageAsProcessed(String(anyMsg.id));
			return {
				details: {
					msgId: anyMsg.id,
					status: "skipped",
					reason: "no text content",
				},
				log: `⚪ [ID:${anyMsg.id}] Пропущено (нет текста)`,
			};
		}

		// Парсим текст сообщения
		const metadata = MetadataParser.parseMessage(msgText);
		metadata.messageId = anyMsg.id as number;

		// Пропускаем неполные метаданные
		if (!metadata.title || !metadata.author) {
			await this.markMessageAsProcessed(String(anyMsg.id));
			return {
				details: {
					msgId: anyMsg.id,
					status: "skipped",
					reason: "missing title or author",
				},
				log: `⚪ [ID:${anyMsg.id}] Пропущено (неполные метаданные)`,
			};
		}

		// Проверяем дубликаты
		try {
			const duplicateCheck = await checkForBookDuplicates(
				metadata.title,
				metadata.author,
				normalizeBookText,
			);

			if (
				duplicateCheck.exists &&
				duplicateCheck.books &&
				duplicateCheck.books.length > 0
			) {
				const existingBook = duplicateCheck.books[0];
				// Книга уже есть - маркируем сообщение как обработанное и пропускаем
				await this.markMessageAsProcessed(String(anyMsg.id), existingBook.id);
				return {
					details: {
						msgId: anyMsg.id,
						status: "skipped",
						reason: "book already exists",
						bookId: existingBook.id,
					},
					log: `🟡 [ID:${anyMsg.id}] Уже существует: "${metadata.title}" - ${metadata.author}`,
				};
			}
		} catch (err) {
			console.warn(`Error checking duplicate for ${metadata.title}:`, err);
		}

		// Загружаем обложки (параллельно это происходит для разных сообщений благодаря Promise.all в runUpdateSync)
		const coverUrls: string[] = [];
		if (anyMsg.media) {
			try {
				const coverUrl = await this.downloadCover(msg);
				if (coverUrl) {
					coverUrls.push(coverUrl);
				}
			} catch (e) {
				console.warn(`Failed to download cover for msg ${anyMsg.id}:`, e);
			}
		}

		return {
			metadata: {
				...metadata,
				coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || [],
			},
			log: `🟢 [ID:${anyMsg.id}] Новая книга: "${metadata.title}" - ${metadata.author}${coverUrls.length > 0 ? " (с обложкой)" : ""}`,
		};
	}

	private async markMessageAsProcessed(
		messageId: string,
		bookId?: string,
	): Promise<void> {
		const processedData = {
			message_id: messageId,
			channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || "",
			processed_at: new Date().toISOString(),
			book_id: bookId || null,
		};

		const { error } = await serverSupabase
			.from("telegram_processed_messages")
			.upsert(processedData, { onConflict: "message_id" });

		if (error) {
			console.warn(`Error marking message ${messageId} as processed:`, error);
		}
	}

	private async downloadCover(msg: any): Promise<string | null> {
		if (!this.telegramService) return null;

		// Логика загрузки с повторами и таймаутом
		// (упрощенная версия, чтобы не дублировать огромный блок)
		try {
			const result = await Promise.race([
				this.telegramService.downloadMedia(msg),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
			]);

			if (!result || !(result instanceof Buffer)) return null;

			const anyMsg = msg as { id: number };
			const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
			const coversBucket = process.env.S3_COVERS_BUCKET_NAME;

			if (!coversBucket) return null;

			await putObject(photoKey, Buffer.from(result), coversBucket);
			return `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
		} catch (e) {
			return null; // Silent fail for cover
		}
	}

	/**
	 * Запускает полную синхронизацию книг (режим full)
	 */
	public async runFullSync(): Promise<any> {
		console.log("🔄 Запуск полной синхронизации книг...");

		try {
			// Проверяем, что сервисы инициализированы
			if (!this.fileService || !this.metadataService || !this.telegramService) {
				throw new Error(
					"Необходимые сервисы не инициализированы. Убедитесь, что BookWormService создан через getInstance().",
				);
			}

			// 1. Индексируем все сообщения из канала с метаданными для полной проверки
			console.log("📥 Индексация всех сообщений из канала с метаданными...");
			const detailedLogs: string[] = [];
			const onLog = (msg: string) => detailedLogs.push(msg);

			const indexResult = await this.metadataService.indexAllMessages(
				10000,
				onLog,
			); // Увеличиваем размер пакета для более эффективной загрузки

			// 2. Загружаем все сообщения из канала с файлами (все 4249 батчами по 1000)
			console.log("📥 Загрузка всех файлов из Telegram...");
			const allFilesToProcess = [];
			let offsetIdFiles: number | undefined;
			let hasMoreFiles = true;
			let fileBatchIndex = 0;

			while (hasMoreFiles) {
				fileBatchIndex++;
				console.log(
					`📥 Получаем батч файлов ${fileBatchIndex} из Telegram (лимит: 1000)...`,
				);
				const filesBatch = await this.fileService.getFilesToProcess(
					1000,
					offsetIdFiles,
				);

				if (filesBatch.length === 0) {
					console.log("  📌 Больше нет файлов для загрузки");
					break;
				}

				console.log(
					`  ✅ Получено ${filesBatch.length} файлов в батче ${fileBatchIndex}`,
				);
				allFilesToProcess.push(...filesBatch);

				// Устанавливаем offsetIdFiles для следующего батча
				if (filesBatch.length < 1000) {
					hasMoreFiles = false;
				} else {
					// Берем минимальный ID из текущего батча для следующей итерации
					const messageIds = filesBatch
						.map((item) => parseInt(String(item.messageId), 10))
						.filter((id) => !Number.isNaN(id) && id > 0);

					if (messageIds.length > 0) {
						offsetIdFiles = Math.min(...messageIds) - 1;
					} else {
						hasMoreFiles = false;
					}
				}
			}

			console.log(`📊 Всего загружено файлов: ${allFilesToProcess.length}`);

			// 3. Находим все книги в БД без файлов и запускаем универсальный алгоритм привязки файлов
			console.log("📚 Поиск книг без файлов в базе данных...");
			const { data: booksWithoutFiles, error: booksError } =
				await serverSupabase
					.from("books")
					.select(
						"id, title, author, telegram_post_id, file_url, telegram_file_id",
					)
					.is("file_url", null) // Только книги без файлов
					.not("title", "is", null)
					.not("author", "is", null);

			if (booksError) {
				throw new Error(
					`Ошибка при загрузке книг без файлов: ${booksError.message}`,
				);
			}

			if (!booksWithoutFiles || booksWithoutFiles.length === 0) {
				console.log("⚠️  Нет книг без файлов для сопоставления");
				return {
					processed: indexResult.indexed,
					added: 0,
					updated: 0,
					matched: 0,
					message: `Full sync completed. Indexed ${indexResult.indexed} messages, no books without files found for file matching.`,
				};
			}

			console.log(
				`✅ Найдено ${booksWithoutFiles.length} книг без файлов для сопоставления`,
			);

			// Для каждой книги без файла ищем соответствующий файл
			let processedCount = 0;
			let matchedCount = 0;

			for (const book of booksWithoutFiles) {
				processedCount++;
				console.log(`
📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${booksWithoutFiles.length})`);

				// Ищем соответствующий файл для книги, используя универсальный алгоритм
				const matchingFile = await this.findMatchingFile(
					book,
					allFilesToProcess,
				);

				if (matchingFile) {
					console.log(
						`    📨 Найден соответствующий файл: ${matchingFile.filename}`,
					);
					console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);

					try {
						// Обрабатываем найденный файл
						const _result =
							await this.enhancedFileService?.processSingleFileById(
								parseInt(matchingFile.messageId as string, 10),
							);
						console.log(`    ✅ Файл успешно обработан и привязан к книге`);
						matchedCount++;
					} catch (processError) {
						console.error(`    ❌ Ошибка обработки файла:`, processError);
					}
				} else {
					console.log(`  ⚠️  Соответствующий файл не найден`);
				}
			}

			console.log(`
🏁 Полная синхронизация завершена.`);

			return {
				processed: indexResult.indexed,
				added: 0, // В режиме full мы не добавляем книги, а индексируем сообщения
				updated: 0, // В режиме full мы не обновляем книги, а индексируем сообщения
				matched: matchedCount,
				message: `Full sync completed. Indexed ${indexResult.indexed} messages, matched ${matchedCount} files.`,
				detailedLogs: detailedLogs,
			};
		} catch (error) {
			console.error("❌ Ошибка в полной синхронизации:", error);
			throw error;
		}
	}

	public async shutdown(): Promise<void> {
		console.log("🛑 Завершение BookWorm сервиса...");

		if (this.telegramService) {
			await this.telegramService.disconnect();
		}

		console.log("✅ BookWorm сервис завершен");
	}
}
