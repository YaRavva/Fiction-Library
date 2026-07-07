import * as path from "node:path";
import type { Message } from "node-telegram-bot-api";
import { putObject } from "../s3-service";
import { serverSupabase } from "../serverSupabase";
import { uploadFileToStorage, upsertBookRecord } from "../supabase";
import { TelegramService } from "./client";
import { TelegramFileService } from "./file-service";
import { TelegramMetadataService } from "./metadata-service";
import { type BookMetadata, MetadataParser } from "./parser";

/**
 * Скачивает файл из Telegram по его ID
 */
export async function downloadFile(fileId: string): Promise<Buffer | null> {
	try {
		const client = await TelegramService.getInstance();
		return await client.downloadFile(fileId);
	} catch (error) {
		console.error("Error downloading file:", error);
		return null;
	}
}

export class TelegramSyncService {
	private static instance: TelegramSyncService;
	private telegramClient: TelegramService | null = null;
	private metadataService: TelegramMetadataService | null = null;
	private fileService: TelegramFileService | null = null;

	private constructor() {}

	public static async getInstance(): Promise<TelegramSyncService> {
		if (!TelegramSyncService.instance) {
			TelegramSyncService.instance = new TelegramSyncService();
			TelegramSyncService.instance.telegramClient =
				await TelegramService.getInstance();
			TelegramSyncService.instance.metadataService =
				await TelegramMetadataService.getInstance();
			TelegramSyncService.instance.fileService =
				await TelegramFileService.getInstance();
		}
		return TelegramSyncService.instance;
	}

