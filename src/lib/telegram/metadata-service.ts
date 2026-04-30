import type { Message } from "node-telegram-bot-api";
import { getCoversBucketName, putObject } from "../s3";
import { serverSupabase } from "../serverSupabase";
import { TelegramService } from "./client";
import { type BookMetadata, MetadataParser } from "./parser";

export class TelegramMetadataService {
	private static instance: TelegramMetadataService;
	private telegramClient: TelegramService | null = null;

	private constructor() {}

	public static async getInstance(): Promise<TelegramMetadataService> {
		if (!TelegramMetadataService.instance) {
			TelegramMetadataService.instance = new TelegramMetadataService();
			TelegramMetadataService.instance.telegramClient =
				await TelegramService.getInstance();
		}
		return TelegramMetadataService.instance;
	}

	/**
	 * Индексирует все сообщения из Telegram канала для быстрого поиска и определения новых книг
	 * @param batchSize Размер пакета для загрузки (по умолчанию 100)
	 */
	public async indexAllMessages(
		batchSize: number = 100,
		onLog?: (msg: string) => void,
	): Promise<{ indexed: number; errors: number }> {
		if (!this.telegramClient) {
			throw new Error("Telegram client not initialized");
		}

		try {
			const logMsg1 = `🚀 Начинаем индексацию всех сообщений из канала (пакетами по ${batchSize})`;
			console.log(logMsg1);
			if (onLog) onLog(logMsg1);

			// Получаем канал с метаданными
			console.log("📡 Получаем канал с метаданными...");
			if (onLog) onLog("📡 Получаем канал с метаданными...");
			const channel = await this.telegramClient.getMetadataChannel();

			// Convert BigInteger to string for compatibility
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);

			// Получаем все сообщения с пагинацией
			console.log("📥 Получаем все сообщения из канала...");
			if (onLog) onLog("📥 Получаем все сообщения из канала...");
			const allMessages = (await this.telegramClient.getAllMessages(
				channelId,
				batchSize,
				{ onLog },
			)) as unknown as Message[];
			console.log(`✅ Получено ${allMessages.length} сообщений для индексации`);
			if (onLog)
				onLog(`✅ Получено ${allMessages.length} сообщений для индексации`);

			let indexed = 0;
			let errors = 0;

			// Обрабатываем каждое сообщение
			for (const msg of allMessages) {
				const anyMsg = msg as unknown as { [key: string]: unknown };

				try {
					// Парсим текст сообщения только для получения автора и названия
					let author: string | undefined;
					let title: string | undefined;

					if ((msg as { text?: string }).text) {
						const metadata = MetadataParser.parseMessage(
							(msg as { text: string }).text,
						);
						author = metadata.author;
						title = metadata.title;
					}

					// Добавляем запись в индекс
					try {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const supabase: any = serverSupabase;
						const { error: upsertError } = await supabase
							.from("telegram_messages_index")
							.upsert(
								{
									message_id:
										typeof anyMsg.id === "number"
											? anyMsg.id
											: parseInt(String(anyMsg.id), 10),
									channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || "",
									author: author || null,
									title: title || null,
									updated_at: new Date().toISOString(),
								},
								{
									onConflict: "message_id",
								},
							);

						if (upsertError) {
							console.warn(
								`  ⚠️ Ошибка индексации сообщения ${anyMsg.id}:`,
								upsertError,
							);
							errors++;
						} else {
							indexed++;
						}
					} catch (dbError) {
						console.warn(
							`  ⚠️ Ошибка при сохранении записи о сообщении:`,
							dbError,
						);
						errors++;
					}
				} catch (error) {
					console.warn(`  ⚠️ Ошибка обработки сообщения ${anyMsg.id}:`, error);
					errors++;
				}
			}

			const logMsgEnd = `📊 Индексация завершена: ${indexed} сообщений проиндексировано, ${errors} ошибок`;
			console.log(logMsgEnd);
			if (onLog) onLog(logMsgEnd);
			return { indexed, errors };
		} catch (error) {
			console.error("Error in indexAllMessages:", error);
			throw error;
		}
	}

	/**
	 * Проверяет наличие новых сообщений в канале после последней обработки
	 * @returns ID самого нового сообщения или null, если не найдено
	 */
	public async getLatestMessageId(): Promise<string | null> {
		try {
			// Now message_id is stored as BIGINT, so we can sort it directly
			// @ts-expect-error
			const { data, error } = await serverSupabase
				.from("telegram_messages_index")
				.select("message_id")
				.order("message_id", { ascending: false })
				.limit(1)
				.single();

			if (error) {
				console.warn("Ошибка при получении последнего сообщения:", error);
				return null;
			}

			// Return the highest ID as string
			return data
				? (data as { message_id: number }).message_id.toString()
				: null;
		} catch (error) {
			console.error("Error in getLatestMessageId:", error);
			return null;
		}
	}

	/**
	 * Получает ID последнего обработанного сообщения
	 * @returns ID последнего обработанного сообщения или null
	 */
	public async getLastProcessedMessageId(): Promise<string | null> {
		try {
			// @ts-expect-error
			const { data, error } = await serverSupabase
				.from("telegram_processed_messages")
				.select("message_id")
				.order("processed_at", { ascending: false })
				.limit(1)
				.single();

			if (error) {
				console.warn(
					"Ошибка при получении последнего обработанного сообщения:",
					error,
				);
				return null;
			}

			return data ? (data as { message_id: string }).message_id : null;
		} catch (error) {
			console.error("Error in getLastProcessedMessageId:", error);
			return null;
		}
	}

	/**
	 * Находит новые сообщения, которые еще не были обработаны
	 * @param limit Количество сообщений для обработки (по умолчанию 10)
	 * @returns Массив новых сообщений или пустой массив
	 */
	public async findNewMessages(
		limit: number = 10,
	): Promise<
		Array<{ message_id: number; author: string | null; title: string | null }>
	> {
		try {
			// Получаем ID последнего обработанного сообщения
			const lastProcessedIdStr = await this.getLastProcessedMessageId();
			const lastProcessedId = lastProcessedIdStr
				? parseInt(lastProcessedIdStr, 10)
				: 0;

			console.log(`🔍 Поиск новых сообщений после ID: ${lastProcessedId}`);

			// Находим сообщения с ID больше последнего обработанного
			// @ts-expect-error
			const { data, error } = await serverSupabase
				.from("telegram_messages_index")
				.select("message_id, author, title")
				.gt("message_id", lastProcessedId)
				.order("message_id", { ascending: true })
				.limit(limit);

			if (error) {
				console.warn("Ошибка при поиске новых сообщений:", error);
				return [];
			}

			console.log(`✅ Найдено ${data?.length || 0} новых сообщений`);
			return data || [];
		} catch (error) {
			console.error("Error in findNewMessages:", error);
			return [];
		}
	}

	/**
	 * Находит сообщения по ключевым словам в названии или авторе
	 * @param keywords Ключевые слова для поиска
	 * @param limit Максимальное количество результатов (по умолчанию 50)
	 * @returns Массив сообщений, соответствующих критериям поиска
	 */
	public async searchMessagesByKeywords(
		keywords: string[],
		limit: number = 50,
	): Promise<
		Array<{
			message_id: number;
			author: string | null;
			title: string | null;
			similarity: number;
		}>
	> {
		try {
			if (keywords.length === 0) {
				return [];
			}

			// Формируем условия поиска для каждого ключевого слова
			const orConditions: string[] = [];

			keywords.forEach((keyword) => {
				const lowerKeyword = keyword.toLowerCase();
				orConditions.push(
					`author.ilike.%${lowerKeyword}%`,
					`title.ilike.%${lowerKeyword}%`,
				);
			});

			// @ts-expect-error
			const { data, error } = await serverSupabase
				.from("telegram_messages_index")
				.select("message_id, author, title")
				.or(orConditions.join(","))
				.limit(limit);

			if (error) {
				console.warn("Ошибка при поиске сообщений по ключевым словам:", error);
				return [];
			}

			// Вычисляем коэффициент релевантности для каждого сообщения
			const resultsWithSimilarity = (data || []).map((item) => {
				const itemData = item as {
					message_id: number;
					author: string | null;
					title: string | null;
				};

				let similarity = 0;

				// Проверяем совпадение по каждому ключевому слову
				keywords.forEach((keyword) => {
					const lowerKeyword = keyword.toLowerCase();

					if (itemData.author?.toLowerCase().includes(lowerKeyword)) {
						similarity += 3; // Высокий вес для автора
					}

					if (itemData.title?.toLowerCase().includes(lowerKeyword)) {
						similarity += 5; // Самый высокий вес для названия
					}
				});

				return {
					message_id: itemData.message_id,
					author: itemData.author,
					title: itemData.title,
					similarity,
				};
			});

			// Сортируем по убыванию релевантности
			resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

			console.log(
				`✅ Найдено ${resultsWithSimilarity.length} сообщений по ключевым словам: ${keywords.join(", ")}`,
			);
			return resultsWithSimilarity;
		} catch (error) {
			console.error("Error in searchMessagesByKeywords:", error);
			return [];
		}
	}

	/**
	 * Получает статистику по индексированным сообщениям
	 * @returns Объект со статистикой
	 */
	public async getIndexStatistics(): Promise<{
		totalMessages: number;
		messagesWithAuthor: number;
		messagesWithTitle: number;
	}> {
		try {
			// @ts-expect-error
			const { data: totalData, error: totalError } = await serverSupabase
				.from("telegram_messages_index")
				.select("*", { count: "exact", head: true });

			if (totalError) throw totalError;

			// @ts-expect-error
			const { data: authorData, error: authorError } = await serverSupabase
				.from("telegram_messages_index")
				.select("*", { count: "exact", head: true })
				.not("author", "is", null);

			if (authorError) throw authorError;

			// @ts-expect-error
			const { data: titleData, error: titleError } = await serverSupabase
				.from("telegram_messages_index")
				.select("*", { count: "exact", head: true })
				.not("title", "is", null);

			if (titleError) throw titleError;

			return {
				totalMessages: totalData ? totalData.length : 0,
				messagesWithAuthor: authorData ? authorData.length : 0,
				messagesWithTitle: titleData ? titleData.length : 0,
			};
		} catch (error) {
			console.error("Error in getIndexStatistics:", error);
			return {
				totalMessages: 0,
				messagesWithAuthor: 0,
				messagesWithTitle: 0,
			};
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
		if (!this.telegramClient) {
			throw new Error("Telegram client not initialized");
		}

		try {
			console.log(`🚀 Начинаем синхронизацию новых книг (лимит: ${limit})`);

			// Находим новые сообщения
			console.log("🔍 Поиск новых сообщений...");
			const newMessages = await this.findNewMessages(limit);

			if (newMessages.length === 0) {
				console.log("  ℹ️ Новых сообщений не найдено");
				return {
					processed: 0,
					added: 0,
					updated: 0,
					skipped: 0,
					errors: 0,
					details: [],
				};
			}

			console.log(
				`✅ Найдено ${newMessages.length} новых сообщений для обработки\n`,
			);

			// Получаем полные сообщения через Telegram API
			console.log("📡 Получаем канал с метаданными...");
			const channel = await this.telegramClient.getMetadataChannel();

			// Convert BigInteger to string for compatibility
			const channelId =
				typeof channel.id === "object" && channel.id !== null
					? (channel.id as { toString: () => string }).toString()
					: String(channel.id);

			// Получаем полные сообщения по их ID
			console.log("📥 Получаем полные сообщения из Telegram...");
			const fullMessages: Message[] = [];

			for (const msgInfo of newMessages) {
				try {
					// @ts-expect-error
					const fullMessage = await this.telegramClient.getMessageById(
						channelId,
						msgInfo.message_id,
					);
					if (fullMessage) {
						fullMessages.push(fullMessage as unknown as Message);
						console.log(`  ✅ Получено сообщение ${msgInfo.message_id}`);
					} else {
						console.warn(`  ⚠️ Сообщение ${msgInfo.message_id} не найдено`);
					}
				} catch (error) {
					console.warn(
						`  ⚠️ Ошибка получения сообщения ${msgInfo.message_id}:`,
						error,
					);
				}
			}

			console.log(`✅ Получено ${fullMessages.length} полных сообщений\n`);

			// Парсим метаданные из каждого сообщения
			const metadataList: BookMetadata[] = [];
			const details: unknown[] = []; // Объявляем details здесь для использования в цикле

			// Обрабатываем каждое сообщение
			for (const msg of fullMessages) {
				const anyMsg = msg as unknown as { [key: string]: unknown };
				console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);

				// Пропускаем сообщения без текста
				if (!(msg as { text?: string }).text) {
					console.log(
						`  ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`,
					);
					// Добавляем запись в details о пропущенном сообщении
					details.push({
						msgId: anyMsg.id,
						status: "skipped",
						reason: "no text content",
					});
					continue;
				}

				// Парсим текст сообщения
				const metadata = MetadataParser.parseMessage(
					(msg as { text: string }).text,
				);
				// Добавляем ID сообщения в метаданные
				metadata.messageId = anyMsg.id as number;

				// Проверяем, что у книги есть название и автор
				if (
					!metadata.title ||
					!metadata.author ||
					metadata.title.trim() === "" ||
					metadata.author.trim() === ""
				) {
					console.log(
						`  ⚠️  Пропускаем сообщение ${anyMsg.id} (отсутствует название или автор)`,
					);
					// Добавляем запись в details о пропущенном сообщении
					details.push({
						msgId: anyMsg.id,
						status: "skipped",
						reason: "missing title or author",
						bookTitle: metadata.title || "unknown",
						bookAuthor: metadata.author || "unknown",
					});
					continue;
				}

				// Проверяем наличие книги в БД по нормализованному названию и автору ПЕРЕД обработкой медиа
				let bookExists = false;
				let existingBookId = null;
				try {
					// Импортируем функцию нормализации текста
					const { checkForBookDuplicates, normalizeBookText } = await import(
						"../book-deduplication-service"
					);

					// Используем улучшенную логику дедупликации
					const duplicateCheck = await checkForBookDuplicates(
						metadata.title,
						metadata.author,
						undefined, // publicationYear
						normalizeBookText,
					);

					if (duplicateCheck.exists && duplicateCheck.book) {
						bookExists = true;
						existingBookId = duplicateCheck.book.id;
						console.log(
							`  ℹ️ Книга "${metadata.title}" автора ${metadata.author} уже существует в БД, пропускаем`,
						);
					}
				} catch (checkError) {
					console.warn(
						`  ⚠️ Ошибка при проверке существования книги:`,
						checkError,
					);
				}

				// Пропускаем сообщение, если книга уже существует
				if (bookExists) {
					// Добавляем запись в details о пропущенном сообщении
					details.push({
						msgId: anyMsg.id,
						status: "skipped",
						reason: "book already exists in database",
						bookId: existingBookId,
						bookTitle: metadata.title,
						bookAuthor: metadata.author,
					});
					continue;
				}

				// Извлекаем URL обложек из медиа-файлов сообщения ТОЛЬКО если книга не существует
				const coverUrls: string[] = [];

				// Проверяем наличие медиа в сообщении ТОЛЬКО если книга не существует
				if (!bookExists && anyMsg.media) {
					console.log(
						`  📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`,
					);

					// Функция для повторных попыток загрузки с увеличенным таймаутом
					const downloadWithRetry = async (media: unknown, maxRetries = 3) => {
						for (let attempt = 1; attempt <= maxRetries; attempt++) {
							try {
								console.log(
									`    → Попытка загрузки ${attempt}/${maxRetries}...`,
								);
								if (!this.telegramClient) {
									throw new Error("Telegram client not initialized");
								}
								const result = await Promise.race([
									this.telegramClient.downloadMedia(media),
									new Promise<never>((_, reject) =>
										setTimeout(
											() =>
												reject(
													new Error(
														`Timeout: Downloading media took too long (attempt ${attempt}/${maxRetries})`,
													),
												),
											60000,
										),
									), // Увеличиваем до 60 секунд
								]);
								return result;
							} catch (err: unknown) {
								console.warn(
									`    ⚠️ Попытка ${attempt} не удалась:`,
									err instanceof Error ? err.message : "Unknown error",
								);
								if (attempt === maxRetries) {
									throw err; // Если все попытки неудачны, выбрасываем ошибку
								}
								// Ждем перед следующей попыткой
								await new Promise((resolve) =>
									setTimeout(resolve, 2000 * attempt),
								);
							}
						}
					};

					// Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
					if (
						(anyMsg.media as { className: string }).className ===
							"MessageMediaWebPage" &&
						(anyMsg.media as { webpage?: { photo?: unknown } }).webpage?.photo
					) {
						console.log(`  → Веб-превью с фото`);
						try {
							console.log(`  → Скачиваем фото из веб-превью...`);
							const result = await downloadWithRetry(
								(anyMsg.media as { webpage: { photo: unknown } }).webpage.photo,
							);
							const photoBuffer = result instanceof Buffer ? result : null;
							if (photoBuffer) {
								const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
								console.log(`  → Загружаем в Storage: covers/${photoKey}`);
								const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
								if (!coversBucket) {
									throw new Error(
										"S3_COVERS_BUCKET_NAME environment variable is not set.",
									);
								}
							await putObject(
								photoKey,
								Buffer.from(photoBuffer),
								coversBucket,
								"image/jpeg",
							);
								const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
								coverUrls.push(photoUrl);
								console.log(`  ✅ Обложка загружена: ${photoUrl}`);
							} else {
								console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
							}
						} catch (err: unknown) {
							console.error(
								`  ❌ Ошибка загрузки обложки из веб-превью:`,
								err instanceof Error ? err.message : "Unknown error",
							);
						}
					}
					// Если это одно фото (MessageMediaPhoto)
					else if ((anyMsg.media as { photo?: unknown }).photo) {
						console.log(`  → Одиночное фото`);
						try {
							console.log(`  → Скачиваем фото...`);
							const result = await downloadWithRetry(msg);
							const photoBuffer = result instanceof Buffer ? result : null;
							if (photoBuffer) {
								const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
								console.log(`  → Загружаем в Storage: covers/${photoKey}`);
								const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
								if (!coversBucket) {
									throw new Error(
										"S3_COVERS_BUCKET_NAME environment variable is not set.",
									);
								}
							await putObject(
								photoKey,
								Buffer.from(photoBuffer),
								coversBucket,
								"image/jpeg",
							);
								const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
								coverUrls.push(photoUrl);
								console.log(`  ✅ Обложка загружена: ${photoUrl}`);
							} else {
								console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
							}
						} catch (err: unknown) {
							console.error(
								`  ❌ Ошибка загрузки обложки:`,
								err instanceof Error ? err.message : "Unknown error",
							);
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
								const result = await downloadWithRetry(msg);
								const photoBuffer = result instanceof Buffer ? result : null;
								if (photoBuffer) {
									const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
									console.log(`  → Загружаем в Storage: covers/${photoKey}`);
									const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
									if (!coversBucket) {
										throw new Error(
											"S3_COVERS_BUCKET_NAME environment variable is not set.",
										);
									}
									await putObject(
										photoKey,
										Buffer.from(photoBuffer),
										coversBucket,
									);
									const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
									coverUrls.push(photoUrl);
									console.log(`  ✅ Обложка загружена: ${photoUrl}`);
								} else {
									console.warn(
										`  ⚠️ Не удалось скачать изображение (пустой буфер)`,
									);
								}
							} catch (err: unknown) {
								console.error(
									`  ❌ Ошибка загрузки обложки:`,
									err instanceof Error ? err.message : "Unknown error",
								);
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

				// Если книга уже существует, добавляем информацию в details
				if (bookExists) {
					details.push({
						msgId: anyMsg.id,
						status: "skipped",
						reason: "book already exists",
						bookId: existingBookId,
						bookTitle: metadata.title,
						bookAuthor: metadata.author,
					});
				}
			}

			console.log(`📊 Всего подготовлено метаданных: ${metadataList.length}`);

			// Импортируем метаданные с дедупликацией
			console.log("💾 Импортируем метаданные с дедупликацией...");
			const resultImport =
				await this.importMetadataWithDeduplication(metadataList);

			// Объединяем details из обоих этапов
			const combinedDetails = [...details, ...resultImport.details];
			console.log("✅ Импорт метаданных завершен");

			// Общее количество пропущенных книг (из обоих этапов)
			const totalSkipped =
				resultImport.skipped +
				details.filter((d) => (d as { status: string }).status === "skipped")
					.length;

			// Выводим сводку
			console.log("\n📊 СВОДКА СИНХРОНИЗАЦИИ:");
			console.log(`   ========================================`);
			console.log(`   Обработано сообщений: ${fullMessages.length}`);
			console.log(`   Подготовлено метаданных: ${metadataList.length}`);
			console.log(`   Добавлено книг: ${resultImport.added}`);
			console.log(`   Обновлено книг: ${resultImport.updated}`);
			console.log(`   Пропущено сообщений: ${totalSkipped}`);
			console.log(`   Ошибок: ${resultImport.errors}`);
			console.log(`   Всего обработано: ${resultImport.processed}`);

			return {
				processed: resultImport.processed,
				added: resultImport.added,
				updated: resultImport.updated,
				skipped: totalSkipped,
				errors: resultImport.errors,
				details: combinedDetails,
			};
		} catch (error) {
			console.error("Error in syncBooks:", error);
			throw error;
		}
	}

	/**
	 * Импортирует метаданные из Telegram в БД с учётом последних обработанных публикаций
	 * @param metadata Массив метаданных книг для импорта
	 */
	public async importMetadataWithDeduplication(
		metadata: BookMetadata[],
	): Promise<{
		processed: number;
		added: number;
		updated: number;
		skipped: number;
		errors: number;
		details: unknown[];
	}> {
		if (!this.telegramClient) {
			throw new Error("Telegram client not initialized");
		}
		let processed = 0,
			added = 0,
			updated = 0,
			skipped = 0,
			errors = 0;
		const details: unknown[] = [];
		try {
			console.log(
				`📥 Импорт ${metadata.length} записей метаданных с дедупликацией`,
			);

			// Обрабатываем каждую запись метаданных
			for (const book of metadata) {
				const msgId = book.messageId;

				// Проверяем наличие книги в БД по нормализованному названию и автору
				const {
					checkForBookDuplicates,
					normalizeBookText,
					selectBestBookFromDuplicates,
				} = await import("../book-deduplication-service");

				const duplicateCheck = await checkForBookDuplicates(
					book.title,
					book.author,
					undefined, // publicationYear
					normalizeBookText,
				);

				// Проверка на дублирование
				if (duplicateCheck.exists && duplicateCheck.book) {
					// Книга уже существует, обновляем метаданные если нужно
					// Используем улучшенный алгоритм выбора лучшей книги и объединения данных
					const existingBook: any = duplicateCheck.book;
					let needUpdate = false;
					const updateData: { [key: string]: unknown } = {};

					// Обновляем только если новые данные лучше существующих
					if (!existingBook.description && book.description) {
						updateData.description = book.description;
						needUpdate = true;
					}

					if (
						book.genres &&
						book.genres.length > 0 &&
						(!existingBook.genres ||
							existingBook.genres.length === 0 ||
							book.genres.length > existingBook.genres.length)
					) {
						updateData.genres = book.genres;
						needUpdate = true;
					}

					if (
						book.tags &&
						book.tags.length > 0 &&
						(!existingBook.tags ||
							existingBook.tags.length === 0 ||
							book.tags.length > existingBook.tags.length)
					) {
						updateData.tags = book.tags;
						needUpdate = true;
					}

					// Обновляем обложку, если у новой книги есть обложки, а у существующей нет
					if (
						book.coverUrls &&
						book.coverUrls.length > 0 &&
						(!existingBook.cover_url || existingBook.cover_url === "")
					) {
						updateData.cover_url = book.coverUrls[0]; // Берем первую обложку
						needUpdate = true;
					}

					// Обновляем telegram_post_id для связи с публикацией в Telegram
					if (
						msgId &&
						(!existingBook.telegram_post_id ||
							existingBook.telegram_post_id === "")
					) {
						updateData.telegram_post_id = String(msgId);
						needUpdate = true;
					}

					// Если у новой книги есть файл, а у существующей - нет, обновляем
					if (book.file_url && !existingBook.file_url) {
						updateData.file_url = book.file_url;
						updateData.file_size = book.file_size;
						updateData.file_format = book.file_format;
						updateData.telegram_file_id = book.telegram_file_id;
						needUpdate = true;
					}

					// Если у книги есть состав (books.length > 0), но она не привязана к серии, создаем серию
					if (
						book.books &&
						book.books.length > 0 &&
						(!existingBook.series_id || existingBook.series_id === "")
					) {
						console.log(
							`  📚 У книги есть состав, но она не привязана к серии. Создаем серию...`,
						);

						// Создаем серию
						const seriesData: any = {
							title: book.title,
							author: book.author,
							description: book.description || existingBook.description || "",
							genres:
								book.genres && book.genres.length > 0
									? book.genres
									: existingBook.genres || [],
							tags:
								book.tags && book.tags.length > 0
									? book.tags
									: existingBook.tags || [],
							rating: book.rating || existingBook.rating || null,
							telegram_post_id: String(msgId),
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						};

						// Добавляем обложку, если она есть
						if (book.coverUrls && book.coverUrls.length > 0) {
							seriesData.cover_url = book.coverUrls[0]; // Берем первую обложку
						} else if (existingBook.cover_url) {
							seriesData.cover_url = existingBook.cover_url;
						}

						// Добавляем состав серии, если он есть
						if (book.books && book.books.length > 0) {
							// Преобразуем книги в формат series_composition
							const seriesComposition = book.books.map((b) => ({
								title: b.title,
								year: b.year,
							}));
							seriesData.series_composition = seriesComposition;
						}

						// @ts-expect-error
						const { data: insertedSeries, error: seriesError } =
							await serverSupabase
								.from("series")
								.insert(seriesData)
								.select()
								.single();
						if (seriesError) {
							console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
						} else {
							const newSeriesId = (insertedSeries as any).id;
							updateData.series_id = newSeriesId;
							needUpdate = true;
							console.log(
								`  ✅ Серия создана и привязана к книге: ${newSeriesId}`,
							);
						}
					}

					if (needUpdate) {
						console.log(
							`  🔄 Обновляем книгу "${existingBook.title}" автора ${existingBook.author}`,
						);
						// @ts-expect-error
						const { error: updateError } = await serverSupabase
							.from("books")
							.update(updateData)
							.eq("id", existingBook.id);
						if (updateError) {
							errors++;
							details.push({
								msgId,
								status: "error",
								error: updateError.message,
							});
							continue;
						}
						updated++;
						details.push({
							msgId,
							status: "updated",
							bookId: existingBook.id,
							bookTitle: existingBook.title,
							bookAuthor: existingBook.author,
						});
					} else {
						skipped++;
						// Определяем конкретную причину пропуска
						let skipReason = "metadata complete";
						if (
							existingBook.description &&
							existingBook.description !== "" &&
							(!book.description || book.description === "")
						) {
							skipReason = "existing book has description";
						} else if (
							existingBook.genres &&
							existingBook.genres.length > 0 &&
							(!book.genres || book.genres.length === 0)
						) {
							skipReason = "existing book has genres";
						} else if (
							existingBook.tags &&
							existingBook.tags.length > 0 &&
							(!book.tags || book.tags.length === 0)
						) {
							skipReason = "existing book has tags";
						} else if (
							existingBook.cover_url &&
							existingBook.cover_url !== "" &&
							(!book.coverUrls || book.coverUrls.length === 0)
						) {
							skipReason = "existing book has cover";
						} else if (
							existingBook.file_url &&
							existingBook.file_url !== "" &&
							(!book.file_url || book.file_url === "")
						) {
							skipReason = "existing book has file";
						} else if (
							existingBook.telegram_post_id &&
							existingBook.telegram_post_id !== "" &&
							!msgId
						) {
							skipReason = "existing book has telegram post id";
						} else {
							// Если у существующей книги нет преимуществ, пропускаем по причине дубликата
							skipReason = "book already exists in database";
						}

						console.log(
							`  → Пропускаем книгу "${existingBook.title}" автора ${existingBook.author} (${skipReason})`,
						);
						details.push({
							msgId,
							status: "skipped",
							reason: skipReason,
							bookTitle: existingBook.title,
							bookAuthor: existingBook.author,
						});
					}

					// Запись в telegram_processed_messages
					// @ts-expect-error
					const { error: upsertError1 } = await serverSupabase
						.from("telegram_processed_messages")
						.upsert({
							message_id: String(msgId),
							channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || "",
							book_id: existingBook.id,
							processed_at: new Date().toISOString(),
						});
					if (upsertError1) {
						errors++;
						details.push({
							msgId,
							status: "error",
							error: upsertError1.message,
						});
					}
				} else {
					// Книга не найдена — добавляем новую
					// Проверяем, есть ли у книги хотя бы название и автор
					if (!book.title || !book.author) {
						skipped++;
						console.log(
							`  → Пропускаем сообщение ${msgId} (отсутствует название или автор)`,
						);
						details.push({
							msgId,
							status: "skipped",
							reason: "missing title or author",
							bookTitle: book.title || "unknown",
							bookAuthor: book.author || "unknown",
						});
						continue;
					}

					// Проверяем, есть ли у книги состав (книги в серии)
					let seriesId = null;
					if (book.books && book.books.length > 0) {
						console.log(`  📚 У книги есть состав, создаем серию...`);

						// Создаем серию
						const seriesData: any = {
							title: book.title,
							author: book.author,
							description: book.description || "",
							genres: book.genres || [],
							tags: book.tags || [],
							rating: book.rating || null,
							telegram_post_id: String(msgId),
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						};

						// Добавляем обложку, если она есть
						if (book.coverUrls && book.coverUrls.length > 0) {
							seriesData.cover_url = book.coverUrls[0]; // Берем первую обложку
						}

						// Добавляем состав серии, если он есть
						if (book.books && book.books.length > 0) {
							// Преобразуем книги в формат series_composition
							const seriesComposition = book.books.map((b) => ({
								title: b.title,
								year: b.year,
							}));
							seriesData.series_composition = seriesComposition;
						}

						// @ts-expect-error
						const { data: insertedSeries, error: seriesError } =
							await serverSupabase
								.from("series")
								.insert(seriesData)
								.select()
								.single();
						if (seriesError) {
							console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
						} else {
							seriesId = (insertedSeries as any).id;
							console.log(`  ✅ Серия создана: ${seriesId}`);
						}
					}

					console.log(
						`  ➕ Добавляем новую книгу: "${book.title}" автора ${book.author}`,
					);
					const newBook = {
						title: book.title,
						author: book.author,
						description: book.description || "",
						genres: book.genres || [],
						tags: book.tags || [],
						rating: book.rating || null,
						telegram_post_id: String(msgId), // Используем telegram_post_id вместо telegram_file_id
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};

					// Добавляем обложку, если она есть
					if (book.coverUrls && book.coverUrls.length > 0) {
						// @ts-expect-error
						newBook.cover_url = book.coverUrls[0]; // Берем первую обложку
					}

					// Привязываем книгу к серии, если она была создана
					if (seriesId) {
						// @ts-expect-error
						newBook.series_id = seriesId;
					}

					// @ts-expect-error
					const { data: inserted, error: insertError } = await serverSupabase
						.from("books")
						.insert(newBook)
						.select()
						.single();
					if (insertError) {
						errors++;
						details.push({
							msgId,
							status: "error",
							error: insertError.message,
						});
						continue;
					}

					added++;
					// @ts-expect-error
					details.push({
						msgId,
						status: "added",
						bookId: (inserted as any).id,
						bookTitle: (inserted as any).title,
						bookAuthor: (inserted as any).author,
					});

					// Запись в telegram_processed_messages
					// @ts-expect-error
					const { error: upsertError2 } = await serverSupabase
						.from("telegram_processed_messages")
						.upsert({
							message_id: String(msgId),
							channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || "",
							// @ts-expect-error
							book_id: (inserted as any).id,
							processed_at: new Date().toISOString(),
						});
					if (upsertError2) {
						errors++;
						details.push({
							msgId,
							status: "error",
							error: upsertError2.message,
						});
					}
				}
				processed++;
			}
			console.log(
				`📊 Импорт завершен: ${processed} обработано, ${added} добавлено, ${updated} обновлено, ${skipped} пропущено, ${errors} ошибок`,
			);
			return { processed, added, updated, skipped, errors, details };
		} catch (error) {
			console.error("❌ Ошибка в importMetadataWithDeduplication:", error);
			throw error;
		}
	}
}
