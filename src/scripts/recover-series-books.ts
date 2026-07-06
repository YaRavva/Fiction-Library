import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { TelegramMetadataService } from "../lib/telegram/metadata-service";
import { TelegramSyncService } from "../lib/telegram/sync";

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Environment variables validation (values are not logged for security)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	console.error(
		"Available env vars:",
		Object.keys(process.env).filter((k) => k.includes("SUPABASE")),
	);
	throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function recoverSeriesBooks() {
	console.log("\n🚀 ЗАПУСК ВОССТАНОВЛЕНИЯ КНИГ СЕРИЙ\n");

	// Проверяем аргументы командной строки
	const args = process.argv.slice(2);
	const targetSeriesTitle = args[0]; // Можно передать часть названия серии

	try {
		// Инициализируем сервисы
		const syncService = await TelegramSyncService.getInstance();
		const metadataService = await TelegramMetadataService.getInstance();

		// Получаем серии
		let query = supabase.from("series").select("*");
		if (targetSeriesTitle) {
			query = query.ilike("title", `%${targetSeriesTitle}%`);
		}

		const { data: seriesList, error: seriesError } = await query;

		if (seriesError) throw seriesError;
		if (!seriesList || seriesList.length === 0) {
			console.log("❌ Серии не найдены");
			return;
		}

		console.log(`Найдено серий для проверки: ${seriesList.length}`);

		for (const series of seriesList) {
			console.log(`\n🔍 Проверка серии: "${series.title}" (${series.author})`);

			if (
				!series.series_composition ||
				!Array.isArray(series.series_composition)
			) {
				console.log("   ⚠️ Нет состава серии (composition), пропускаем");
				continue;
			}

			const composition = series.series_composition;

			for (let i = 0; i < composition.length; i++) {
				const bookItem = composition[i];
				const bookTitle = bookItem.title;
				const seriesOrder = i + 1;

				if (!bookTitle) continue;

				// Проверяем, есть ли книга в БД
				const { data: existingBook } = await supabase
					.from("books")
					.select("id, file_url")
					.eq("title", bookTitle)
					.eq("author", series.author) // Предполагаем, что автор книги совпадает с автором серии
					.maybeSingle();

				if (existingBook) {
					// Книга есть
					if (existingBook.file_url) {
						console.log(`   ✅ [${seriesOrder}] "${bookTitle}" - существует`);
					} else {
						console.log(
							`   🔸 [${seriesOrder}] "${bookTitle}" - существует, но БЕЗ ФАЙЛА`,
						);
						// Тут можно добавить логику попытки найти файл, если книги есть, но пустая
					}

					// Проверить привязку к серии, если не привязана - привязать?
					// Пока фокусируемся на ВОССТАНОВЛЕНИИ отсутствующих
					continue;
				}

				console.log(
					`   ❌ [${seriesOrder}] "${bookTitle}" - ОТСУТСТВУЕТ в БД. Ищем в Telegram...`,
				);

				// Ищем в Telegram
				// Ищем по названию книги + фамилия автора (для точности)
				const searchKeywords = [
					bookTitle,
					series.author.split(" ").pop() || series.author,
				];
				const searchResults = await metadataService.searchMessagesByKeywords(
					searchKeywords,
					5,
				);

				// Фильтруем результаты
				const bestMatch = searchResults.find((r) => r.similarity >= 8); // Высокий порог схожести

				if (bestMatch) {
					console.log(
						`      🎯 Найдено совпадение в Telegram! ID: ${bestMatch.message_id}, Sim: ${bestMatch.similarity}`,
					);
					console.log(`      ⬇️  Запускаем скачивание и создание книги...`);

					try {
						// Скачиваем и создаем книгу
						await syncService.downloadBook(bestMatch.message_id);

						// После скачивания находим созданную книгу по telegram_file_id
						// ВАЖНО: downloadBook сохраняет message_id как telegram_file_id
						const { data: newBook, error: findError } = await supabase
							.from("books")
							.select("id, title")
							.eq("telegram_file_id", String(bestMatch.message_id))
							.single();

						if (newBook) {
							// Привязываем к серии
							await supabase
								.from("books")
								.update({
									series_id: series.id,
									series_order: seriesOrder,
								})
								.eq("id", newBook.id);

							console.log(
								`      ✅ Книга восстановлена и привязана к серии! ID: ${newBook.id}`,
							);
						} else {
							console.warn(
								`      ⚠️ Книга скачана, но не найдена в БД для привязки (Ошибка: ${findError?.message})`,
							);
						}
					} catch (downloadError) {
						console.error(`      ❌ Ошибка при скачивании:`, downloadError);
					}
				} else {
					console.log(`      ⚠️  Подходящих сообщений в Telegram не найдено`);
				}

				// Пауза чтобы не спамить запросами
				await new Promise((r) => setTimeout(r, 1000));
			}
		}
	} catch (error) {
		console.error("\n❌ Ошибка:", error);
	} finally {
		// Завершаем работу сервисов (если нужно, но у них нет явного disconnect в public API кроме private client)
		console.log("\n🏁 Работа завершена");
		process.exit(0);
	}
}

recoverSeriesBooks();
