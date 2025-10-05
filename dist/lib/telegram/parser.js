"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataParser = void 0;
var MetadataParser = /** @class */ (function () {
    function MetadataParser() {
    }
    MetadataParser.extractAuthor = function (text) {
        var match = text.match(/Автор:\s*([^\n]+)/);
        return match ? match[1].trim() : '';
    };
    MetadataParser.extractTitle = function (text) {
        var match = text.match(/Название:\s*([^\n]+)/);
        return match ? match[1].trim() : '';
    };
    MetadataParser.extractSeries = function (text) {
        var match = text.match(/Название:\s*([^\n]+)/);
        if (match) {
            var title = match[1].trim();
            // Если есть слово "цикл", это серия
            if (title.toLowerCase().includes('цикл')) {
                return title;
            }
        }
        return undefined;
    };
    MetadataParser.extractGenres = function (text) {
        var genres = [];
        // Ищем строку "Жанр:" и извлекаем хештеги из неё
        var genreMatch = text.match(/Жанр:\s*([^\n]+)/);
        if (genreMatch) {
            var genreLine = genreMatch[1];
            var hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
            var match = void 0;
            while ((match = hashtagRegex.exec(genreLine)) !== null) {
                var genre = match[1];
                // Исключаем служебные теги
                if (!genre.includes('выше') && !genre.includes('законченсерия')) {
                    genres.push(genre);
                }
            }
        }
        return genres;
    };
    MetadataParser.extractTags = function (text) {
        var tags = [];
        // Извлекаем все хештеги из текста
        var hashtagRegex = /#([а-яА-Яa-zA-Z0-9]+)/g;
        var match;
        while ((match = hashtagRegex.exec(text)) !== null) {
            var tag = match[1];
            // Исключаем служебные теги
            if (!tag.includes('выше')) {
                tags.push(tag);
            }
        }
        return tags;
    };
    MetadataParser.extractRating = function (text) {
        var match = text.match(/Рейтинг:\s*(\d+[.,]\d+)/);
        if (match) {
            return parseFloat(match[1].replace(',', '.'));
        }
        return 0;
    };
    MetadataParser.extractDescription = function (text) {
        // Ищем текст между рейтингом и "Состав:" или концом сообщения
        // Сначала находим позицию после рейтинга
        var ratingMatch = text.match(/Рейтинг:\s*\d+[.,]\d+[^\n]*\n/);
        if (!ratingMatch) {
            return '';
        }
        var startPos = (ratingMatch.index || 0) + ratingMatch[0].length;
        var afterRating = text.substring(startPos);
        // Ищем "Состав:" или конец текста
        var compositionMatch = afterRating.match(/Состав:/);
        var endPos = compositionMatch ? compositionMatch.index : afterRating.length;
        if (endPos === undefined) {
            return '';
        }
        // Извлекаем описание и очищаем от лишних пробелов
        var description = afterRating.substring(0, endPos).trim();
        return description;
    };
    MetadataParser.extractBooks = function (text) {
        var books = [];
        // Ищем секцию "Состав:" и извлекаем книги
        var seriesMatch = text.match(/Состав:([^]*?)(?=\n{2,}|$)/i);
        if (seriesMatch) {
            var booksText = seriesMatch[1];
            // Регулярное выражение для извлечения книг в формате "N. Название (Год)"
            var bookRegex = /\d+\.\s+([^\(\n]+?)\s*\((\d{4})\)/g;
            var bookMatch = void 0;
            while ((bookMatch = bookRegex.exec(booksText)) !== null) {
                var title = bookMatch[1].trim();
                var year = parseInt(bookMatch[2]);
                // Проверяем, что название и год корректны
                if (title && !isNaN(year) && year > 1900 && year <= new Date().getFullYear() + 10) {
                    books.push({
                        title: title,
                        year: year
                    });
                }
            }
        }
        return books;
    };
    MetadataParser.parseMessage = function (text) {
        var series = this.extractSeries(text);
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
    };
    return MetadataParser;
}());
exports.MetadataParser = MetadataParser;
