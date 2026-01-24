import { resolve } from "node:path";
import { config } from "dotenv";
// Импортируем S3 сервис вместо Supabase storage
import { putObject } from "../lib/s3-service";
import { getSupabaseAdmin } from "../lib/supabase";
import { TelegramSyncService } from "../lib/telegram/sync";

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, "../../.env");
config({ path: envPath });

/**
 * Синхронизирует обложки для книг, у которых они отсутствуют
 * @param limit Количество книг для обработки
 * @returns Результат синхронизации
 */
export async function syncMissingCovers(limit?: number) {
	try {
		console.log(
			`🚀 Запуск синхронизации обложек для книг без обложек (лимит: ${limit ?? "все"})`,
		);

		// Получаем книги без обложек
		console.log("🔍 Получаем книги без обложек...");
		const supabase = getSupabaseAdmin();
		if (!supabase) {
			throw new Error("Не удалось создать клиент Supabase");
		}

		// @ts-expect-error
		const { data: booksWithoutCovers, error: fetchError } = await supabase
			.from("books")
			.select("*")
			.is("cover_url", null)
			.order("id");

		if (fetchError) {
			throw new Error(
				`Ошибка получения книг без обложек: ${fetchError.message}`,
			);
		}

		if (!booksWithoutCovers || booksWithoutCovers.length === 0) {
			console.log("✅ Нет книг без обложек");
			return {
				success: true,
				message: "Нет книг без обложек",
				processed: 0,
				updated: 0,
				skipped: 0,
				errors: 0,
			};
		}

		console.log(`📊 Найдено ${booksWithoutCovers.length} книг без обложек`);

		// Получаем экземпляр сервиса синхронизации
		const syncService = await TelegramSyncService.getInstance();

		let processed = 0;
		let updated = 0;
		let skipped = 0;
		let errors = 0;

		// Обрабатываем каждую книгу
		for (const book of booksWithoutCovers) {
			try {
				const typedBook = book as any;
				console.log(
					`📝 Обрабатываем книгу: ${typedBook.author} - ${typedBook.title}`,
				);

				// Проверяем, есть ли у книги telegram_post_id (ID сообщения с метаданными)
				if (!typedBook.telegram_post_id) {
					console.log(`  ℹ️ У книги нет telegram_post_id, пропускаем`);
					skipped++;
					continue;
				}

				// Получаем сообщение из Telegram по ID
				console.log(
					`  📥 Получаем сообщение ${typedBook.telegram_post_id} из Telegram...`,
				);
				const channel = await (
					syncService as any
				).telegramClient.getMetadataChannel();
				if (!channel) {
					throw new Error("Не удалось получить канал");
				}

				// Convert BigInteger to string for compatibility
				const channelId =
					typeof channel.id === "object" && channel.id !== null
						? (channel.id as { toString: () => string }).toString()
						: String(channel.id);

				const messages: any[] = await (
					syncService as any
				).telegramClient.getMessages(
					channelId,
					1,
					parseInt(typedBook.telegram_post_id, 10),
				);
				if (!messages || messages.length === 0) {
					console.log(`  ℹ️ Сообщение не найдено, пропускаем`);
					skipped++;
					continue;
				}

				const msg = messages[0];
				const anyMsg = msg as unknown as { [key: string]: unknown };

				// Извлекаем URL обложек из медиа-файлов сообщения
				const coverUrls: string[] = [];

				// Проверяем наличие медиа в сообщении
				if (anyMsg.media) {
					console.log(
						`  📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`,
					);

					// Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
					if (
						(anyMsg.media as { className: string }).className ===
							"MessageMediaWebPage" &&
						(anyMsg.media as { webpage?: { photo?: unknown } }).webpage?.photo
					) {
						console.log(`    → Веб-превью с фото`);
						try {
							console.log(`    → Скачиваем фото из веб-превью...`);
							const result = await Promise.race([
								(syncService as any).telegramClient.downloadMedia(
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
								console.log(`    → Загружаем в S3 Storage: ${photoKey}`);
								// Используем S3 сервис для загрузки
								const coversBucket =
									process.env.S3_COVERS_BUCKET_NAME ||
									process.env.S3_BUCKET_NAME ||
									"fiction-library-covers";
								await putObject(
									photoKey,
									Buffer.from(photoBuffer),
									coversBucket,
								);
								// Генерируем URL для Cloud.ru S3
								const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
								coverUrls.push(photoUrl);
								console.log(`    ✅ Обложка загружена: ${photoUrl}`);
							} else {
								console.warn(`    ⚠️ Не удалось скачать фото (пустой буфер)`);
							}
						} catch (err) {
							console.error(
								`    ❌ Ошибка загрузки обложки из веб-превью:`,
								err,
							);
						}
					}
					// Если это одно фото (MessageMediaPhoto)
					else if ((anyMsg.media as { photo?: unknown }).photo) {
						console.log(`    → Одиночное фото`);
						try {
							console.log(`    → Скачиваем фото...`);
							const result = await Promise.race([
								(syncService as any).telegramClient.downloadMedia(msg),
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
								console.log(`    → Загружаем в S3 Storage: ${photoKey}`);
								// Используем S3 сервис для загрузки
								const coversBucket =
									process.env.S3_COVERS_BUCKET_NAME ||
									process.env.S3_BUCKET_NAME ||
									"fiction-library-covers";
								await putObject(
									photoKey,
									Buffer.from(photoBuffer),
									coversBucket,
								);
								// Генерируем URL для Cloud.ru S3
								const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
								coverUrls.push(photoUrl);
								console.log(`    ✅ Обложка загружена: ${photoUrl}`);
							} else {
								console.warn(`    ⚠️ Не удалось скачать фото (пустой буфер)`);
							}
						} catch (err) {
							console.error(`    ❌ Ошибка загрузки обложки:`, err);
						}
					}
					// Если это документ с изображением
					else if ((anyMsg.media as { document?: unknown }).document) {
						const mimeType = (
							anyMsg.media as { document: { mimeType?: string } }
						).document.mimeType;
						if (mimeType?.startsWith("image/")) {
							console.log(
								`    → Одиночное изображение (документ: ${mimeType})`,
							);
							try {
								console.log(`    → Скачиваем изображение...`);
								const result = await Promise.race([
									(syncService as any).telegramClient.downloadMedia(msg),
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
									console.log(`    → Загружаем в S3 Storage: ${photoKey}`);
									// Используем S3 сервис для загрузки
									const coversBucket =
										process.env.S3_COVERS_BUCKET_NAME ||
										process.env.S3_BUCKET_NAME ||
										"fiction-library-covers";
									await putObject(
										photoKey,
										Buffer.from(photoBuffer),
										coversBucket,
									);
									// Генерируем URL для Cloud.ru S3
									const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
									coverUrls.push(photoUrl);
									console.log(`    ✅ Обложка загружена: ${photoUrl}`);
								} else {
									console.warn(
										`    ⚠️ Не удалось скачать изображение (пустой буфер)`,
									);
								}
							} catch (err) {
								console.error(`    ❌ Ошибка загрузки обложки:`, err);
							}
						}
					}
				}

				// Если удалось получить обложки, обновляем книгу
				if (coverUrls.length > 0) {
					console.log(`  🔄 Обновляем книгу с обложкой...`);
					const updateData: any = { cover_url: coverUrls[0] };
					// @ts-expect-error
					const { error: updateError } = await (supabase as any)
						.from("books")
						.update(updateData)
						.eq("id", typedBook.id);

					if (updateError) {
						console.error(`  ❌ Ошибка обновления книги:`, updateError);
						errors++;
					} else {
						console.log(`  ✅ Книга обновлена с обложкой`);
						updated++;
					}
				} else {
					console.log(`  ℹ️ Обложки не найдены, пропускаем`);
					skipped++;
				}

				processed++;
			} catch (error) {
				const typedBook = book as any;
				console.error(
					`❌ Ошибка обработки книги ${typedBook.author} - ${typedBook.title}:`,
					error,
				);
				errors++;
			}
		}

		console.log(
			`✅ Синхронизация обложек завершена: ${processed} обработано, ${updated} обновлено, ${skipped} пропущено, ${errors} ошибок`,
		);

		return {
			success: true,
			message: `Обработано ${processed} книг, обновлено ${updated} книг`,
			processed,
			updated,
			skipped,
			errors,
		};
	} catch (error) {
		console.error("❌ Ошибка синхронизации обложек:", error);
		return {
			success: false,
			message:
				error instanceof Error
					? error.message
					: "Неизвестная ошибка синхронизации обложек",
			processed: 0,
			updated: 0,
			skipped: 0,
			errors: 1,
		};
	}
}

// Если скрипт запущен напрямую, выполняем синхронизацию
if (require.main === module) {
	syncMissingCovers()
		.then((result) => {
			console.log("Результат синхронизации обложек:", result);
			// Принудительно завершаем скрипт через 1 секунду
			setTimeout(() => {
				console.log("🔒 Скрипт принудительно завершен");
				process.exit(0);
			}, 1000);
		})
		.catch((error) => {
			console.error("❌ Ошибка при выполнении скрипта:", error);
			// Принудительно завершаем скрипт и в случае ошибки
			setTimeout(() => {
				process.exit(1);
			}, 1000);
		});
}
