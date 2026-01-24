import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function checkBooksCovers() {
	console.log("Проверка соответствия книг и обложек...");

	try {
		// Получаем общее количество книг
		const { count: totalBooks, error: booksCountError } = await supabaseAdmin
			.from("books")
			.select("*", { count: "exact", head: true });

		if (booksCountError) {
			console.error("Ошибка при получении количества книг:", booksCountError);
			return;
		}

		console.log(`Всего книг в базе данных: ${totalBooks}`);

		// Получаем количество книг с обложками
		const { count: booksWithCovers, error: coversCountError } =
			await supabaseAdmin
				.from("books")
				.select("*", { count: "exact", head: true })
				.not("cover_url", "is", null);

		if (coversCountError) {
			console.error(
				"Ошибка при получении количества книг с обложками:",
				coversCountError,
			);
			return;
		}

		console.log(`Книг с обложками: ${booksWithCovers}`);

		const booksWithoutCovers = (totalBooks || 0) - (booksWithCovers || 0);
		console.log(`Книг без обложек: ${booksWithoutCovers}`);

		// Показываем процент
		const coveragePercentage = totalBooks
			? (((booksWithCovers || 0) / totalBooks) * 100).toFixed(2)
			: 0;
		console.log(`Покрытие обложками: ${coveragePercentage}%`);

		// Если есть книги без обложек, показываем примеры
		if (booksWithoutCovers > 0) {
			console.log("\nПримеры книг без обложек:");
			const { data: booksWithoutCoversData, error: sampleError } =
				await supabaseAdmin
					.from("books")
					.select("id, title, author")
					.is("cover_url", null)
					.limit(5);

			if (!sampleError && booksWithoutCoversData) {
				booksWithoutCoversData.forEach((book, index) => {
					console.log(`${index + 1}. ${book.author} - ${book.title}`);
				});
			}
		}
	} catch (error) {
		console.error("Ошибка при проверке книг и обложек:", error);
	}
}

checkBooksCovers().catch(console.error);