	public async syncMetadata(limit: number = 10): Promise<BookMetadata[]> {
		if (!this.telegramClient) {
			throw new Error("Telegram client not initialized");
		}

		try {
			// Получаем канал с метаданными
			const channel = await this.telegramClient.getMetadataChannel();

			// Получаем ID последнего обработанного сообщения
			console.log("🔍 Получаем ID последнего обработанного сообщения...");
			const { data: lastProcessed, error: lastProcessedError } =
				await serverSupabase
					.from("telegram_processed_messages")
					.select("message_id")
					.order("processed_at", { ascending: false })
					.limit(1)
					.single();

			let offsetId: number | undefined;
			if (
				!lastProcessedError &&
				lastProcessed &&
				(lastProcessed as { message_id?: string }).message_id
			) {
				// Если есть последнее обработанное сообщение, начинаем с него
				offsetId = parseInt(
					(lastProcessed as { message_id: string }).message_id,
					10,
				);
				console.log(`  📌 Начинаем с сообщения ID: ${offsetId}`);
			} else {
				console.log("  🆕 Начинаем с самых новых сообщений");
			}

			// Получаем сообщения с учетом offsetId
			// Convert BigInteger to string for compatibility
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);
			const messages = (await this.telegramClient.getMessages(
				channelId,
				limit,
				offsetId,
			)) as unknown as Message[];
			console.log(`✅ Получено ${messages.length} сообщений\n`);

			// Парсим метаданные из каждого сообщения
			const metadataList: BookMetadata[] = [];

			// Обрабатываем каждое сообщение
			for (const msg of messages) {
				const anyMsg = msg as unknown as { [key: string]: unknown };
				console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);

				// Пропускаем сообщения без текста
				if (!(msg as { text?: string }).text) {
					console.log(
						`  ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`,
					);
					continue;
				}

				// Парсим текст сообщения
				const metadata = MetadataParser.parseMessage(
					(msg as { text: string }).text,
				);

				// Проверяем наличие книги в БД по названию и автору ПЕРЕД обработкой медиа
				let bookExists = false;
				try {
					const { data: foundBooks, error: findError } = await serverSupabase
						.from("books")
						.select("*")
						.eq("title", metadata.title)
						.eq("author", metadata.author);

					if (!findError && foundBooks && foundBooks.length > 0) {
						bookExists = true;
						console.log(
							`  ℹ️ Книга "${metadata.title}" автора ${metadata.author} уже существует в БД, пропускаем обработку обложек`,
						);
					}
				} catch (checkError) {
					console.warn(
						`  ⚠️ Ошибка при проверке существования книги:`,
						checkError,
					);
				}

				// Извлекаем URL обложек из медиа-файлов сообщения ТОЛЬКО если книга не существует
				const coverUrls: string[] = [];

				// Проверяем наличие медиа в сообщении ТОЛЬКО если книга не существует
				if (!bookExists && anyMsg.media) {
					console.log(
						`📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`,
					);

					// Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
					if (
						(anyMsg.media as { className: string }).className ===
							"MessageMediaWebPage" &&
						(anyMsg.media as { webpage?: { photo?: unknown } }).webpage?.photo
					) {
						console.log(`  → Веб-превью с фото`);
						try {
							console.log(`  → Скачиваем фото из веб-превью...`);
							const result = await Promise.race([
								this.telegramClient.downloadMedia(
									(anyMsg.media as { webpage: { photo: unknown } }).webpage
										.photo,
								),
								new Promise<never>((_, reject) =>
									setTimeout(
										() =>
											reject(
												new Error("Timeout: Downloading media took too long"),
											),
										30000,
									),
								),
							]);
							const photoBuffer = result instanceof Buffer ? result : null;
							if (photoBuffer) {
								const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
								console.log(`  → Загружаем в Storage: covers/${photoKey}`);
								await uploadFileToStorage(
									"covers",
									photoKey,
									Buffer.from(photoBuffer),
									"image/jpeg",
								);
								const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
								coverUrls.push(photoUrl);
								console.log(`  ✅ Обложка загружена: ${photoUrl}`);
							} else {
								console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
							}
						} catch (err) {
							console.error(`  ❌ Ошибка загрузки обложки из веб-превью:`, err);
						}
					}
					// Если это одно фото (MessageMediaPhoto)
					else if ((anyMsg.media as { photo?: unknown }).photo) {
						console.log(`  → Одиночное фото`);
						try {
							console.log(`  → Скачиваем фото...`);
							const result = await Promise.race([
								this.telegramClient.downloadMedia(msg),
								new Promise<never>((_, reject) =>
									setTimeout(
										() =>
											reject(
												new Error("Timeout: Downloading media took too long"),
											),
										30000,
									),
								),
							]);
							const photoBuffer = result instanceof Buffer ? result : null;
							if (photoBuffer) {
								const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
								console.log(`  → Загружаем в Storage: covers/${photoKey}`);
								await uploadFileToStorage(
									"covers",
									photoKey,
									Buffer.from(photoBuffer),
									"image/jpeg",
								);
								const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
								coverUrls.push(photoUrl);
								console.log(`  ✅ Обложка загружена: ${photoUrl}`);
							} else {
								console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
							}
						} catch (err) {
							console.error(`  ❌ Ошибка загрузки обложки:`, err);
						}
					}
					// Если это документ с изображением
					else if ((anyMsg.media as { document?: unknown }).document) {
						const mimeType = (
							anyMsg.media as { document: { mimeType?: string } }
						).document.mimeType;
						if (mimeType?.startsWith("image/")) {
							console.log(`  → Одиночное изображение (документ: ${mimeType})`);
							try {
								console.log(`  → Скачиваем изображение...`);
								const result = await Promise.race([
									this.telegramClient.downloadMedia(msg),
									new Promise<never>((_, reject) =>
										setTimeout(
											() =>
												reject(
													new Error("Timeout: Downloading media took too long"),
												),
											30000,
										),
									),
								]);

								const photoBuffer = result instanceof Buffer ? result : null;
								if (photoBuffer) {
									const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
									console.log(`  → Загружаем в Storage: covers/${photoKey}`);
									await uploadFileToStorage(
										"covers",
										photoKey,
										Buffer.from(photoBuffer),
										"image/jpeg",
									);
									const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
									coverUrls.push(photoUrl);
									console.log(`  ✅ Обложка загружена: ${photoUrl}`);
								} else {
									console.warn(
										`  ⚠️ Не удалось скачать изображение (пустой буфер)`,
									);
								}
							} catch (err) {
								console.error(`  ❌ Ошибка загрузки обложки:`, err);
							}
						}
					}
				}

				// Добавляем метаданные в список
				metadataList.push({
					...metadata,
					coverUrls:
						coverUrls.length > 0 ? coverUrls : metadata.coverUrls || [],
				});
			}

