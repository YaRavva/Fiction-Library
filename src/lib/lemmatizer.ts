/**
 * Простой модуль лемматизации для русского языка
 *
 * Лемматизация - это процесс приведения слов к их нормальной (словарной) форме
 * (например: "книги" -> "книга", "читаю" -> "читать")
 */

// Кэш для лемматизации (максимум 10000 слов)
const lemmaCache = new Map<string, string>();
const MAX_CACHE_SIZE = 10000;

// Словари для морфологического анализа (упрощенные)
const NOUN_ENDINGS = [
	"а",
	"я",
	"ы",
	"ий",
	"ия",
	"ие",
	"ий",
	"ь",
	"у",
	"ю",
	"е",
	"о",
	"и",
	"ы",
	"ам",
	"ям",
	"ов",
	"ев",
	"ей",
	"ей",
	"ем",
	"ом",
	"ах",
	"ях",
	"ами",
	"ями",
];

const VERB_ENDINGS = [
	"ть",
	"ешь",
	"ет",
	"ем",
	"ете",
	"ют",
	"л",
	"ла",
	"ло",
	"ли",
	"ешься",
	"ется",
	"емся",
	"етесь",
	"ются",
	"юсь",
	"ется",
	"емся",
	"етесь",
	"ются",
];

const ADJECTIVE_ENDINGS = [
	"ый",
	"ий",
	"ой",
	"ая",
	"яя",
	"ое",
	"ее",
	"ые",
	"ие",
	"ых",
	"их",
	"ыми",
	"ими",
	"ому",
	"ему",
	"ем",
	"им",
];

const _PRONOUN_ENDINGS = [
	"я",
	"ты",
	"он",
	"она",
	"оно",
	"мы",
	"вы",
	"они",
	"мой",
	"твой",
	"свой",
	"его",
	"ее",
	"их",
	"него",
	"нее",
	"них",
];

/**
 * Проверяет, является ли слово частью словаря, и возвращает его основу
 */
function lookupDictionary(word: string): string | null {
	// Простой словарь некоторых исключений и неправильных форм
	const dictionary: { [key: string]: string } = {
		цикла: "цикл",
	};

	const lowerWord = word.toLowerCase();
	if (dictionary[lowerWord]) {
		return dictionary[lowerWord];
	}

	return null;
}

/**
 * Приводит слово к нормальной форме (лемматизация) для русского языка
 */
export function lemmatizeWord(word: string): string {
	// NFC normalize to handle composed characters (e.g., и + U+0306 breve → й)
	word = word.normalize('NFC');

	// Проверяем кэш
	const cached = lemmaCache.get(word);
	if (cached) {
		return cached;
	}

	// Проверяем, есть ли слово в словаре
	const dictWord = lookupDictionary(word);
	if (dictWord) {
		// Сохраняем в кэш
		if (lemmaCache.size < MAX_CACHE_SIZE) {
			lemmaCache.set(word, dictWord);
		}
		return dictWord;
	}

	// Если слово короткое (1-2 буквы), возвращаем его как есть
	if (word.length <= 2) {
		if (lemmaCache.size < MAX_CACHE_SIZE) {
			lemmaCache.set(word, word);
		}
		return word;
	}

	// Убираем форматные слова
	if (word === "zip" || word === "fb2") {
		if (lemmaCache.size < MAX_CACHE_SIZE) {
			lemmaCache.set(word, word);
		}
		return word;
	}

	// Попытаемся определить часть речи по окончанию и удалить окончание
	let result = word;

	// Проверяем сначала существительные
	for (const ending of NOUN_ENDINGS) {
		if (word.length > ending.length && word.endsWith(ending)) {
			const base = word.slice(0, -ending.length);
			// Добавим проверку, что основа не слишком короткая
			if (base.length >= 2) {
				result = base;
				break;
			}
		}
	}

	// Если существительное не нашли, проверяем прилагательные
	if (result === word) {
		for (const ending of ADJECTIVE_ENDINGS) {
			if (word.length > ending.length && word.endsWith(ending)) {
				const base = word.slice(0, -ending.length);
				if (base.length >= 2) {
					result = base;
					break;
				}
			}
		}
	}

	// Если прилагательное не нашли, проверяем глаголы
	if (result === word) {
		for (const ending of VERB_ENDINGS) {
			if (word.length > ending.length && word.endsWith(ending)) {
				const base = word.slice(0, -ending.length);
				if (base.length >= 2) {
					result = base;
					break;
				}
			}
		}
	}

	// Сохраняем результат в кэш
	if (lemmaCache.size < MAX_CACHE_SIZE) {
		lemmaCache.set(word, result);
	}

	return result;
}
