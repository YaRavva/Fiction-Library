/**
 * Универсальный алгоритм релевантного поиска файлов для книг
 *
 * Правила:
 * 1. Нормализация: NFC, нижний регистр, "ё" → "е"
 * 2. Разбиение слов: все возможные варианты, союзы и слово "цикл" отбрасываются
 * 3. Алгоритм поиска: ищем совпадение каждого из слов, полученных из имени файла, с массивом слов, полученных из автора и названия книги
 * 4. Веса: 20 баллов за каждое совпадение
 * 5. Порог: 50
 * 6. Формат файла: не учитывается
 * 7. MIME-типы: не фильтруются
 */

interface BookWithoutFile {
	id: string;
	title: string;
	author: string;
	publication_year?: number;
}

interface FileOption {
	message_id: number;
	file_name: string;
	mime_type: string;
	// другие поля могут быть добавлены по необходимости
}

interface FileMatchResult {
	file: FileOption;
	score: number;
	matchedWords: string[];
}

interface WordExtractionResult {
	allWords: string[];
	titleWords: string[];
	authorWords: string[];
}

export class UniversalFileMatcher {
	// Список русских союзов, которые будут исключаться из анализа
	private static readonly CONJUNCTIONS = [
		"и",
		"или",
		"а",
		"но",
		"да",
		"же",
		"ли",
		"бы",
		"б",
		"в",
		"во",
		"на",
		"над",
		"под",
		"при",
		"через",
		"с",
		"со",
		"у",
		"о",
		"об",
		"от",
		"до",
		"за",
		"из",
		"к",
		"ко",
		"по",
		"не",
		"ни",
		"же",
	];

	// Список дополнительных элементов, которые нужно исключать
	private static readonly ADDITIONAL_EXCLUSIONS = [
		"цикл",
		"серия",
		"серии",
		"книга",
		"том",
		"тома",
		"собрание",
		"издание",
		"издательство",
		"ru",
		"en",
		"рус",
		"eng",
		"язык",
		"перевод",
		"автор",
		"редакция",
		"иллюстрации",
		"pdf",
		"fb2",
		"epub",
		"mobi",
		"djvu",
		"doc",
		"txt",
	];

	// Регулярные выражения для удаления специальных элементов
	private static readonly YEAR_REGEX = /\(\d{4}\)/g; // Годы в скобках
	private static readonly LANG_REGEX = /\b(?:ru|en|rus|eng|рус|англ)\b/gi; // Языковые обозначения
	private static readonly FILE_EXT_REGEX = /\.[a-zA-Z]{2,4}$/; // Файловые расширения

	/**
	 * Нормализует строку: NFC, нижний регистр, "ё" → "е"
	 */
	private static normalizeString(str: string): string {
		if (!str) return "";
		return str.normalize("NFC").toLowerCase().replace(/ё/g, "е");
	}

