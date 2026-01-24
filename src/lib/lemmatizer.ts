/**
 * Простой модуль лемматизации для русского языка
 *
 * Лемматизация - это процесс приведения слов к их нормальной (словарной) форме
 * (например: "книги" -> "книга", "читаю" -> "читать")
 */

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
	// Проверяем, есть ли слово в словаре
	const dictWord = lookupDictionary(word);
	if (dictWord) {
		return dictWord;
	}

	// Если слово короткое (1-2 буквы), возвращаем его как есть
	if (word.length <= 2) {
		return word;
	}

	// Убираем форматные слова
	if (word === "zip" || word === "fb2") {
		return word;
	}

	// Попытаемся определить часть речи по окончанию и удалить окончание
	// Проверяем сначала существительные
	for (const ending of NOUN_ENDINGS) {
		if (word.length > ending.length && word.endsWith(ending)) {
			const base = word.slice(0, -ending.length);
			// Добавим проверку, что основа не слишком короткая
			if (base.length >= 2) {
				return base;
			}
		}
	}

	// Затем проверяем прилагательные
	for (const ending of ADJECTIVE_ENDINGS) {
		if (word.length > ending.length && word.endsWith(ending)) {
			const base = word.slice(0, -ending.length);
			if (base.length >= 2) {
				return base;
			}
		}
	}

	// Потом проверяем глаголы
	for (const ending of VERB_ENDINGS) {
		if (word.length > ending.length && word.endsWith(ending)) {
			const base = word.slice(0, -ending.length);
			if (base.length >= 2) {
				return base;
			}
		}
	}

	// Если не получилось применить морфологический анализ, возвращаем слово как есть
	return word;
}
