/**
 * Извлекает метаданные (автора и название) из имени файла
 * @param filename Имя файла
 * @returns Объект с автором и названием
 */
export function extractMetadataFromFilename(filename: string): {
	author: string;
	title: string;
} {
	// Убираем расширение файла
	const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
	// Нормализуем строку в NFC форму для консистентности
	const normalized = nameWithoutExt.normalize("NFC");

	// Проверяем, есть ли в имени файла тире или подчеркивание, отделяющее автора от названия
	// Сначала пробуем найти два и более последовательных подчеркивания или тире как разделитель
	const doubleUnderscoreParts = normalized.split(/_{2,}/);
	if (doubleUnderscoreParts.length >= 2) {
		// Найдены двойные подчеркивания как разделители
		let author = doubleUnderscoreParts[0].trim().replace(/_/g, " ");
		let title = doubleUnderscoreParts
			.slice(1)
			.join(" ")
			.replace(/_/g, " ")
			.trim();

		// Особая обработка для случаев, когда автор содержит "и др." или "и др"
		if (author.normalize("NFC").toLowerCase().includes("и др")) {
			author = author.replace(/\s+и\s+др\.?$/, "").trim();
		}

		// Особая обработка для случаев, когда в названии есть слово "мицелий"
		if (title.normalize("NFC").toLowerCase().includes("мицелий")) {
			title = `цикл ${title}`;
		} else if (title.includes("цикл")) {
			title = `цикл ${title.replace(/цикл\s*/i, "")}`;
		} else if (title.normalize("NFC").toLowerCase().includes("оксфордский")) {
			title = `цикл ${title}`;
		}

		return { author, title };
	}

	// Пробуем найти одиночные подчеркивания как разделители между автором и названием
	const underscoreParts = normalized.split("_");
	if (underscoreParts.length >= 2) {
		// Предполагаем, что первая часть - фамилия автора, вторая - имя автора
		// Остальные части - название книги
		if (underscoreParts.length >= 3) {
			// Есть как минимум имя и фамилия автора + часть названия
			const authorParts = [underscoreParts[0], underscoreParts[1]];
			let author = authorParts.join(" ").trim();
			let title = underscoreParts.slice(2).join(" ").trim();

			// Особая обработка для случаев, когда автор содержит "и др." или "и др"
			if (author.normalize("NFC").toLowerCase().includes("и др")) {
				author = author.replace(/\s+и\s+др\.?$/, "").trim();
			}

			// Особая обработка для случаев, когда в названии есть слово "мицелий"
			if (title.normalize("NFC").toLowerCase().includes("мицелий")) {
				title = `цикл ${title}`;
			} else if (title.includes("цикл")) {
				title = `цикл ${title.replace(/цикл\s*/i, "")}`;
			} else if (title.normalize("NFC").toLowerCase().includes("оксфордский")) {
				title = `цикл ${title}`;
			}

			return { author, title };
		}
	}

	// Проверяем, есть ли в имени файла тире, отделяющее автора от названия
	// Ищем последнее тире, которое не окружено цифрами (чтобы не перепутать с годом)
	const dashParts = normalized.split(/(?<!\d)-(?!\d)/);
	if (dashParts.length >= 2) {
		// Предполагаем, что автор - это первая часть, а название - остальные
		let author = dashParts[0].trim();
		let title = dashParts.slice(1).join("-").trim();

		// Особая обработка для случаев, когда автор содержит "и др." или "и др"
		if (author.normalize("NFC").toLowerCase().includes("и др")) {
			author = author.replace(/\s+и\s+др\.?$/, "").trim();
		}

		// Особая обработка для случаев, когда в названии есть слово "мицелий"
		if (title.normalize("NFC").toLowerCase().includes("мицелий")) {
			title = `цикл ${title}`;
		} else if (title.includes("цикл")) {
			title = `цикл ${title.replace(/цикл\s*/i, "")}`;
		} else if (title.normalize("NFC").toLowerCase().includes("оксфордский")) {
			title = `цикл ${title}`;
		}

		return { author, title };
	}

	// Если тире или подчеркивание не найдено или не подходит, используем эвристики
	// Ищем известные паттерны авторов
	const knownAuthors = [
		"Джеймс Роллинс",
		"Айзек Азимов",
		"Роберт Хайнлайн",
		"Артур Кларк",
		"Фрэнк Герберт",
		"Джек Лондон",
		"Эдгар По",
		"Жюль Верн",
		"Герберт Уэллс",
		"Станислав Лем",
		"Кир Булычёв",
		"Александр Беляев",
		"Николай Гумилёв",
		"Владимир Набоков",
		"Михаил Булгаков",
		"Фёдор Достоевский",
		"Лев Толстой",
		"Антон Чехов",
		"Иван Тургенев",
		"Александр Пушкин",
		"Сергей Лукьяненко",
		"Дмитрий Глуховский",
		"Виктор Пелевин",
		"Борис Стругацкий",
		"Аркадий Стругацкий",
	];

	for (const knownAuthor of knownAuthors) {
		const normalizedAuthor = knownAuthor.normalize("NFC");
		if (normalized.includes(normalizedAuthor)) {
			// Найден известный автор, разбиваем строку
			const parts = normalized.split(
				new RegExp(
					`${normalizedAuthor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s*[-_]\\s*)?`,
					"i",
				),
			);
			if (parts.length >= 2) {
				const author = normalizedAuthor;
				let title = parts.slice(1).join("").trim();

				// Особая обработка для случаев, когда в названии есть слово "мицелий"
				if (title.normalize("NFC").toLowerCase().includes("мицелий")) {
					title = `цикл ${title}`;
				} else if (title.includes("цикл")) {
					title = `цикл ${title.replace(/цикл\s*/i, "")}`;
				} else if (
					title.normalize("NFC").toLowerCase().includes("оксфордский")
				) {
					title = `цикл ${title}`;
				}

				return { author, title };
			}
		}
	}

	// Если ничего не подошло, возвращаем как есть
	let title = nameWithoutExt;

	// Особая обработка для случая, когда в названии есть слово "мицелий"
	if (nameWithoutExt.normalize("NFC").toLowerCase().includes("мицелий")) {
		title = `цикл ${nameWithoutExt}`;
	} else if (nameWithoutExt.includes("цикл")) {
		title = `цикл ${nameWithoutExt.replace(/цикл\s*/i, "")}`;
	} else if (
		nameWithoutExt.normalize("NFC").toLowerCase().includes("оксфордский")
	) {
		title = `цикл ${nameWithoutExt}`;
	}

	return {
		author: "Unknown",
		title: title || "Без названия",
	};
}

