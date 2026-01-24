export interface BookMetadata {
	author: string;
	title: string;
	series?: string; // Название серии (если есть)
	genres: string[]; // Жанры из строки "Жанр:"
	tags: string[]; // Теги (хештеги)
	rating: number;
	description: string;
	books: {
		title: string;
		year: number;
	}[];
	coverUrls?: string[]; // URL обложек из сообщения
	messageId?: number; // ID сообщения в Telegram (для отслеживания обработанных сообщений)
}

export class MetadataParser {
	private static extractAuthor(text: string): string {
		const match = text.match(/Автор:\s*([^\n]+)/);
		return match ? match[1].trim() : "";
	}

	private static extractTitle(text: string): string {
		const match = text.match(/Название:\s*([^\n]+)/);
		return match ? match[1].trim() : "";
	}

	private static extractSeries(text: string): string | undefined {
		// Проверяем, есть ли в тексте слово "Состав:"
		if (text.includes("Состав:")) {
			// Если есть, извлекаем название из поля "Название:"
			const match = text.match(/Название:\s*([^\n]+)/);
			return match ? match[1].trim() : undefined;
		}
		return undefined;
	}

	private static extractGenres(text: string): string[] {
		const genres: string[] = [];

		// Ищем строку "Жанр:" и извлекаем хештеги из неё, учитывая переносы строк
		const genreMatch = text.match(/Жанр:\s*([^\n]+(?:\n[^\n]+)*)/);
		if (genreMatch) {
			const genreLine = genreMatch[1];
			const hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
			let match;

			while ((match = hashtagRegex.exec(genreLine)) !== null) {
				const genre = match[1];
				// Исключаем служебные теги
				if (!genre.includes("выше") && !genre.includes("законченсерия")) {
					genres.push(genre);
				}
			}
		}

		return genres;
	}

	private static extractTags(text: string): string[] {
		const tags: string[] = [];

		// Извлекаем все хештеги из текста
		const hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
		let match;

		while ((match = hashtagRegex.exec(text)) !== null) {
			const tag = match[1];
			// Исключаем служебные теги
			if (!tag.includes("выше")) {
				tags.push(tag);
			}
		}

		return tags;
	}

	private static extractRating(text: string): number {
		const match = text.match(/Рейтинг:\s*(\d+[.,]\d+)/);
		if (match) {
			return parseFloat(match[1].replace(",", "."));
		}
		return 0;
	}

	private static extractDescription(text: string): string {
		// Ищем текст между рейтингом и "Состав:" или концом сообщения
		// Сначала находим позицию после рейтинга
		const ratingMatch = text.match(/Рейтинг:\s*[^\n]*\n/);
		if (!ratingMatch) {
			return "";
		}

		const startPos = (ratingMatch.index || 0) + ratingMatch[0].length;
		const afterRating = text.substring(startPos);

		// Ищем "Состав:" или конец текста
		const compositionMatch = afterRating.match(/Состав:/);
		const endPos = compositionMatch
			? compositionMatch.index
			: afterRating.length;

		if (endPos === undefined) {
			return "";
		}

		// Извлекаем описание и очищаем от лишних пробелов
		const description = afterRating.substring(0, endPos).trim();
		return description;
	}

	private static extractBooks(text: string): { title: string; year: number }[] {
		const books: { title: string; year: number }[] = [];

		// Ищем секцию "Состав:" и извлекаем книги
		const seriesMatch = text.match(/Состав:([^]*?)(?=\n{2,}|$)/i);

		if (seriesMatch) {
			const booksText = seriesMatch[1];
			// Регулярное выражение для извлечения книг в формате "N. Название (Год)" или просто "Название (Год)"
			const bookRegex = /(?:\d+\.\s*)?([^(\n]+?)\s*\((\d{4})\)/g;
			let bookMatch;

			while ((bookMatch = bookRegex.exec(booksText)) !== null) {
				const title = bookMatch[1].trim();
				const year = parseInt(bookMatch[2], 10);

				// Проверяем, что название и год корректны
				if (
					title &&
					!Number.isNaN(year) &&
					year > 1900 &&
					year <= new Date().getFullYear() + 10
				) {
					books.push({
						title: title,
						year: year,
					});
				}
			}
		}

		return books;
	}

	public static parseMessage(text: string): BookMetadata {
		const series = MetadataParser.extractSeries(text);

		return {
			author: MetadataParser.extractAuthor(text),
			title: MetadataParser.extractTitle(text),
			series: series,
			genres: MetadataParser.extractGenres(text),
			tags: MetadataParser.extractTags(text),
			rating: MetadataParser.extractRating(text),
			description: MetadataParser.extractDescription(text),
			books: MetadataParser.extractBooks(text),
		};
	}
}
