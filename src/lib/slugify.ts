export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-") // Replace spaces with -
		.replace(/[^\w\-а-яА-Я]+/g, "") // Remove all non-word chars
		.replace(/--+/g, "-") // Replace multiple - with single -
		.replace(/^-+/, "") // Trim - from start of text
		.replace(/-+$/, ""); // Trim - from end of text
}

/**
 * Создает slug с заглавными буквами в начале каждого слова (для автора)
 * Например: "Владимир Мясоедов" -> "Владимир-Мясоедов"
 */
export function slugifyTitleCase(text: string): string {
	// Сначала делаем обычный slugify (нижний регистр, дефисы)
	const slug = slugify(text);

	// Разбиваем на слова по дефисам и делаем первую букву каждого слова заглавной
	return slug
		.split("-")
		.map((word) => {
			if (!word) return "";
			// Для кириллицы и латиницы
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join("-");
}

/**
 * Создает slug с заглавной буквой только в первом слове (для названия книги)
 * Например: "цикл Искры истинной магии" -> "Цикл-искры-истинной-магии"
 */
export function slugifySentenceCase(text: string): string {
	// Сначала делаем обычный slugify (нижний регистр, дефисы)
	const slug = slugify(text);

	// Разбиваем на слова по дефисам
	const words = slug.split("-");

	if (words.length === 0 || !words[0]) return slug;

	// Делаем первую букву только первого слова заглавной
	const firstWord = words[0];
	words[0] = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

	return words.join("-");
}
