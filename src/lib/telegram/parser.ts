import { TelegramService } from './client';

export interface BookMetadata {
    author: string;
    title: string;
    series?: string;        // Название серии (если есть)
    genres: string[];       // Жанры из строки "Жанр:"
    tags: string[];         // Теги (хештеги)
    rating: number;
    description: string;
    books: {
        title: string;
        year: number;
    }[];
    coverUrls?: string[];   // URL обложек из сообщения
}

export class MetadataParser {
    private static extractAuthor(text: string): string {
        const match = text.match(/Автор:\s*([^\n]+)/);
        return match ? match[1].trim() : '';
    }

    private static extractTitle(text: string): string {
        const match = text.match(/Название:\s*([^\n]+)/);
        if (match) {
            const title = match[1].trim();
            // Убираем префикс "цикл" если есть, чтобы получить название серии
            return title;
        }
        return '';
    }

    private static extractSeries(text: string): string | undefined {
        const match = text.match(/Название:\s*([^\n]+)/);
        if (match) {
            const title = match[1].trim();
            // Если есть слово "цикл", это серия
            if (title.toLowerCase().includes('цикл')) {
                return title;
            }
        }
        return undefined;
    }

    private static extractGenres(text: string): string[] {
        const genres: string[] = [];

        // Ищем строку "Жанр:" и извлекаем хештеги из неё
        const genreMatch = text.match(/Жанр:\s*([^\n]+)/);
        if (genreMatch) {
            const genreLine = genreMatch[1];
            const hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
            let match;

            while ((match = hashtagRegex.exec(genreLine)) !== null) {
                const genre = match[1];
                // Исключаем служебные теги
                if (!genre.includes('выше') && !genre.includes('законченсерия')) {
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
            if (!tag.includes('выше')) {
                tags.push(tag);
            }
        }

        return tags;
    }

    private static extractRating(text: string): number {
        const match = text.match(/Рейтинг:\s*(\d+[.,]\d+)/);
        if (match) {
            return parseFloat(match[1].replace(',', '.'));
        }
        return 0;
    }

    private static extractDescription(text: string): string {
        // Ищем текст между рейтингом и "Состав:" или концом сообщения
        // Сначала находим позицию после рейтинга
        const ratingMatch = text.match(/Рейтинг:\s*\d+[.,]\d+[^\n]*\n/);
        if (!ratingMatch) {
            return '';
        }

        const startPos = (ratingMatch.index || 0) + ratingMatch[0].length;
        const afterRating = text.substring(startPos);

        // Ищем "Состав:" или конец текста
        const compositionMatch = afterRating.match(/Состав:/);
        const endPos = compositionMatch ? compositionMatch.index : afterRating.length;

        if (endPos === undefined) {
            return '';
        }

        // Извлекаем описание и очищаем от лишних пробелов
        const description = afterRating.substring(0, endPos).trim();
        return description;
    }

    private static extractBooks(text: string): { title: string; year: number; }[] {
        const books: { title: string; year: number; }[] = [];
        const seriesMatch = text.match(/Состав:([^]*?)(?=\n\n|$)/);

        if (seriesMatch) {
            const booksText = seriesMatch[1];
            const bookRegex = /\d+\.\s+([^\(\n]+)\s*\((\d{4})\)/g;
            let bookMatch;

            while ((bookMatch = bookRegex.exec(booksText)) !== null) {
                books.push({
                    title: bookMatch[1].trim(),
                    year: parseInt(bookMatch[2])
                });
            }
        }

        return books;
    }

    public static parseMessage(text: string): BookMetadata {
        const series = this.extractSeries(text);

        return {
            author: this.extractAuthor(text),
            title: this.extractTitle(text),
            series: series,
            genres: this.extractGenres(text),
            tags: this.extractTags(text),
            rating: this.extractRating(text),
            description: this.extractDescription(text),
            books: this.extractBooks(text)
        };
    }
}