	/**
	 * Извлекает и очищает слова из строки с учетом различных разделителей и исключений
	 */
	private static extractWords(str: string): string[] {
		if (!str) return [];

		// Удаляем расширение файла, если есть
		let normalized = str.replace(UniversalFileMatcher.FILE_EXT_REGEX, "");

		// Удаляем года в скобках
		normalized = normalized.replace(UniversalFileMatcher.YEAR_REGEX, " ");

		// Удаляем языковые обозначения
		normalized = normalized.replace(UniversalFileMatcher.LANG_REGEX, " ");

		// Нормализуем строку
		normalized = UniversalFileMatcher.normalizeString(normalized);

		// Разделители: пробелы, дефисы, скобки, точки, запятые, другие специальные символы
		const words = normalized
			.split(/[\s\-_()[\]{}/\\.,"'`~!@#$%^&*+=|;:<>?]+/)
			.map((word) => word.trim())
			.filter((word) => word.length > 1); // Убираем слова короче 2 символов

		// Убираем союзы, слово "цикл" и дополнительные элементы
		return words.filter(
			(word) =>
				!UniversalFileMatcher.CONJUNCTIONS.includes(word) &&
				!UniversalFileMatcher.ADDITIONAL_EXCLUSIONS.includes(word) &&
				word !== "цикл",
		);
	}

	/**
	 * Извлекает слова из книги (название и автор)
	 */
	public static extractBookWords(book: BookWithoutFile): WordExtractionResult {
		const titleWords = UniversalFileMatcher.extractWords(book.title || "");
		const authorWords = UniversalFileMatcher.extractWords(book.author || "");

		// Объединяем слова из названия и автора
		const allWords = [...new Set([...titleWords, ...authorWords])]; // Уникальные слова

		return {
			allWords,
			titleWords,
			authorWords,
		};
	}

	/**
	 * Проверяет, является ли файл релевантным для книги по универсальному алгоритму
	 */
	public static matchFileToBook(
		file: FileOption,
		book: BookWithoutFile,
	): FileMatchResult {
		const bookWords = UniversalFileMatcher.extractBookWords(book);
		const fileWords = UniversalFileMatcher.extractWords(file.file_name || "");

		if (bookWords.allWords.length === 0 || fileWords.length === 0) {
			return {
				file,
				score: 0,
				matchedWords: [],
			};
		}

		// Проверяем совпадения слов из файла с словами из книги
		const matchedWords: string[] = [];
		let score = 0;

		// Подсчитываем количество совпадений и несовпадений
		let matchedCount = 0;
		let unmatchedCount = 0;

		for (const fileWord of fileWords) {
			// Проверяем, есть ли точное совпадение с любым словом из книги
			const matchFound = bookWords.allWords.some(
				(bookWord) => bookWord === fileWord,
			);

			if (matchFound) {
				matchedWords.push(fileWord);
				score += 20; // 20 баллов за каждое совпадение слова
				matchedCount++;
			} else {
				unmatchedCount++;
			}
		}

		// Вычисляем штраф за лишние слова в файле, которые не встречаются в книге
		const unmatchedFileWords = fileWords.filter(
			(fileWord) =>
				!bookWords.allWords.some((bookWord) => bookWord === fileWord),
		);

		// Более высокий штраф за лишние слова, особенно если их много
		// Это предотвратит ситуации, когда файл содержит слова, не относящиеся к книге
		const penalty = unmatchedFileWords.length * 10; // Увеличенный штраф за лишние слова в файле
		score = Math.max(0, score - penalty); // Убедимся, что оценка не становится отрицательной

		// Также добавим штраф, пропорциональный количеству слов в файле, которые не совпадают
		const proportionalPenalty = unmatchedCount * 5;
		score = Math.max(0, score - proportionalPenalty);

		// Проверим, насколько высока доля совпадений
		// Если большинство слов совпадают, добавим бонус за хорошее соответствие
		if (fileWords.length > 0) {
			const matchRatio = matchedCount / fileWords.length;
			if (matchRatio >= 0.8) {
				// Если 80% и более слов совпадают, добавим бонус
				const matchBonus = Math.floor(20 * matchRatio * 4); // Пропорционально соотношению совпадений
				score += matchBonus;
			}
		}

		// Проверим, есть ли полное совпадение по ключевым словам (автор и основное название)
		// Для этого используем более точное сравнение
		const fileAuthorWords = UniversalFileMatcher.extractWords(
			UniversalFileMatcher.extractAuthorFromFilename(file.file_name || ""),
		);
		const bookAuthorWords = UniversalFileMatcher.extractWords(
			book.author || "",
		);

		const fileTitleWords = UniversalFileMatcher.extractWords(
			UniversalFileMatcher.extractTitleFromFilename(file.file_name || ""),
		);
		const bookTitleWords = UniversalFileMatcher.extractWords(book.title || "");

		// Проверяем совпадение автора
		let authorMatchCount = 0;
		for (const fileAuthorWord of fileAuthorWords) {
			if (bookAuthorWords.includes(fileAuthorWord)) {
				authorMatchCount++;
			}
		}

		// Проверяем совпадение названия
		let titleMatchCount = 0;
		for (const fileTitleWord of fileTitleWords) {
			if (bookTitleWords.includes(fileTitleWord)) {
				titleMatchCount++;
			}
		}

		// Если есть полное (или почти полное) совпадение по автору и названию, добавим бонус
		const authorFullMatch =
			fileAuthorWords.length > 0 && authorMatchCount === fileAuthorWords.length;
		const titleFullMatch =
			fileTitleWords.length > 0 && titleMatchCount === fileTitleWords.length;

		if (authorFullMatch && titleFullMatch) {
			// Полное совпадение автора и названия - значительный бонус
			score += 25;
		} else if (authorFullMatch || titleFullMatch) {
			// Частичное совпадение - меньший бонус
			score += 15;
		}

		return {
			file,
			score,
			matchedWords: [...new Set(matchedWords)], // Уникальные совпадения
		};
	}

	/**
	 * Извлекает имя автора из имени файла
	 */
	private static extractAuthorFromFilename(filename: string): string {
		// Убираем расширение
		const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

		// Пробуем разные форматы: "Имя_Фамилия_Название", "Имя Фамилия - Название", "Фамилия, Имя - Название"
		// Попробуем найти разделитель между автором и названием
		const underscoreParts = nameWithoutExt.split(/_+/);
		if (underscoreParts.length >= 2) {
			// Формат "Имя_Фамилия_Название" или "Имя_Фамилия_Отчество_Название"
			if (underscoreParts.length >= 3) {
				// Предполагаем, что первые 2-3 части - это имя/фамилия/отчество
				return underscoreParts.slice(0, 3).join(" ");
			} else {
				return underscoreParts[0];
			}
		}

		const dashParts = nameWithoutExt.split(/\s*-\s*/);
		if (dashParts.length >= 2) {
			// Формат "Имя Фамилия - Название"
			return dashParts[0];
		}

		// Если не найден явный разделитель, возвращаем первые 3 слова как потенциального автора
		const words = nameWithoutExt.split(
			/[\s\-_()[\]{}/\\.,"'`~!@#$%^&*+=|;:<>?]+/,
		);
		return words.slice(0, 3).join(" ");
	}

	/**
	 * Извлекает потенциальное название из имени файла
	 */
	private static extractTitleFromFilename(filename: string): string {
		// Убираем расширение
		const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

		// Пробуем разные форматы: "Имя_Фамилия_Название", "Имя Фамилия - Название", "Фамилия, Имя - Название"
		const underscoreParts = nameWithoutExt.split(/_+/);
		if (underscoreParts.length >= 2) {
			// Формат "Имя_Фамилия_Название" или "Имя_Фамилия_Отчество_Название"
			if (underscoreParts.length >= 3) {
				// Предполагаем, что первые 2-3 части - это имя/фамилия/отчество, всё остальное - название
				return underscoreParts.slice(3).join(" ");
			} else {
				return underscoreParts[1];
			}
		}

		const dashParts = nameWithoutExt.split(/\s*-\s*/);
		if (dashParts.length >= 2) {
			// Формат "Имя Фамилия - Название"
			return dashParts[1];
		}

		// Если не найден явный разделитель, возвращаем всё как потенциальное название
		return nameWithoutExt;
	}

	/**
	 * Находит наиболее релевантные файлы для книги
	 */
	public static findMatchingFiles(
		book: BookWithoutFile,
		files: FileOption[],
	): FileOption[] {
		const results = files
			.map((file) => UniversalFileMatcher.matchFileToBook(file, book))
			.filter((result) => result.score >= 50) // Порог 50
			.sort((a, b) => b.score - a.score); // Сортировка по оценке (лучшие первые)

		return results.slice(0, 15).map((result) => result.file); // Возвращаем топ-15 файлов
	}

	/**
	 * Проверяет, релевантен ли конкретный файл книге (для одиночной проверки)
	 */
	public static isFileRelevant(
		file: FileOption,
		book: BookWithoutFile,
		minScore: number = 50,
	): boolean {
		const result = UniversalFileMatcher.matchFileToBook(file, book);
		return result.score >= minScore;
	}
}
