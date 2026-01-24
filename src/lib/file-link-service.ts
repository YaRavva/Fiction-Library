import { createClient } from "@supabase/supabase-js";
import type { BookWithoutFile } from "./file-search-service";
import { putObject } from "./s3-service";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export interface FileLinkResult {
	success: boolean;
	bookId: string;
	fileUrl?: string;
	error?: string;
}

/**
 * Сервис для загрузки файлов в storage и привязки к книгам
 */
export class FileLinkService {
	private static instance: FileLinkService;
	private telegramService: any;

	public static async getInstance(): Promise<FileLinkService> {
		if (!FileLinkService.instance) {
			FileLinkService.instance = new FileLinkService();
			await FileLinkService.instance.initialize();
		}
		return FileLinkService.instance;
	}

	private async initialize() {
		try {
			const { TelegramService } = await import("./telegram/client");
			this.telegramService = await TelegramService.getInstance();
		} catch (error) {
			console.error("Ошибка инициализации Telegram сервиса:", error);
			throw error;
		}
	}

	/**
	 * Загружает файл из Telegram и сохраняет в storage
	 */
	public async downloadAndUploadFile(
		messageId: number,
		channelId: number,
		_book: BookWithoutFile,
	): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
		try {
			console.log(`📥 Загрузка файла ${messageId} из канала ${channelId}...`);

			// Получаем сообщение с файлом
			const channelEntity =
				await this.telegramService.getChannelEntityById(channelId);
			const message = await this.telegramService.getMessageById(
				channelEntity,
				messageId,
			);

			if (!message) {
				throw new Error(`Сообщение ${messageId} не найдено`);
			}

			// Загружаем файл
			const fileBuffer = await this.telegramService.downloadMedia(message);

			if (!fileBuffer || fileBuffer.length === 0) {
				throw new Error("Файл пустой или не удалось загрузить");
			}

			// Определяем имя файла и MIME тип
			// Используем подход, аналогичный file-service.ts: messageId + extension
			let fileName = `${messageId}`;
			let fileExtension = ".fb2"; // По умолчанию

			const msg = message as any;
			if (msg.media?.document) {
				const document = msg.media.document;
				// Получаем расширение из оригинального имени файла
				const docFileName = document.attributes?.find(
					(attr: any) => attr.fileName,
				)?.fileName;
				if (docFileName) {
					const ext = docFileName.split(".").pop();
					if (ext) {
						fileExtension = `.${ext}`;
					}
				}
			}

			// Формируем имя файла как messageId + extension
			fileName = `${messageId}${fileExtension}`;

			const mimeType = this.detectMimeType(fileName);

			console.log(`✅ Файл загружен: ${fileName} (${fileBuffer.length} bytes)`);

			return {
				buffer: fileBuffer,
				fileName,
				mimeType,
			};
		} catch (error) {
			console.error("Ошибка при загрузке файла:", error);
			throw error;
		}
	}

	/**
	 * Получает информацию о файле из Telegram без загрузки
	 */
	public async getFileInfo(
		messageId: number,
		channelId: number,
	): Promise<{ fileName: string; mimeType: string }> {
		try {
			console.log(
				`🔍 Получение информации о файле ${messageId} из канала ${channelId}...`,
			);

			// Получаем сообщение с файлом
			const channelEntity =
				await this.telegramService.getChannelEntityById(channelId);
			const message = await this.telegramService.getMessageById(
				channelEntity,
				messageId,
			);

			if (!message) {
				throw new Error(`Сообщение ${messageId} не найдено`);
			}

			// Определяем имя файла и MIME тип
			// Используем подход, аналогичный file-service.ts: messageId + extension
			let fileName = `${messageId}`;
			let fileExtension = ".fb2"; // По умолчанию

			const msg = message as any;
			if (msg.media?.document) {
				const document = msg.media.document;
				// Получаем расширение из оригинального имени файла
				const docFileName = document.attributes?.find(
					(attr: any) => attr.fileName,
				)?.fileName;
				if (docFileName) {
					const ext = docFileName.split(".").pop();
					if (ext) {
						fileExtension = `.${ext}`;
					}
				}
			}

			// Формируем имя файла как messageId + extension
			fileName = `${messageId}${fileExtension}`;

			const mimeType = this.detectMimeType(fileName);

			console.log(`✅ Информация о файле получена: ${fileName}`);

			return {
				fileName,
				mimeType,
			};
		} catch (error) {
			console.error("Ошибка при получении информации о файле:", error);
			throw error;
		}
	}

	/**
	 * Сохраняет файл в S3 бакет
	 */
	public async uploadToStorage(
		fileName: string,
		buffer: Buffer,
		_mimeType: string,
	): Promise<string> {
		try {
			console.log(`☁️ Загрузка файла в S3: ${fileName}...`);

			// Используем имя файла как есть, без добавления временных меток
			// Это соответствует подходу в file-service.ts
			const storagePath = fileName;

			// Загружаем файл в S3 бакет
			const bucketName = process.env.S3_BUCKET_NAME;
			if (!bucketName) {
				throw new Error("S3_BUCKET_NAME environment variable is not set.");
			}
			await putObject(storagePath, buffer, bucketName);

			console.log(`✅ Файл загружен в S3: ${storagePath}`);

			return storagePath;
		} catch (error) {
			console.error("Ошибка при загрузке в S3:", error);
			throw error;
		}
	}

	/**
	 * Привязывает файл к книге в базе данных
	 */
	public async linkFileToBook(
		bookId: string,
		storagePath: string,
		fileName: string,
		fileSize: number,
		_mimeType: string,
		telegramFileId?: string,
	): Promise<FileLinkResult> {
		try {
			// Формируем URL файла в S3
			const bucketName = process.env.S3_BUCKET_NAME;
			if (!bucketName) {
				throw new Error("S3_BUCKET_NAME environment variable is not set.");
			}
			const fileUrl = `https://${bucketName}.s3.cloud.ru/${storagePath}`;

			// Определяем формат файла
			const fileFormat = this.detectFileFormat(fileName);

			// Обновляем запись книги
			const { data, error } = await supabaseAdmin
				.from("books")
				.update({
					file_url: fileUrl,
					file_size: fileSize,
					file_format: fileFormat,
					telegram_file_id: telegramFileId,
					updated_at: new Date().toISOString(),
				})
				.eq("id", bookId)
				.select()
				.single();

			if (error) {
				throw new Error(`Ошибка обновления книги: ${error.message}`);
			}

			return {
				success: true,
				bookId,
				fileUrl,
			};
		} catch (error) {
			console.error("Ошибка при привязке файла к книге:", error);

			return {
				success: false,
				bookId,
				error: error instanceof Error ? error.message : "Неизвестная ошибка",
			};
		}
	}

	/**
	 * Привязывает уже существующий файл в storage к книге
	 */
	public async linkExistingFileToBook(
		bookId: string,
		storagePath: string,
		fileName: string,
		_mimeType: string,
		// Добавляем параметры для проверки соответствия
		expectedFileSize?: number,
		_expectedFileExtension?: string,
	): Promise<FileLinkResult> {
		try {
			// Формируем URL файла в S3
			const bucketName = process.env.S3_BUCKET_NAME;
			if (!bucketName) {
				throw new Error("S3_BUCKET_NAME environment variable is not set.");
			}
			const fileUrl = `https://${bucketName}.s3.cloud.ru/${storagePath}`;

			// Определяем формат файла
			const fileFormat = this.detectFileFormat(fileName);

			// Обновляем запись книги
			const { data, error } = await supabaseAdmin
				.from("books")
				.update({
					file_url: fileUrl,
					file_size: expectedFileSize || 0,
					file_format: fileFormat,
					updated_at: new Date().toISOString(),
				})
				.eq("id", bookId)
				.select()
				.single();

			if (error) {
				throw new Error(`Ошибка обновления книги: ${error.message}`);
			}

			return {
				success: true,
				bookId,
				fileUrl,
			};
		} catch (error) {
			console.error("Ошибка при привязке существующего файла к книге:", error);

			return {
				success: false,
				bookId,
				error: error instanceof Error ? error.message : "Неизвестная ошибка",
			};
		}
	}

	/**
	 * Выполняет полный процесс: загрузка файла и привязка к книге
	 */
	public async processFileForBook(
		messageId: number,
		channelId: number,
		book: BookWithoutFile,
	): Promise<FileLinkResult> {
		try {
			console.log(
				`🚀 Начало обработки файла для книги: ${book.title} - ${book.author}`,
			);

			// Шаг 1: Загружаем файл из Telegram
			const { buffer, fileName, mimeType } = await this.downloadAndUploadFile(
				messageId,
				channelId,
				book,
			);

			// Шаг 2: Загружаем в storage
			const storagePath = await this.uploadToStorage(
				fileName,
				buffer,
				mimeType,
			);

			// Шаг 3: Привязываем к книге
			const result = await this.linkFileToBook(
				book.id,
				storagePath,
				fileName,
				buffer.length,
				mimeType,
			);

			if (result.success) {
				console.log(`✅ Файл успешно обработан и привязан к книге`);
			}

			return result;
		} catch (error) {
			console.error("Ошибка при обработке файла:", error);

			return {
				success: false,
				bookId: book.id,
				error: error instanceof Error ? error.message : "Неизвестная ошибка",
			};
		}
	}

	/**
	 * Определяет MIME тип по имени файла
	 */
	private detectMimeType(fileName: string): string {
		const ext = fileName.toLowerCase().split(".").pop();

		switch (ext) {
			case "fb2":
				return "application/fb2";
			case "epub":
				return "application/epub+zip";
			case "pdf":
				return "application/pdf";
			case "txt":
				return "text/plain";
			case "zip":
				return "application/zip";
			case "rar":
				return "application/x-rar-compressed";
			default:
				return "application/octet-stream";
		}
	}

	/**
	 * Определяет формат файла по имени
	 */
	private detectFileFormat(fileName: string): string {
		const ext = fileName.toLowerCase().split(".").pop();

		switch (ext) {
			case "fb2":
				return "fb2";
			case "epub":
				return "epub";
			case "pdf":
				return "pdf";
			case "txt":
				return "txt";
			case "zip":
				return "zip";
			case "rar":
				return "rar";
			default:
				return "fb2"; // По умолчанию считаем fb2
		}
	}
}
