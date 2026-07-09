export interface BookMetadata {
	author: string;
	title: string;
	series?: string;
	genres: string[];
	tags: string[];
	rating: number;
	description: string;
	books: {
		title: string;
		year: number;
	}[];
	coverUrls?: string[];
	messageId?: number;
	file_url?: string;
	file_size?: number;
	file_format?: string;
	telegram_file_id?: string;
}

function extractAuthor(text: string): string {
	const match = text.match(/Автор:\s*([^\n]+)/);
	return match ? match[1].trim() : "";
}

function extractTitle(text: string): string {
	const match = text.match(/Название:\s*([^\n]+)/);
	return match ? match[1].trim() : "";
}

function extractSeries(text: string): string | undefined {
	if (text.includes("Состав:")) {
		const match = text.match(/Название:\s*([^\n]+)/);
		return match ? match[1].trim() : undefined;
	}
	return undefined;
}

function extractGenres(text: string): string[] {
	const genres: string[] = [];

	const genreMatch = text.match(/Жанр:\s*([^\n]+(?:\n[^\n]+)*)/);
	if (genreMatch) {
		const genreLine = genreMatch[1];
		const hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
		let match: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
		while ((match = hashtagRegex.exec(genreLine)) !== null) {
			const genre = match[1];
			if (!genre.includes("выше") && !genre.includes("законченсерия")) {
				genres.push(genre);
			}
		}
	}

	return genres;
}

function extractTags(text: string): string[] {
	const tags: string[] = [];

	const hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
	while ((match = hashtagRegex.exec(text)) !== null) {
		const tag = match[1];
		if (!tag.includes("выше")) {
			tags.push(tag);
		}
	}

	return tags;
}

function extractRating(text: string): number {
	const match = text.match(/Рейтинг:\s*(\d+[.,]\d+)/);
	if (match) {
		return parseFloat(match[1].replace(",", "."));
	}
	return 0;
}

function extractDescription(text: string): string {
	const ratingMatch = text.match(/Рейтинг:\s*[^\n]*\n/);
	if (!ratingMatch) {
		return "";
	}

	const startPos = (ratingMatch.index || 0) + ratingMatch[0].length;
	const afterRating = text.substring(startPos);

	const compositionMatch = afterRating.match(/Состав:/);
	const endPos = compositionMatch ? compositionMatch.index : afterRating.length;

	if (endPos === undefined) {
		return "";
	}

	const description = afterRating.substring(0, endPos).trim();
	return description;
}

function extractBooks(text: string): { title: string; year: number }[] {
	const books: { title: string; year: number }[] = [];

	const seriesMatch = text.match(/Состав:([\s\S]*?)(?=\n{2,}|$)/i);

	if (seriesMatch) {
		const booksText = seriesMatch[1];
		const bookRegex = /(?:\d+\.\s*)?([^(\n]+?)\s*\((\d{4})\)/g;
		let bookMatch: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
		while ((bookMatch = bookRegex.exec(booksText)) !== null) {
			const title = bookMatch[1].trim();
			const year = parseInt(bookMatch[2], 10);

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

export function parseMessage(text: string): BookMetadata {
	const series = extractSeries(text);

	return {
		author: extractAuthor(text),
		title: extractTitle(text),
		series: series,
		genres: extractGenres(text),
		tags: extractTags(text),
		rating: extractRating(text),
		description: extractDescription(text),
		books: extractBooks(text),
	};
}

export const MetadataParser = {
	extractAuthor,
	extractTitle,
	extractSeries,
	extractGenres,
	extractTags,
	extractRating,
	extractDescription,
	extractBooks,
	parseMessage,
};
