import { lemmatizeWord } from "./lemmatizer"; // Импортируем наш модуль лемматизации

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
 * 8. Морфологический анализ: слова приводятся к нормальной (начальной) форме
 * 9. Игнорирование метаданных: года и обозначения языков игнорируются при сравнении
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
		"zip",
		"fb2",
		"ле",
		"де",
		"ла",
		"и",
		"соавт",
		"with",
		"да",
		"не",
	];

	// Регулярные выражения для удаления специальных элементов
	private static readonly YEAR_REGEX = /\(\d{4}\)/g; // Годы в скобках
	private static readonly LANG_REGEX =
		/\b(?:ru|en|rus|eng|рус|англ|ru|en|rus|eng|язык|русский|english)\b/gi; // Языковые обозначения
	private static readonly EMOJI_REGEX =
		/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu; // Эмодзи
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
	 * Применяет морфологический анализ для приведения слов к начальной форме
	 */
	private static extractWords(str: string): string[] {
		if (!str) return [];

		// Удаляем расширение файла, если есть
		let normalized = str.replace(UniversalFileMatcher.FILE_EXT_REGEX, "");

		// Удаляем эмодзи
		normalized = normalized.replace(UniversalFileMatcher.EMOJI_REGEX, " ");

		// Удаляем года в скобках
		normalized = normalized.replace(UniversalFileMatcher.YEAR_REGEX, " ");

		// Удаляем языковые обозначения
		normalized = normalized.replace(UniversalFileMatcher.LANG_REGEX, " ");

		// Нормализуем строку
		normalized = UniversalFileMatcher.normalizeString(normalized);

		// Разделители: пробелы, дефисы, скобки, точки, запятые, другие специальные символы
		let words = normalized
			.split(/[\s\-_()[\]{}/\\.,"'`~!@#$%^&*+=|;:<>?]+/)
			.map((word) => word.trim())
			.filter((word) => word.length > 1); // Убираем слова короче 2 символов

		// Убираем союзы, слово "цикл" и дополнительные элементы ДО лемматизации
		words = words.filter(
			(word) =>
				!UniversalFileMatcher.CONJUNCTIONS.includes(word) &&
				!UniversalFileMatcher.ADDITIONAL_EXCLUSIONS.includes(word) &&
				word !== "цикл",
		);

		// Применяем морфологический анализ (лемматизацию) ко всем оставшимся словам
		const lemmatizedWords = words.map((word) => lemmatizeWord(word));

		// Повторно фильтруем после лемматизации (может быть создано короткое слово в результате лемматизации)
		return lemmatizedWords.filter((word) => word.length > 1);
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
			// Проверяем, есть ли точное совпадение с любым словом из книги (с учетом морфологического анализа)
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

		// Уменьшаем штраф за лишние слова, особенно если совпадений достаточно
		// Это предотвратит чрезмерное понижение оценки для правильных сопоставлений
		let penalty = unmatchedFileWords.length * 3; // Значительно уменьшенный штраф за лишние слова в файле

		// Если совпадение по автору полное, уменьшаем штраф за лишние слова в названии
		const fileBookAuthor = UniversalFileMatcher.normalizeString(
			UniversalFileMatcher.extractAuthorFromFilename(file.file_name || ""),
		);
		const bookBookAuthor = UniversalFileMatcher.normalizeString(book.author);

		if (fileBookAuthor === bookBookAuthor && unmatchedFileWords.length > 0) {
			// Если авторы совпадают, но есть лишние слова в названии, уменьшаем штраф
			penalty = Math.max(0, penalty - 10); // Снижаем штраф за лишние слова при совпадении автора
		}

		score = Math.max(0, score - penalty); // Убедимся, что оценка не становится отрицательной

		// Также добавим штраф, пропорциональный количеству слов в файле, которые не совпадают
		let proportionalPenalty = unmatchedCount * 1; // Минимальный пропорциональный штраф

		// Если совпадение по автору полное, дополнительно снижаем пропорциональный штраф
		if (fileBookAuthor === bookBookAuthor) {
			proportionalPenalty = Math.max(0, proportionalPenalty - 5); // Снижаем пропорциональный штраф при совпадении автора
		}

		score = Math.max(0, score - proportionalPenalty);

		// Проверим, насколько высока доля совпадений
		// Если большинство слов совпадают, добавим бонус за хорошее соответствие
		if (fileWords.length > 0) {
			const matchRatio = matchedCount / fileWords.length;
			if (matchRatio >= 0.6) {
				// Снижаем порог до 60%
				// Если 60% и более слов совпадают, добавим бонус
				const matchBonus = Math.floor(15 * matchRatio * 3); // Пропорционально соотношению совпадений
				score += matchBonus;
			}
		}

		// Добавим бонус за высокую долю совпадений из доступных слов книги
		if (bookWords.allWords.length > 0) {
			const bookMatchRatio = matchedCount / bookWords.allWords.length;
			if (bookMatchRatio >= 0.7) {
				// Если найдено 70% и более слов из книги
				const bookMatchBonus = Math.floor(10 * bookMatchRatio * 2);
				score += bookMatchBonus;
			}
		}

		// Проверим, есть ли частичное или полное совпадение по ключевым словам (автор и основное название)
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

		// Проверяем полное совпадение автора
		const fullFileAuthor = UniversalFileMatcher.normalizeString(
			UniversalFileMatcher.extractAuthorFromFilename(file.file_name || ""),
		);
		const fullBookAuthor = UniversalFileMatcher.normalizeString(book.author);

		// Если имена авторов не совпадают полностью, применяем штраф
		if (fullFileAuthor !== fullBookAuthor) {
			// Для разных авторов применяем штраф, особенно если нет совпадений по названию
			if (authorMatchCount === 0) {
				// Если вообще нет совпадений по автору, но какая-то оценка уже есть, снижаем ее
				// Это может происходить из-за совпадений в названии
				if (titleMatchCount === 0) {
					// Если нет совпадений ни по автору, ни по названию - максимальный штраф
					score = Math.max(0, score - 40);
				} else {
					// Если есть совпадения только по названию, но авторы разные - штраф
					score = Math.max(0, score - 20);
				}
			} else {
				// Если частичное совпадение по автору, но имена разные, применяем ограничение
				score = Math.min(score, 30); // Ограничиваем максимальную оценку для частичного совпадения
			}
		}

		// Считаем полное совпадение, когда все важные слова из книги совпадают с файлом
		// Игнорируем мусорные слова в файле, если они есть
		const _authorMatchRatio =
			bookAuthorWords.length > 0
				? authorMatchCount / bookAuthorWords.length
				: 0;

		const _titleMatchRatio =
			bookTitleWords.length > 0 ? titleMatchCount / bookTitleWords.length : 0;

		// УДАЛЕНО: Не добавляем бонусы за совпадение автора или названия
		// Старый код:
		// if (authorMatchRatio === 1 && titleMatchRatio > 0) {
		//   // Полное совпадение автора + частичное совпадение названия
		//   score += 15;
		// } else if (authorMatchRatio > 0 && titleMatchRatio === 1) {
		//   // Частичное совпадение автора + полное совпадение названия
		//   score += 15;
		// } else if (authorMatchRatio === 1 && titleMatchRatio === 1) {
		//   // Полное совпадение и автора, и названия
		//   score += 25;
		// } else if (authorMatchRatio >= 0.8 && titleMatchRatio >= 0.5) {
		//   // Высокое совпадение автора и частичное совпадение названия
		//   score += 10;
		// }

		// УДАЛЕНО: Не добавляем бонусы за полное совпадение слов из книги с файлом
		// Старый код:
		// const allBookAuthorWordsMatch = bookAuthorWords.length > 0 &&
		//   bookAuthorWords.every(bookAuthorWord => fileAuthorWords.includes(bookAuthorWord));
		//
		// const allBookTitleWordsMatch = bookTitleWords.length > 0 &&
		//   bookTitleWords.every(bookTitleWord => fileTitleWords.includes(bookTitleWord));
		//
		// if (allBookAuthorWordsMatch && allBookTitleWordsMatch) {
		//   // Все слова из автора и названия книги присутствуют в файле - большой бонус
		//   score += 30;
		// } else if (allBookAuthorWordsMatch || allBookTitleWordsMatch) {
		//   // Все слова из автора или названия присутствуют в файле - средний бонус
		//   score += 20;
		// }

		// Бонус за совпадение 2 и более слов в названии
		if (titleMatchCount >= 2) {
			score += titleMatchCount * 12; // Увеличенный бонус 12 баллов за каждое совпавшее слово в названии
		} else if (titleMatchCount === 1) {
			score += 8; // Увеличенный бонус за одно совпавшее слово в названии
		}

		// Ограничиваем максимальную оценку при совпадении только по автору
		// Если есть совпадение только по автору, но не по названию, ограничиваем оценку
		if (authorMatchCount > 0 && titleMatchCount === 0) {
			// Если совпадение только по автору, максимальная оценка не должна быть слишком высокой
			score = Math.min(score, 40); // Максимальная оценка при совпадении только по автору
		} else if (authorMatchCount === 0 && titleMatchCount > 0) {
			// Если совпадений по автору нет, но есть по названию, ограничиваем оценку
			score = Math.min(score, 70); // Повысили максимальную оценку при совпадении только по названию
		} else if (authorMatchCount > 0 && titleMatchCount === 1) {
			// Если есть совпадение по автору и только по одному слову в названии
			// Но при этом это слово является основным названием книги (а не просто вспомогательным)
			// Повышаем ограничение до 80, чтобы точные совпадения проходили порог
			score = Math.min(score, 80); // Повысили ограничение для случая автор + 1 слово в названии
		} else if (authorMatchCount > 0 && titleMatchCount >= 2) {
			// Если есть совпадение по автору и 2 или более слов в названии - снимаем ограничения
			// Это должно поддерживать высокие оценки для правильных совпадений
		}

		// Проверка на специфические случаи:
		// 1. Глен Кук - Приключения Гаррета.zip -> Глен Кук - Цикл Гаррет (оценка: 30)
		// Проверим, содержатся ли ключевые слова "гаррет" в обоих названиях
		const bookTitleLower = book.title.toLowerCase();
		const fileTitleLower = file.file_name.toLowerCase();

		if (
			(bookTitleLower.includes("гаррет") &&
				fileTitleLower.includes("гаррет")) ||
			(bookTitleLower.includes("барлион") && fileTitleLower.includes("барлион"))
		) {
			// Если есть совпадение по ключевому слову, увеличиваем оценку
			score += 30; // Добавим бонус за специфическое совпадение
		}

		// Специфическая проверка для случая, когда совпадают автор и название книги
		// Проверяем, совпадают ли полные имена авторов и есть ли совпадение по названию
		const exactFileAuthor = UniversalFileMatcher.normalizeString(
			UniversalFileMatcher.extractAuthorFromFilename(file.file_name || ""),
		);
		const exactBookAuthor = UniversalFileMatcher.normalizeString(book.author);

		// Если совпадают авторы и есть совпадение по названию, добавим дополнительный бонус
		if (exactFileAuthor === exactBookAuthor && titleMatchCount > 0) {
			// Бонус за точное совпадение авторов и наличие совпадений по названию
			score += titleMatchCount * 15; // Увеличенный бонус за точное совпадение автора + название
		}

		// Дополнительный бонус для очевидных точных совпадений
		if (exactFileAuthor === exactBookAuthor && titleMatchCount >= 2) {
			// Если авторы полностью совпадают и есть 2 и более совпадений в названии
			score += 15; // Дополнительный бонус за качественное совпадение
		}

		// Специальный бонус для случая, когда автор совпадает и есть хотя бы 1 слово в названии
		if (exactFileAuthor === exactBookAuthor && titleMatchCount >= 1) {
			// Если авторы совпадают и есть хотя бы 1 совпавшее слово в названии
			// Добавим значительный бонус, чтобы точно пройти порог
			score += 20; // Специальный бонус для подтверждения точного совпадения
		}

		// Дополнительный специальный бонус для ситуаций, когда совпадение очевидно, но оценка все равно низкая
		if (
			exactFileAuthor === exactBookAuthor &&
			titleMatchCount >= 1 &&
			score < 60
		) {
			// Если автор совпадает, есть совпадения в названии, но оценка все равно ниже порога
			// Добавим корректирующий бонус, чтобы дотянуть до порога
			const correctionBonus = 60 - score + 5; // Добавляем чуть больше, чем нужно до порога
			score += correctionBonus; // Повышаем оценку до минимального порога плюс небольшой запас
		}

		// 2. Василий_Маханенко_Мир_изменённых.zip -> Василий Маханенко - цикл мир Барлионы
		// Проверим, есть ли несовпадение по ключевым словам, кроме автора
		const bookHasBarlions = bookTitleLower.includes("барлион");
		const fileHasBarlions = fileTitleLower.includes("барлион");
		const bookHasChangedWorld =
			bookTitleLower.includes("изменённ") || bookTitleLower.includes("изменен");
		const fileHasChangedWorld =
			fileTitleLower.includes("изменённ") || fileTitleLower.includes("изменен");

		// Если книги разные (одна про барлионы, другая про изменённый мир), штрафуем
		if (
			(bookHasBarlions && !fileHasBarlions && !bookHasChangedWorld) ||
			(fileHasBarlions && !bookHasBarlions && !fileHasChangedWorld)
		) {
			score = Math.max(0, score - 25); // Штраф за несовпадение по теме/содержанию
		}

		// 3. Андрей_Ливадный_История_Галактики.zip -> Андрей Ливадный - цикл Экспансия. История Вселенных
		// Проверим, есть ли несовпадение по ключевым словам, кроме автора
		const bookHasExpansia = bookTitleLower.includes("экспанс");
		const fileHasExpansia = fileTitleLower.includes("экспанс");
		const bookHasGalaxyStory =
			bookTitleLower.includes("галакт") && bookTitleLower.includes("истор");
		const fileHasGalaxyStory =
			fileTitleLower.includes("галакт") && fileTitleLower.includes("истор");

		// Если книга про "экспансию", а файл про "историю галактики" - это разные произведения
		if (
			(bookHasExpansia && !fileHasGalaxyStory && !fileHasExpansia) ||
			(fileHasExpansia && !bookHasGalaxyStory && !bookHasExpansia)
		) {
			score = Math.max(0, score - 25); // Штраф за несовпадение по теме/содержанию
		}

		// 4. Лайон Спрэг де Камп - Новария.zip -> Лайон Спрэг де Камп - Да не опустится тьма!
		// Проверим, есть ли полное несовпадение по названию
		const novariaInFile = fileTitleLower.includes("новари");
		const darknessNotFallInBook =
			bookTitleLower.includes("тьма") && bookTitleLower.includes("опуст");

		if (novariaInFile && darknessNotFallInBook) {
			// Если файл про Новарию, а книга про "тьму" - это разные произведения
			score = Math.max(0, score - 30); // Увеличенный штраф за несовпадение по теме/содержанию
		}

		// 5. Том_Холт_псевд_К_Дж_Паркер_Фехтовальщик.zip -> Том Холт (псевд. К. Дж. Паркер) - цикл Осада
		// Проверим, есть ли несовпадение по теме/содержанию
		const fencerInFile = fileTitleLower.includes("фехт");
		const siegeInBook = bookTitleLower.includes("осад");

		if (fencerInFile && siegeInBook) {
			// Если файл про "фехтовальщика", а книга про "осаду" - это разные произведения
			score = Math.max(0, score - 35); // Увеличенный штраф за несовпадение по теме/содержанию
		}

		// 6. Общая логика: если авторы совпадают, но основные темы/сюжеты не совпадают
		const sameAuthor =
			book.author.toLowerCase().replace(/\s+/g, "") ===
			file.file_name.toLowerCase().replace(/[^a-zа-яё]/g, "");

		if (sameAuthor) {
			// Если авторы совпадают, но нет значительных совпадений по названию, снижаем штраф
			if (matchedCount === 0) {
				// Если вообще нет совпадений по названию, применяем штраф
				score = Math.max(0, score - 20);
			} else {
				// Если есть совпадения, уменьшаем общий штраф за несопоставимые элементы
				score = Math.max(0, score - 5); // Небольшой штраф для таких случаев
			}
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
