import {
	checkForBookDuplicates,
	normalizeBookText,
} from "../book-deduplication-service";
import {
	type BookOption,
	batchMatchFilesToBooks,
	type FileOption,
	findBestFileForBook,
} from "../book-file-scorer";
import { putObject } from "../s3-service";
import { serverSupabase } from "../serverSupabase";
import { TelegramService } from "./client";
import { EnhancedFileProcessingService } from "./file-processing-service-enhanced";
import { TelegramFileService } from "./file-service";
import { TelegramMetadataService } from "./metadata-service";
import { type BookMetadata, MetadataParser } from "./parser";
import { extractExtension } from "./utils";

const db = serverSupabase as any;

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
			const { data: books, error: booksError } = await db
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
	 * Находит соответствующий файл для книги с использованием unified scorer
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

		// Преобразуем файлы в формат FileOption
		const fileOptions: FileOption[] = files.map((file: any) => ({
			message_id: file.messageId || file.message_id || 0,
			file_name: file.filename || "",
			mime_type: file.mime_type || "unknown",
			file_size: file.file_size || file.size || undefined,
		}));

		// Создаем BookOption
		const bookOption: BookOption = {
			id: book.id,
			title: book.title,
			author: book.author,
		};

		// Используем unified scorer
		const bestMatch = findBestFileForBook(bookOption, fileOptions, 50);

		if (bestMatch) {
			// Найдем соответствующий файл из исходного списка
			const sourceFile = files.find(
				(file: any) =>
					(file.messageId && file.messageId === bestMatch.file.message_id) ||
					(file.message_id && file.message_id === bestMatch.file.message_id),
			);

			if (sourceFile) {
				console.log(
					`    ✅ Найдено совпадение с рейтингом ${bestMatch.score}: ${sourceFile.filename}`,
				);
				console.log(
					`    📊 Детали: title=${bestMatch.titleMatchCount}, author=${bestMatch.authorMatch}, matched=${bestMatch.matchedWords.length}`,
				);
				return sourceFile;
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
			const channelInfo = channel as {
				id?: unknown;
				title?: string;
				username?: string;
			};
			console.log(
				`✅ Подключено к каналу: ${channelInfo.title || channelInfo.username || channelInfo.id}`,
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
			const { data: booksWithoutFiles, error: booksError } = await db
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
			const { data: lastProcessed } = await db
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
			console.log(
				`📥 Получаем новые сообщения из канала (после ID ${lastMessageId || 0})...`,
			);

			const newMessages = (await this.telegramService.getMessages(
				channelId,
				200,
				undefined,
				{
					minId: lastMessageId,
					reverse: true,
				},
			)) as any[];

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

			// 2. Обработка сообщений и подготовка метаданных
			console.log("💾 Обработка сообщений и подготовка метаданных...");

			const messageChunks = this.chunkArray(newMessages, 5);
			const metadataList: BookMetadata[] = [];
			const details: unknown[] = [];
			const detailedLogs: string[] = [];

			let processedCount = 0;
			for (const chunk of messageChunks) {
				const results = await Promise.all(
					chunk.map((msg) => this.processSingleMessage(msg)),
				);

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

			// 3. Импорт метаданных с дедупликацией
			console.log("💾 Импортируем метаданные в базу данных...");
			const resultImport =
				await this.metadataService.importMetadataWithDeduplication(
					metadataList,
				);

			console.log("✅ Импорт новых метаданных завершен");

			const combinedDetails = [...details, ...resultImport.details];
			const totalSkipped =
				resultImport.skipped +
				details.filter((d) => (d as any).status === "skipped").length;

			// 4. Привязка файлов ТОЛЬКО к новым книгам (добавленных в этом запуске)
			console.log("🔗 Привязка файлов к новым книгам...");
			let matchedCount = 0;

			try {
				// Извлекаем ID новых книг из resultImport.details
				const newBookIds = resultImport.details
					.filter((d: any) => d.status === "added" && d.bookId)
					.map((d: any) => d.bookId as string);

				if (newBookIds.length > 0) {
					console.log(
						`📚 Найдено ${newBookIds.length} новых книг для привязки файлов`,
					);

					// Получаем только новые книги без файлов
					const { data: newBooks, error: booksError } = await db
						.from("books")
						.select(
							"id, title, author, telegram_post_id, file_url, telegram_file_id",
						)
						.in("id", newBookIds)
						.is("file_url", null);

					if (booksError) {
						console.warn(
							"⚠️ Ошибка загрузки новых книг для привязки файлов:",
							booksError,
						);
					} else if (newBooks && newBooks.length > 0) {
						console.log(
							`📚 ${newBooks.length} новых книг без файлов для привязки`,
						);

						// Загружаем ТОЛЬКО описания файлов (имена, ID сообщений) — без скачивания
						console.log("📥 Загрузка описаний файлов из Telegram...");
						const filesToProcess =
							await this.fileService.getFilesToProcess(2000);
						console.log(
							`📊 Загружено ${filesToProcess.length} описаний файлов для сопоставления`,
						);

						if (filesToProcess.length > 0) {
							for (const book of newBooks) {
								try {
									console.log(
										`  🔍 Ищем файл для "${book.title}" (${book.author})...`,
									);
									const matchingFile = await this.findMatchingFile(
										book,
										filesToProcess,
									);

									if (matchingFile) {
										console.log(
											`    📨 Совпадение: ${matchingFile.filename} (msg: ${matchingFile.messageId})`,
										);

										try {
											// Скачиваем файл ТОЛЬКО при подтверждённом совпадении
											const messageId = parseInt(
												matchingFile.messageId as string,
												10,
											);

											// Получаем канал с файлами
											const filesChannel =
												await this.telegramService?.getFilesChannel();
											const filesChannelId =
												typeof filesChannel?.id === "object" &&
												filesChannel?.id !== null
													? (
															filesChannel.id as {
																toString: () => string;
															}
														).toString()
													: String(filesChannel?.id);

											// Получаем сообщение с файлом
											const messages = (await this.telegramService?.getMessages(
												filesChannelId,
												1,
												messageId,
											)) as any[];
											if (!messages || messages.length === 0) {
												console.warn(
													`    ⚠️ Сообщение ${messageId} не найдено в канале`,
												);
												continue;
											}

											const targetMsg = messages[0];
											if (!targetMsg?.media) {
												console.warn(
													`    ⚠️ Сообщение ${messageId} не содержит медиа`,
												);
												continue;
											}

											// Скачиваем файл с таймаутом 2 минуты
											const buffer = (await Promise.race([
												this.telegramService?.downloadMedia(targetMsg.media),
												new Promise<Buffer>((_, reject) =>
													setTimeout(
														() =>
															reject(
																new Error(
																	"Timeout: File download took too long",
																),
															),
														120000,
													),
												),
											])) as Buffer | undefined;

											if (
												!buffer ||
												!(buffer instanceof Buffer) ||
												buffer.length === 0
											) {
												console.warn(
													`    ⚠️ Не удалось скачать файл для ${messageId}`,
												);
												continue;
											}

											// Определяем расширение и формат
											let ext = ".fb2";
											if (
												targetMsg.document &&
												(targetMsg.document as any).attributes
											) {
												const attrFileName = (
													targetMsg.document as any
												).attributes.find(
													(a: any) =>
														a.className === "DocumentAttributeFilename",
												);
												if (attrFileName?.fileName) {
													ext =
														extractExtension(attrFileName.fileName) || ".fb2";
												}
											}

											const fileFormat = ext === ".zip" ? "zip" : "fb2";
											const storageKey = `${messageId}${ext}`;

											// Загружаем в S3
											const bucketName = process.env.S3_BUCKET_NAME;
											if (!bucketName) {
												throw new Error("S3_BUCKET_NAME not set");
											}
											await putObject(
												storageKey,
												Buffer.from(buffer),
												bucketName,
											);

											const fileUrl = `https://${bucketName}.s3.cloud.ru/${storageKey}`;

											// Обновляем запись книги
											const { error: updateBookError } = await db
												.from("books")
												.update({
													file_url: fileUrl,
													file_size: buffer.length,
													file_format: fileFormat,
													telegram_file_id: String(messageId),
													updated_at: new Date().toISOString(),
												})
												.eq("id", book.id);

											if (updateBookError) {
												console.warn(
													`    ⚠️ Ошибка обновления книги:`,
													updateBookError,
												);
											} else {
												// Обновляем запись в telegram_processed_messages
												if (book.telegram_post_id) {
													await db.from("telegram_processed_messages").upsert(
														{
															message_id: book.telegram_post_id,
															channel:
																process.env.TELEGRAM_METADATA_CHANNEL_ID || "",
															book_id: book.id,
															telegram_file_id: String(messageId),
															processed_at: new Date().toISOString(),
														},
														{ onConflict: "message_id" },
													);
												}

												console.log(
													`    ✅ Файл привязан: ${matchingFile.filename} → "${book.title}"`,
												);
												matchedCount++;
											}
										} catch (downloadErr) {
											console.warn(
												`    ❌ Ошибка скачивания/загрузки файла:`,
												downloadErr,
											);
										}
									} else {
										console.log(`    ⚠️ Файл не найден`);
									}
								} catch (matchErr) {
									console.warn(
										`    ⚠️ Ошибка привязки файла для "${book.title}":`,
										matchErr,
									);
								}
							}
						}
					} else {
						console.log("  ℹ️ Нет новых книг без файлов для привязки");
					}
				} else {
					console.log("  ℹ️ Нет новых книг для привязки файлов");
				}
			} catch (fileLinkError) {
				console.warn("⚠️ Ошибка при привязке файлов:", fileLinkError);
			}

			// Сводка
			console.log("\n📊 СВОДКА СИНХРОНИЗАЦИИ:");
			console.log(`   ========================================`);
			console.log(`   Обработано сообщений: ${newMessages.length}`);
			console.log(`   Добавлено книг: ${resultImport.added}`);
			console.log(`   Обновлено книг: ${resultImport.updated}`);
			console.log(`   Привязано файлов: ${matchedCount}`);
			console.log(`   Пропущено: ${totalSkipped}`);
			console.log(`   Ошибок: ${resultImport.errors}`);

			return {
				processed:
					resultImport.processed + newMessages.length - metadataList.length,
				added: resultImport.added,
				updated: resultImport.updated,
				skipped: totalSkipped,
				errors: resultImport.errors,
				details: combinedDetails,
				matched: matchedCount,
				coversDownloaded: 0,
				lastProcessedMessageId: lastMessageId,
				message: `Sync completed. Added: ${resultImport.added}, Updated: ${resultImport.updated}, Matched: ${matchedCount}, Processed: ${newMessages.length}`,
				detailedLogs: detailedLogs.sort((a, b) => {
					const idA = parseInt(a.match(/\[ID:(\d+)\]/)?.[1] || "0", 10);
					const idB = parseInt(b.match(/\[ID:(\d+)\]/)?.[1] || "0", 10);
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

		const { error } = await db
			.from("telegram_processed_messages")
			.upsert(processedData, { onConflict: "message_id" });

		if (error) {
			console.warn(`Error marking message ${messageId} as processed:`, error);
		}
	}

	private async downloadCover(msg: any): Promise<string | null> {
		if (!this.telegramService) {
			console.warn("⚠️ downloadCover: telegramService is null");
			return null;
		}

		const anyMsg = msg as unknown as { id: number; media?: any };
		const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
		if (!coversBucket) {
			console.warn("⚠️ downloadCover: S3_COVERS_BUCKET_NAME not set");
			return null;
		}

		try {
			if (!anyMsg.media) return null;

			const mediaType = anyMsg.media.className;
			let mediaToDownload: any = null;

			// MessageMediaWebPage — основной случай для обложек в Telegram каналах
			if (mediaType === "MessageMediaWebPage" && anyMsg.media.webpage?.photo) {
				mediaToDownload = anyMsg.media.webpage.photo;
			}
			// MessageMediaPhoto — одиночное фото
			else if (mediaType === "MessageMediaPhoto" && anyMsg.media.photo) {
				mediaToDownload = anyMsg.media.photo;
			}
			// MessageMediaDocument — документ-изображение
			else if (mediaType === "MessageMediaDocument" && anyMsg.media.document) {
				const mimeType = anyMsg.media.document.mimeType;
				if (mimeType?.startsWith("image/")) {
					mediaToDownload = anyMsg.media.document;
				}
			}

			if (!mediaToDownload) return null;

			const result = await Promise.race([
				this.telegramService.downloadMedia(mediaToDownload),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
			]);

			if (!result) {
				console.warn(`⚠️ downloadCover: null result for msg ${anyMsg.id}`);
				return null;
			}
			if (!(result instanceof Buffer) || result.length === 0) {
				console.warn(`⚠️ downloadCover: empty/non-buffer for msg ${anyMsg.id}`);
				return null;
			}

			const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
			await putObject(
				photoKey,
				Buffer.from(result),
				coversBucket,
				"image/jpeg",
			);
			const url = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
			console.log(`✅ Cover downloaded for msg ${anyMsg.id}: ${url}`);
			return url;
		} catch (e) {
			console.warn(`⚠️ downloadCover failed for msg ${anyMsg.id}:`, e);
			return null;
		}
	}

	/**
	 * Запускает полную синхронизацию книг (режим full)
	 */
	public async runFullSync(): Promise<any> {
		console.log("🔄 Запуск полной синхронизации книг...");

		try {
			if (!this.fileService || !this.metadataService || !this.telegramService) {
				throw new Error(
					"Необходимые сервисы не инициализированы. Убедитесь, что BookWormService создан через getInstance().",
				);
			}

			// 1. Получаем канал с метаданными
			const channel = await this.telegramService.getMetadataChannel();
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);

			// 2. Загружаем ВСЕ сообщения из канала с метаданными
			console.log("📥 Загрузка всех сообщений из канала с метаданными...");
			const detailedLogs: string[] = [];

			const allMessages: any[] = [];
			let offsetId: number | undefined;
			let hasMore = true;
			let batchIndex = 0;

			while (hasMore) {
				batchIndex++;
				console.log(`  📥 Батч ${batchIndex}...`);
				const batch = (await this.telegramService.getMessages(
					channelId,
					1000,
					offsetId,
					{ reverse: false },
				)) as any[];

				if (batch.length === 0) {
					break;
				}

				allMessages.push(...batch);
				detailedLogs.push(`  📥 Батч ${batchIndex}: ${batch.length} сообщений`);

				if (batch.length < 1000) {
					hasMore = false;
				} else {
					offsetId = Math.max(...batch.map((m: any) => m.id));
				}
			}

			console.log(`✅ Всего загружено сообщений: ${allMessages.length}`);

			// 3. Обработка сообщений и подготовка метаданных
			console.log("💾 Обработка сообщений и подготовка метаданных...");

			const messageChunks = this.chunkArray(allMessages, 5);
			const metadataList: BookMetadata[] = [];
			const details: unknown[] = [];

			let processedCount = 0;
			for (const chunk of messageChunks) {
				const results = await Promise.all(
					chunk.map((msg) => this.processSingleMessage(msg)),
				);

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
					`  ⏳ Обработано ${processedCount}/${allMessages.length} сообщений...`,
				);
			}

			console.log(
				`📊 Всего подготовлено метаданных для импорта: ${metadataList.length}`,
			);

			// 4. Импорт метаданных с дедупликацией
			console.log("💾 Импортируем метаданные в базу данных...");
			const resultImport =
				await this.metadataService.importMetadataWithDeduplication(
					metadataList,
				);

			console.log("✅ Импорт метаданных завершен");

			const combinedDetails = [...details, ...resultImport.details];
			const totalSkipped =
				resultImport.skipped +
				details.filter((d) => (d as any).status === "skipped").length;

			// 5. Привязка файлов ко всем книгам без файлов
			console.log("🔗 Привязка файлов к книгам (batch mode)...");
			let matchedCount = 0;

			try {
				const { data: booksWithoutFiles, error: booksLinkError } = await db
					.from("books")
					.select(
						"id, title, author, telegram_post_id, file_url, telegram_file_id",
					)
					.is("file_url", null)
					.not("title", "is", null)
					.not("author", "is", null);

				if (booksLinkError) {
					console.warn(
						"⚠️ Ошибка загрузки книг для привязки файлов:",
						booksLinkError,
					);
				} else if (booksWithoutFiles && booksWithoutFiles.length > 0) {
					console.log(
						`📚 Найдено ${booksWithoutFiles.length} книг без файлов для привязки`,
					);

					// Загружаем файлы из архивного канала
					console.log("📥 Загрузка файлов из Telegram...");
					const filesToProcess = await this.fileService.getFilesToProcess(2000);
					console.log(
						`📊 Загружено ${filesToProcess.length} файлов для сопоставления`,
					);

					if (filesToProcess.length > 0) {
						// Конвертируем данные в формат FileOption/BookOption
						const fileOptions: FileOption[] = filesToProcess.map((f: any) => ({
							message_id: f.messageId || f.message_id || 0,
							file_name: f.filename || "",
							mime_type: f.mime_type || "unknown",
							file_size: f.file_size || f.size || undefined,
						}));

						const bookOptions: BookOption[] = booksWithoutFiles.map(
							(b: any) => ({
								id: b.id,
								title: b.title,
								author: b.author,
							}),
						);

						// Выполняем batch matching за один проход
						console.log(
							`⚡ Выполняем batch matching (${bookOptions.length} книг x ${fileOptions.length} файлов)...`,
						);
						const batchMatches = batchMatchFilesToBooks(
							fileOptions,
							bookOptions,
							50,
						);
						console.log(`📊 Найдено ${batchMatches.size} совпадений`);

						// Обрабатываем результаты
						for (const [bookId, matchResult] of batchMatches) {
							const book = booksWithoutFiles.find((b: any) => b.id === bookId);
							if (!book) continue;

							try {
								// Находим оригинальный файл из списка
								const matchingFile = filesToProcess.find(
									(f: any) =>
										(f.messageId &&
											f.messageId === matchResult.file.message_id) ||
										(f.message_id &&
											f.message_id === matchResult.file.message_id),
								);

								if (matchingFile) {
									console.log(
										`    📨 Найден файл для "${book.title}": ${matchingFile.filename} (оценка: ${matchResult.score})`,
									);

									// Pass knownBookId to skip ILIKE search
									const _result =
										await this.enhancedFileService?.processSingleFileById(
											parseInt(matchingFile.messageId as string, 10),
											bookId,
										);
									console.log(`    ✅ Файл привязан`);
									matchedCount++;
								}
							} catch (matchErr) {
								console.warn(
									`    ⚠️ Ошибка привязки файла для "${book.title}":`,
									matchErr,
								);
							}
						}
					}
				} else {
					console.log("  ℹ️  Нет книг без файлов для привязки");
				}
			} catch (fileLinkError) {
				console.warn("⚠️ Ошибка при привязке файлов:", fileLinkError);
			}

			// 5. Ретроактивное скачивание обложек для книг без обложек
			console.log("📸 Скачивание обложек для книг без обложек...");
			let coversDownloaded = 0;

			try {
				const { data: booksNoCover, error: coverFetchError } = await db
					.from("books")
					.select("id, title, author, telegram_post_id, cover_url")
					.is("cover_url", null)
					.not("telegram_post_id", "is", null);

				if (coverFetchError) {
					console.warn("⚠️ Ошибка загрузки книг без обложек:", coverFetchError);
				} else if (booksNoCover && booksNoCover.length > 0) {
					console.log(
						`📚 Найдено ${booksNoCover.length} книг без обложек для скачивания`,
					);

					for (const book of booksNoCover) {
						try {
							const postId = parseInt(book.telegram_post_id!, 10);
							const messages = (await this.telegramService.getMessages(
								channelId,
								1,
								postId,
							)) as any[];

							if (messages && messages.length > 0) {
								const coverUrl = await this.downloadCover(messages[0]);
								if (coverUrl) {
									await db
										.from("books")
										.update({ cover_url: coverUrl })
										.eq("id", book.id);
									coversDownloaded++;
									console.log(
										`    ✅ Обложка для "${book.title}": ${coverUrl}`,
									);
								}
							}
						} catch (coverErr) {
							console.warn(
								`    ⚠️ Ошибка скачивания обложки для "${book.title}":`,
								coverErr,
							);
						}
					}
				} else {
					console.log("  ℹ️  Все книги уже имеют обложки");
				}
			} catch (coverError) {
				console.warn("⚠️ Ошибка при скачивании обложек:", coverError);
			}

			// Сводка
			console.log("\n📊 СВОДКА ПОЛНОЙ СИНХРОНИЗАЦИИ:");
			console.log(`   ========================================`);
			console.log(`   Всего сообщений: ${allMessages.length}`);
			console.log(`   Добавлено книг: ${resultImport.added}`);
			console.log(`   Обновлено книг: ${resultImport.updated}`);
			console.log(`   Привязано файлов: ${matchedCount}`);
			console.log(`   Скачано обложек: ${coversDownloaded}`);
			console.log(`   Пропущено: ${totalSkipped}`);
			console.log(`   Ошибок: ${resultImport.errors}`);

			return {
				processed: allMessages.length,
				added: resultImport.added,
				updated: resultImport.updated,
				skipped: totalSkipped,
				errors: resultImport.errors,
				details: combinedDetails,
				matched: matchedCount,
				coversDownloaded,
				message: `Full sync completed. Added: ${resultImport.added}, Updated: ${resultImport.updated}, Matched: ${matchedCount}, Covers: ${coversDownloaded}, Processed: ${allMessages.length}`,
				detailedLogs,
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