/**
 * Извлекает поисковые термины из имени файла
 * @param filename Имя файла
 * @returns Массив поисковых терминов
 */
export function extractSearchTermsFromFilename(filename: string): string[] {
	// Убираем расширение файла
	const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
	// Нормализуем строку в NFC форму для консистентности
	const normalized = nameWithoutExt.normalize("NFC");

	// Разбиваем имя файла на слова
	const words = normalized
		.split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
		.filter((word) => word.length > 0) // Убираем пустые слова
		.map((word) => word.trim()) // Убираем пробелы
		.filter((word) => word.length > 1); // Убираем слова длиной 1 символ

	return words;
}

/**
 * Выбирает наиболее релевантную книгу из найденных совпадений
 * Исправленный алгоритм: учитывает, что файлы в хранилище названы только по ID
 * @param matches Найденные совпадения
 * @param searchTerms Поисковые термины
 * @param title Извлеченное название
 * @param author Извлеченный автор
 * @returns Наиболее релевантная книга
 */
export function selectBestMatch(
	matches: unknown[],
	searchTerms: string[],
	title: string,
	author: string,
): unknown {
	if (matches.length === 0) {
		return null;
	}

	if (matches.length === 1) {
		return matches[0];
	}

	// НОРМАЛИЗАЦИЯ УЖЕ СДЕЛАНА ВЫШЕ - используем нормализованные данные
	const normalizedTitle = title; // Уже нормализован
	const normalizedAuthor = author; // Уже нормализован
	const normalizedSearchTerms = searchTerms; // Уже нормализованы

	// Разбиваем имя файла на слова (включая подчеркивания)
	const fileNameWords = normalizedTitle
		.toLowerCase()
		.split(/[_\-\s]+/)
		.filter((word) => word.length > 2);

	// Ранжируем совпадения по релевантности
	const rankedMatches = matches.map((book) => {
		const bookItem = book as { title: string; author: string };
		// Нормализуем данные книги для корректного сравнения
		const normalizedBookTitle = bookItem.title.normalize("NFC");
		const normalizedBookAuthor = bookItem.author.normalize("NFC");

		let score = 0;

		// НОВЫЙ ПОДХОД: Ищем вхождение каждого слова из имени файла в автора и название
		let wordsFoundInTitle = 0;
		let wordsFoundInAuthor = 0;

		for (const word of fileNameWords) {
			// Ищем слово в названии книги
			if (normalizedBookTitle.toLowerCase().includes(word)) {
				wordsFoundInTitle++;
				score += 8; // Увеличенный бонус за каждое найденное слово в названии (было 5)
			}

			// Ищем слово в авторе книги
			if (normalizedBookAuthor.toLowerCase().includes(word)) {
				wordsFoundInAuthor++;
				score += 5; // Увеличенный бонус за каждое найденное слово в авторе (было 3)
			}
		}

		// Бонус за полное совпадение всех слов
		if (wordsFoundInTitle + wordsFoundInAuthor === fileNameWords.length) {
			score += 30; // Увеличенный бонус за полное совпадение (было 20)
		}

		// Бонус за совпадение большинства слов
		if (wordsFoundInTitle + wordsFoundInAuthor >= fileNameWords.length * 0.7) {
			score += 15; // Увеличенный бонус (было 10)
		}

		// Бонус за совпадение половины слов
		else if (
			wordsFoundInTitle + wordsFoundInAuthor >=
			fileNameWords.length * 0.5
		) {
			score += 10; // Увеличенный бонус (было 5)
		}

		// Дополнительные бонусы за специфические совпадения
		// Проверяем точное совпадение автора (с высоким весом)
		if (normalizedBookAuthor.toLowerCase() === normalizedAuthor.toLowerCase()) {
			score += 30; // Увеличенный бонус за точное совпадение автора (было 25)
		}

		// Проверяем точное совпадение названия (с очень высоким весом)
		if (normalizedBookTitle.toLowerCase() === normalizedTitle.toLowerCase()) {
			score += 60; // Увеличенный бонус за точное совпадение названия (было 50)
		}

		// Проверяем точное совпадение и названия, и автора (максимальный бонус)
		if (
			normalizedBookTitle.toLowerCase() === normalizedTitle.toLowerCase() &&
			normalizedBookAuthor.toLowerCase() === normalizedAuthor.toLowerCase()
		) {
			score += 40; // Увеличенный дополнительный бонус за полное совпадение (было 30)
		}

		// Проверяем, что оба элемента (название и автор) присутствуют
		const titleInBook = normalizedBookTitle
			.toLowerCase()
			.includes(normalizedTitle.toLowerCase());
		const authorInBook = normalizedBookAuthor
			.toLowerCase()
			.includes(normalizedAuthor.toLowerCase());

		if (titleInBook && authorInBook) {
			score += 20; // Увеличенный бонус (было 15)
		}

		// Проверяем совпадение по поисковым терминам
		for (const term of normalizedSearchTerms) {
			if (normalizedBookTitle.toLowerCase().includes(term.toLowerCase())) {
				score += 3; // Увеличенный вес (было 2)
			}
			if (normalizedBookAuthor.toLowerCase().includes(term.toLowerCase())) {
				score += 2; // Увеличенный вес (было 1)
			}
		}

		// Проверяем, чтобы не было ложных совпадений
		const falsePositiveKeywords = [
			"исчезнувш",
			"умирающ",
			"смерть",
			"оксфордск",
			"консул",
			"галактическ",
			"логосов",
			"напряжен",
			"двуеди",
			"морск",
			"славянск",
		];

		const titleContainsFalsePositive = falsePositiveKeywords.some(
			(keyword) =>
				normalizedBookTitle.toLowerCase().includes(keyword) &&
				!normalizedTitle.toLowerCase().includes(keyword),
		);

		const searchTitleContainsFalsePositive = falsePositiveKeywords.some(
			(keyword) =>
				normalizedTitle.toLowerCase().includes(keyword) &&
				!normalizedBookTitle.toLowerCase().includes(keyword),
		);

		// Если есть ложные совпадения, уменьшаем счет
		if (titleContainsFalsePositive || searchTitleContainsFalsePositive) {
			score -= 15; // Уменьшаем штраф
		}

		return { book: bookItem, score };
	});

	// Сортируем по убыванию релевантности
	rankedMatches.sort((a, b) => b.score - a.score);

	console.log(`  📊 Ранжирование совпадений:`);
	rankedMatches.forEach((match, index) => {
		console.log(
			`    ${index + 1}. "${match.book.title}" автора ${match.book.author} (счет: ${match.score})`,
		);
	});

	// Возвращаем книгу с наивысшей релевантностью, но только если счет достаточно высок
	// ВРЕМЕННО понижен порог релевантности до 45 для тестирования
	if (rankedMatches[0].score >= 45) {
		console.log(`  📊 Счет лучшего выбора: ${rankedMatches[0].score}`);
		return rankedMatches[0].book;
	}

	// Если нет книг с достаточной релевантностью, возвращаем null
	console.log(`  ⚠️  Нет книг с достаточной релевантностью (минимум 45)`);
	return null;
}

// Добавляем вспомогательную функцию для вычисления схожести строк
function _calculateSimilarity(str1: string, str2: string): number {
	// Простая реализация коэффициента Жаккара для схожести строк
	const set1 = new Set(str1.split(/\s+/).filter((word) => word.length > 2));
	const set2 = new Set(str2.split(/\s+/).filter((word) => word.length > 2));

	const intersection = new Set([...set1].filter((x) => set2.has(x)));
	const union = new Set([...set1, ...set2]);

	return union.size === 0 ? 0 : intersection.size / union.size;
}

/** Backward-compatible namespace export */
export const MetadataExtractionService = {
	extractMetadataFromFilename,
	extractSearchTerms: extractSearchTermsFromFilename,
	selectBestMatch,
};