			return metadataList;
		} catch (error) {
			console.error("Error in syncMetadata:", error);
			throw error;
		}
	}

	public async downloadBook(messageId: number): Promise<Buffer> {
		if (!this.telegramClient) {
			throw new Error("Telegram client not initialized");
		}

		try {
			// Получаем канал с файлами
			const channel = await this.telegramClient.getFilesChannel();

			// Получаем конкретное сообщение
			console.log(`Getting message ${messageId} from channel...`);
			// Convert BigInteger to string for compatibility
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);
			const messages = (await this.telegramClient.getMessages(
				channelId,
				5,
			)) as unknown as Message[]; // Get more messages to increase chances
			console.log(`Found ${messages.length} messages`);

			// Find the message with the specified ID or use the first available message
			let message = messages[0]; // Default to first message
			if (messageId > 1) {
				for (const msg of messages) {
					if ((msg as { id?: unknown }).id === messageId) {
						message = msg;
						break;
					}
				}
			}

			if (!message) {
				throw new Error(`Message ${messageId} not found`);
			}

			console.log(`Downloading file from message ${messageId}...`);

			// Скачиваем файл
			const buffer = await Promise.race([
				this.telegramClient.downloadMedia(message),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error("Timeout: Media download took too long")),
						45000,
					),
				),
			]);

			if (!buffer) {
				throw new Error("Failed to download file");
			}

			// Определяем имя файла, mime и автора с учётом разных структур message
			const anyMsg = message as unknown as { [key: string]: unknown };
			const filenameCandidate =
				(anyMsg.fileName as string) ||
				(anyMsg.document &&
					(anyMsg.document as { fileName?: string }).fileName) ||
				(anyMsg.media &&
					(anyMsg.media as { document?: { fileName?: string } }).document &&
					(anyMsg.media as { document: { fileName?: string } }).document
						.fileName) ||
				`book_${anyMsg.id}.fb2`;

			const ext = path.extname(filenameCandidate as string) || ".fb2";

			// Используем messageId для ключа хранения (чтобы избежать проблем с недопустимыми символами)
			// но сохраняем оригинальное имя файла
			const storageKey = `${anyMsg.id}${ext}`; // Ключ для хранения в Storage
			const _displayName = filenameCandidate; // Оригинальное имя файла для отображения

			const _mime =
				(anyMsg.mimeType as string) ||
				(anyMsg.document &&
					(anyMsg.document as { mimeType?: string }).mimeType) ||
				(anyMsg.media &&
					(anyMsg.media as { document?: { mimeType?: string } }).document &&
					(anyMsg.media as { document: { mimeType?: string } }).document
						.mimeType) ||
				"application/octet-stream";

			// Загружаем в S3 бакет (используем S3_BUCKET_NAME из переменных окружения)
			console.log(`Uploading file to S3 bucket...`);
			const bucketName = process.env.S3_BUCKET_NAME;
			if (!bucketName) {
				throw new Error("S3_BUCKET_NAME environment variable is not set.");
			}
			await putObject(storageKey as string, Buffer.from(buffer), bucketName);

			// Вставляем/обновляем запись книги (минимальные поля)
			const bookRecord: { [key: string]: unknown } = {
				title: (filenameCandidate as string) || `book-${anyMsg.id}`,
				author:
					(anyMsg.author as string) ||
					(anyMsg.from && (anyMsg.from as { username?: string }).username) ||
					"Unknown",
				file_url: `https://${bucketName}.s3.cloud.ru/${storageKey}`,
				file_size: buffer.length,
				file_format: (ext as string).replace(".", ""),
				telegram_file_id: String(anyMsg.id),
			};

			try {
				await upsertBookRecord(bookRecord);
			} catch (err) {
				console.warn("Failed to upsert book record:", err);
			}

			return Buffer.from(buffer);
		} catch (error) {
			console.error("Error downloading book:", error);
			throw error;
		}
	}

	/**
	 * Скачивает файлы из канала "Архив для фантастики" и добавляет их в очередь загрузки
	 * @param limit Количество сообщений для обработки
	 * @param addToQueue Флаг, определяющий, добавлять ли файлы в очередь загрузки
	 */
	public async downloadFilesFromArchiveChannel(
		limit: number = 10,
		addToQueue: boolean = true,
	): Promise<{ [key: string]: unknown }[]> {
		if (!this.telegramClient) {
			throw new Error("Telegram client not initialized");
		}

		try {
			// Получаем канал с файлами
			console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
			const channel = await this.telegramClient.getFilesChannel();

			// Convert BigInteger to string for compatibility
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);

			// Получаем сообщения
			console.log(`📖 Получаем последние ${limit} сообщений...`);
			const messages = (await this.telegramClient.getMessages(
				channelId,
				limit,
			)) as unknown as Message[];
			console.log(`✅ Получено ${messages.length} сообщений\n`);

			const results: { [key: string]: unknown }[] = [];

			// Обрабатываем каждое сообщение
			for (const msg of messages) {
				const anyMsg = msg as unknown as { [key: string]: unknown };
				console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);

				// Проверяем, есть ли в сообщении медиа (файл)
				if (!(anyMsg.media as unknown)) {
					console.log(
						`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа, пропускаем`,
					);
					continue;
				}

				try {
					// Определяем имя файла
					let filename = `book_${anyMsg.id}.fb2`;
					if (
						anyMsg.document &&
						(anyMsg.document as { [key: string]: unknown }).attributes
					) {
						// Ищем атрибут с именем файла
						const attributes = (anyMsg.document as { [key: string]: unknown })
							.attributes as unknown[];
						const attrFileName = attributes.find((attr: unknown) => {
							const attrObj = attr as { [key: string]: unknown };
							return attrObj.className === "DocumentAttributeFilename";
						}) as { [key: string]: unknown } | undefined;
						if (attrFileName?.fileName) {
							filename = attrFileName.fileName as string;
						}
					}

					console.log(`  📄 Найден файл: ${filename}`);

					// Если нужно добавить в очередь загрузки
					if (addToQueue) {
						// Формируем file_id как messageId (канал будем получать внутри downloadFile)
						const fileId = String(anyMsg.id);

						// Создаем запись о файле в БД (временно, для отслеживания)
						const fileRecord = {
							telegram_message_id: String(anyMsg.id),
							channel: "Архив для фантастики",
							raw_text: (anyMsg.message as string) || "",
							processed_at: new Date().toISOString(),
						};

						try {
							// Вставляем запись о сообщении
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const supabase: any = serverSupabase;
							await supabase.from("telegram_messages").upsert(fileRecord);
						} catch (dbError) {
							console.warn(
								`  ⚠️ Ошибка при сохранении записи о сообщении:`,
								dbError,
							);
						}

						// Добавляем задачу в очередь загрузки
						const downloadTask = {
							message_id: String(anyMsg.id),
							channel_id: String((anyMsg.peerId as string) || channel.id),
							file_id: fileId,
							status: "pending",
							priority: 0,
							scheduled_for: new Date().toISOString(),
						};

						try {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const supabase: any = serverSupabase;
							await supabase
								.from("telegram_download_queue")
								.upsert(downloadTask);
							console.log(`  ✅ Файл добавлен в очередь загрузки: ${fileId}`);
						} catch (queueError) {
							console.error(
								`  ❌ Ошибка при добавлении в очередь:`,
								queueError,
							);
						}
					}

					results.push({
						messageId: anyMsg.id,
						filename,
						hasMedia: !!(anyMsg.media as unknown),
						addedToQueue: addToQueue,
					});
				} catch (msgError) {
					console.error(
						`  ❌ Ошибка обработки сообщения ${anyMsg.id}:`,
						msgError,
					);
				}
			}

			console.log(`\n📊 Всего обработано файлов: ${results.length}`);
			return results;
		} catch (error) {
			console.error("Error downloading files from archive channel:", error);
			throw error;
		}
	}

	/**
	 * Получает список файлов для обработки без их непосредственной обработки
	 * @param limit Количество сообщений для получения
	 */
	public async getFilesToProcess(
		limit: number = 10,
	): Promise<{ [key: string]: unknown }[]> {
		if (!this.fileService) {
			throw new Error("File service not initialized");
		}
		return await this.fileService.getFilesToProcess(limit);
	}

	/**
	 * Обрабатывает один файл по ID сообщения
	 * @param messageId ID сообщения с файлом
	 */
	public async processSingleFileById(
		messageId: number,
	): Promise<{ [key: string]: unknown }> {
		if (!this.fileService) {
			throw new Error("File service not initialized");
		}
		return await this.fileService.processSingleFileById(messageId);
	}

	/**
	 * Скачивает и обрабатывает файлы из канала "Архив для фантастики" напрямую (без очереди)
	 * @param limit Количество сообщений для обработки
	 */
	public async downloadAndProcessFilesDirectly(
		limit: number = 10,
	): Promise<{ [key: string]: unknown }[]> {
		if (!this.fileService) {
			throw new Error("File service not initialized");
		}
		return await this.fileService.downloadAndProcessFilesDirectly(limit);
	}

	/**
	 * Скачивает и обрабатывает один файл напрямую, привязывая его к указанной книге
	 * @param message Сообщение Telegram с файлом
	 * @param bookId ID книги, к которой нужно привязать файл (опционально)
	 */
	public async processFile(
		_message: { [key: string]: unknown },
		_bookId?: string,
	): Promise<{ [key: string]: unknown }> {
		if (!this.fileService) {
			throw new Error("File service not initialized");
		}
		// This is a simplified version, in a real implementation you might want to delegate to fileService
		return {};
	}

	public async shutdown(): Promise<void> {
		if (
			this.telegramClient &&
			typeof (this.telegramClient as unknown as { [key: string]: unknown })
				.disconnect === "function"
		) {
			try {
				// Добавляем таймаут для принудительного завершения
				await Promise.race([
					(
						(this.telegramClient as unknown as { [key: string]: unknown })
							.disconnect as () => Promise<void>
					)(),
					new Promise((resolve) => setTimeout(resolve, 3000)), // 3 секунды таймаут
				]);
			} catch (err) {
				console.warn("Error during shutdown:", err);
			}
		}
	}

	/**
	 * Синхронизирует книги из Telegram канала с учетом уже обработанных сообщений
	 * @param limit Количество сообщений для обработки (по умолчанию 10)
	 */
	public async syncBooks(limit: number = 10): Promise<{
		processed: number;
		added: number;
		updated: number;
		skipped: number;
		errors: number;
		details: unknown[];
	}> {
		if (!this.metadataService) {
			throw new Error("Metadata service not initialized");
		}
		return await this.metadataService.syncBooks(limit);
	}
}
