import { createClient } from "@supabase/supabase-js";
import { FileBookMatcherService } from "./file-book-matcher-service";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export interface BookWithoutFile {
	id: string;
	title: string;
	author: string;
	publication_year?: number;
	series_title?: string;
	series_order?: number;
	created_at: string;
}

export interface TelegramFile {
	message_id: number;
	file_name?: string;
	file_size?: number;
	mime_type?: string;
	caption?: string;
	date: number;
}

export interface FileSearchResult {
	book: BookWithoutFile;
	matches: TelegramFile[];
	score: number;
}

/**
 * Сервис для полуавтоматического поиска файлов для книг без файлов
 */
export class FileSearchService {
	private static instance: FileSearchService;

	public static async getInstance(): Promise<FileSearchService> {
		if (!FileSearchService.instance) {
			FileSearchService.instance = new FileSearchService();
		}
		return FileSearchService.instance;
	}

	/**
	 * Находит все книги без файлов в базе данных
	 */
	public async findBooksWithoutFiles(
		limit: number = 100,
	): Promise<BookWithoutFile[]> {
		try {
			console.log(`🔍 Поиск книг без файлов (лимит: ${limit})...`);

			// Ищем книги без файлов (file_url IS NULL или пустая строка)
			const { data, error } = await supabaseAdmin
				.from("books")
				.select(`
          id,
          title,
          author,
          publication_year,
          series_order,
          created_at,
          series:series_id (
            title
          )
        `)
				.or("file_url.is.null,file_url.eq.")
				.order("created_at", { ascending: false })
				.limit(limit);

			if (error) {
				throw new Error(`Ошибка при поиске книг без файлов: ${error.message}`);
			}

			// Преобразуем данные в нужный формат
			const books: BookWithoutFile[] = (data || []).map((book) => {
				const series = Array.isArray(book.series)
					? book.series[0]
					: book.series;
				return {
					id: book.id,
					title: book.title,
					author: book.author,
					publication_year: book.publication_year,
					series_title: series?.title,
					series_order: book.series_order,
					created_at: book.created_at,
				};
			});

			console.log(`✅ Найдено ${books.length} книг без файлов`);
			return books;
		} catch (error) {
			console.error("Ошибка при поиске книг без файлов:", error);
			throw error;
		}
	}

	/**
	 * Получает список файлов из Telegram канала
	 */
	public async getTelegramFiles(
		channelId: number,
		limit: number = 1000,
	): Promise<TelegramFile[]> {
		try {
			console.log(
				`📁 Получение файлов из Telegram канала ${channelId} (лимит: ${limit})...`,
			);

			// Здесь будет интеграция с Telegram API для получения списка файлов
			// Пока заглушка - в реальности нужно использовать TelegramService
			const { TelegramService } = await import("./telegram/client");

			const telegramService = await TelegramService.getInstance();
			const channelEntity =
				await telegramService.getChannelEntityById(channelId);

			if (!channelEntity) {
				throw new Error(`Не удалось получить доступ к каналу ${channelId}`);
			}

			// Получаем все сообщения из канала
			const messages = await telegramService.getAllMessages(channelEntity, 100);

			// Фильтруем только сообщения с файлами
			const files: TelegramFile[] = [];

			for (const message of messages) {
				// Приводим к типу any для работы с Telegram API
				const msg = message as any;

				if (msg.media?.document) {
					const document = msg.media.document;
					const fileName =
						document.attributes?.find((attr: any) => attr.fileName)?.fileName ||
						"unknown";
					const fileSize = document.size || 0;
					const mimeType = document.mimeType || "application/octet-stream";

					files.push({
						message_id: msg.id,
						file_name: fileName,
						file_size: fileSize,
						mime_type: mimeType,
						caption: msg.message || "",
						date: msg.date,
					});
				}
			}

			console.log(`✅ Получено ${files.length} файлов из Telegram`);
			return files.slice(0, limit);
		} catch (error) {
			console.error("Ошибка при получении файлов из Telegram:", error);
			throw error;
		}
	}

	/**
	 * Выполняет релевантный поиск файлов для книги
	 */
	public searchFilesForBook(
		book: BookWithoutFile,
		telegramFiles: TelegramFile[],
	): FileSearchResult {
		console.log(`🔎 Поиск файлов для книги: "${book.title}" - ${book.author}`);

		// Преобразуем TelegramFile в формат, подходящий для UniversalFileMatcher
		const filesForMatching = telegramFiles.map((file) => ({
			message_id: file.message_id,
			file_name: file.file_name || "",
			mime_type: file.mime_type || "unknown",
			file_size: file.file_size,
		}));

		// Используем универсальный сервис для сопоставления
		const matches = FileBookMatcherService.findBestMatchesForBook(
			book,
			filesForMatching,
		);

		// Преобразуем результаты обратно к исходному формату
		const telegramMatches: TelegramFile[] = [];
		let bestScore = 0;

		for (const match of matches) {
			const originalFile = telegramFiles.find(
				(f) => f.message_id === match.file.message_id,
			);
			if (originalFile) {
				telegramMatches.push({
					...originalFile,
					// Добавляем кастомное поле для сортировки
					relevance_score: match.score,
				} as any);

				if (match.score > bestScore) {
					bestScore = match.score;
				}
			}
		}

		// Сортируем по релевантности
		telegramMatches.sort(
			(a, b) => (b as any).relevance_score - (a as any).relevance_score,
		);

		return {
			book,
			matches: telegramMatches.slice(0, 20), // Возвращаем топ 20 результатов
			score: bestScore,
		};
	}

	/**
	 * Выполняет поиск файлов для всех книг без файлов
	 */
	public async searchFilesForAllBooks(
		books: BookWithoutFile[],
		telegramFiles: TelegramFile[],
	): Promise<FileSearchResult[]> {
		console.log(`🔍 Запуск поиска файлов для ${books.length} книг...`);

		const results: FileSearchResult[] = [];

		for (const book of books) {
			const result = this.searchFilesForBook(book, telegramFiles);
			if (result.matches.length > 0) {
				results.push(result);
			}
		}

		// Сортируем по лучшему совпадению
		results.sort((a, b) => b.score - a.score);

		console.log(
			`✅ Поиск завершен. Найдено совпадений для ${results.length} книг`,
		);
		return results;
	}
}
