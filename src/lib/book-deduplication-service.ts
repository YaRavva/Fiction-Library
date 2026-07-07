// Улучшенная логика дедупликации для интеграции в систему
import { serverSupabase } from "./serverSupabase";

interface DuplicateBook {
	id: string;
	title: string;
	author: string;
	created_at?: string;
	file_url?: string | null;
	telegram_file_id?: string | null;
	telegram_post_id?: string | number | null;
	cover_url?: string | null;
	[key: string]: unknown;
}

interface DuplicateCheckResult {
	exists: boolean;
	book?: DuplicateBook;
	books?: DuplicateBook[];
}

export async function checkForBookDuplicates(
	title: string,
	author: string,
	normalizeText?: (text: string) => string,
): Promise<DuplicateCheckResult> {
	try {
		const normalizer = normalizeText || normalizeBookText;
		const normalizedTitle = normalizer(title);
		const normalizedAuthor = normalizer(author);

		const { data, error } = await serverSupabase
			.from("books")
			.select("*")
			.not("title", "is", null)
			.not("author", "is", null)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("Error checking for book duplicates:", error);
			return { exists: false };
		}

		const books = (data || []) as DuplicateBook[];
		const exactMatches = books.filter(
			(book) =>
				normalizer(book.title) === normalizedTitle &&
				normalizer(book.author) === normalizedAuthor,
		);

		if (exactMatches.length > 0) {
			const book = selectBestBookFromDuplicates(exactMatches);
			return {
				exists: true,
				books: exactMatches,
				book,
			};
		}

		const titleTokens = normalizedTitle
			.split(" ")
			.filter((token) => token.length >= 4);
		const authorTokens = normalizedAuthor
			.split(" ")
			.filter((token) => token.length >= 3);

		const partialMatches = books.filter((book) => {
			const bookTitle = normalizer(book.title);
			const bookAuthor = normalizer(book.author);
			const titleHitCount = titleTokens.filter((token) =>
				bookTitle.includes(token),
			).length;
			const authorHitCount = authorTokens.filter((token) =>
				bookAuthor.includes(token),
			).length;

			return (
				titleHitCount >= Math.min(2, titleTokens.length) &&
				authorHitCount >= Math.min(2, authorTokens.length)
			);
		});

		if (partialMatches.length > 0) {
			const book = selectBestBookFromDuplicates(partialMatches);
			return {
				exists: true,
				books: partialMatches,
				book,
			};
		}

		return { exists: false };
	} catch (error) {
		console.error("Error in checkForBookDuplicates:", error);
		return { exists: false };
	}
}

export function normalizeBookText(text: string): string {
	if (!text) return "";

	let normalized = text.normalize("NFKC");

	normalized = normalized.toLowerCase();

	normalized = normalized.replace(
		/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
		"",
	);

	normalized = normalized.replace(/\([^)]*\)/g, "");
	normalized = normalized.replace(/\b[rRyYоOuUeEaAnN]\s*[uU]\b/g, "");
	normalized = normalized.replace(/\b(книга|кн\.|кн|издание|изд\.)\b/g, "");
	normalized = normalized.replace(
		/\b(и др\.|и\.д\.|и\s+др|et al\.|et al|et\. al)\b/g,
		"",
	);
	normalized = normalized.replace(/[-–—]/g, " ");
	normalized = normalized.replace(/[.,;:]+/g, " ");
	normalized = normalized.trim().replace(/\s+/g, " ");

	return normalized;
}

export function selectBestBookFromDuplicates(
	books: DuplicateBook[],
): DuplicateBook | null {
	if (!books || books.length === 0) return null;

	const sortedBooks = [...books].sort(
		(a, b) => getBookQualityScore(b) - getBookQualityScore(a),
	);

	return sortedBooks[0];
}

function getBookQualityScore(book: DuplicateBook): number {
	let score = 0;
	if (book.file_url || book.telegram_file_id) score += 1_000_000;
	if (book.telegram_post_id) score += 100_000;
	if (book.cover_url) score += 10_000;
	score += new Date(book.created_at || 0).getTime() / 1_000_000_000;
	return score;
}

export async function removeBookDuplicates(
	books: DuplicateBook[],
): Promise<{ deletedCount: number; message: string }> {
	if (!books || books.length <= 1) {
		return { deletedCount: 0, message: "Нет дубликатов для удаления" };
	}

	const sortedBooks = [...books].sort(
		(a, b) => getBookQualityScore(b) - getBookQualityScore(a),
	);

	const booksToDelete = sortedBooks.slice(1);

	let deletedCount = 0;
	const errors: string[] = [];

	for (const book of booksToDelete) {
		try {
			const { error } = await serverSupabase
				.from("books")
				.delete()
				.eq("id", book.id);

			if (error) {
				errors.push(`Ошибка при удалении книги ${book.id}: ${error.message}`);
			} else {
				deletedCount++;
			}
		} catch (err) {
			errors.push(
				`Исключение при удалении книги ${book.id}: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`,
			);
		}
	}

	const message =
		errors.length > 0
			? `Удалено ${deletedCount} дубликатов из ${booksToDelete.length}, ошибок: ${errors.length}`
			: `Успешно удалено ${deletedCount} дубликатов из ${booksToDelete.length}`;

	if (typeof window !== "undefined" && (window as any).setStatsUpdateReport) {
		try {
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const reportMessage = `[${timestamp}] ${message}\n`;
			(window as any).setStatsUpdateReport(reportMessage);
		} catch (error) {
			console.error(
				"❌ Ошибка при отправке сообщения в окно результатов:",
				error,
			);
		}
	}

	return { deletedCount, message };
}
