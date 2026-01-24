import dotenv from "dotenv";
import { serverSupabase } from "../lib/serverSupabase";
import { slugifySentenceCase, slugifyTitleCase } from "../lib/slugify";

dotenv.config();

async function checkBookFilename(bookId: string) {
	try {
		console.log(`🔍 Проверяем книгу с ID: ${bookId}\n`);

		// Получаем данные книги
		const { data: bookData, error: bookError } = await serverSupabase
			.from("books")
			.select("title, author, file_url, file_format")
			.eq("id", bookId)
			.single();

		if (bookError) {
			console.error("❌ Ошибка при получении данных книги:", bookError);
			return;
		}

		if (!bookData) {
			console.log("⚠️ Книга не найдена");
			return;
		}

		console.log("📚 Данные книги:");
		console.log(`  Название: "${bookData.title}"`);
		console.log(`  Автор: "${bookData.author}"`);
		console.log(`  Формат файла: "${bookData.file_format}"`);
		console.log(`  URL файла: ${bookData.file_url}\n`);

		// Проверяем валидность title и author
		const hasValidTitle = bookData.title && bookData.title.trim() !== "";
		const hasValidAuthor = bookData.author && bookData.author.trim() !== "";

		console.log("✅ Проверка валидности:");
		console.log(`  hasValidTitle: ${hasValidTitle}`);
		console.log(`  hasValidAuthor: ${hasValidAuthor}\n`);

		// Тестируем slugify
		if (hasValidTitle && hasValidAuthor) {
			// Для автора: все слова с заглавной (Title Case)
			// Для названия: только первое слово с заглавной (Sentence Case)
			const sanitizedTitle = slugifySentenceCase(bookData.title);
			const sanitizedAuthor = slugifyTitleCase(bookData.author);

			console.log("🔤 Результаты slugify:");
			console.log(`  Оригинальное название: "${bookData.title}"`);
			console.log(`  После slugifySentenceCase: "${sanitizedTitle}"`);
			console.log(`  Оригинальный автор: "${bookData.author}"`);
			console.log(`  После slugifyTitleCase: "${sanitizedAuthor}"\n`);

			// Проверяем, не оказались ли значения пустыми после slugify
			if (!sanitizedTitle || !sanitizedAuthor) {
				console.log("⚠️ ПРОБЛЕМА: После slugify получились пустые значения!");
				console.log(`  sanitizedTitle пуст: ${!sanitizedTitle}`);
				console.log(`  sanitizedAuthor пуст: ${!sanitizedAuthor}\n`);
			}

			// Формируем имя файла как в API
			const fileExtension =
				bookData.file_format && bookData.file_format !== ""
					? bookData.file_format
					: "zip";

			let filename: string;
			if (sanitizedTitle && sanitizedAuthor) {
				filename = `${sanitizedAuthor}-${sanitizedTitle}.${fileExtension}`;
				console.log("📄 Сгенерированное имя файла:");
				console.log(`  "${filename}"\n`);
			} else {
				filename = `${bookId}.${fileExtension}`.toLowerCase();
				console.log("📄 Используется fallback (bookId):");
				console.log(`  "${filename}"\n`);
			}
		} else {
			console.log("⚠️ ПРОБЛЕМА: Отсутствуют title или author!");
			const fileExtension =
				bookData.file_format && bookData.file_format !== ""
					? bookData.file_format
					: "zip";
			const filename = `${bookId}.${fileExtension}`.toLowerCase();
			console.log(`📄 Используется fallback (bookId): "${filename}"\n`);
		}

		// Дополнительная диагностика: проверяем каждый символ
		if (hasValidTitle) {
			console.log("🔍 Анализ символов в названии:");
			const titleChars = bookData.title.split("");
			titleChars.forEach((char, index) => {
				const code = char.charCodeAt(0);
				const slugified = slugifySentenceCase(char);
				if (slugified === "") {
					console.log(
						`  Позиция ${index}: "${char}" (код ${code}) -> удаляется slugify`,
					);
				}
			});
			console.log("");
		}

		if (hasValidAuthor) {
			console.log("🔍 Анализ символов в авторе:");
			const authorChars = bookData.author.split("");
			authorChars.forEach((char, index) => {
				const code = char.charCodeAt(0);
				const slugified = slugifySentenceCase(char);
				if (slugified === "") {
					console.log(
						`  Позиция ${index}: "${char}" (код ${code}) -> удаляется slugify`,
					);
				}
			});
		}
	} catch (error) {
		console.error("❌ Ошибка в скрипте:", error);
	}
}

// Получаем bookId из аргументов командной строки
const bookId = process.argv[2];

if (!bookId) {
	console.error("❌ Укажите ID книги как аргумент");
	console.log(
		"Использование: npx tsx src/scripts/check-book-filename.ts <bookId>",
	);
	process.exit(1);
}

checkBookFilename(bookId);
