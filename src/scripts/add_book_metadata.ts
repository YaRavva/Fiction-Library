import dotenv from "dotenv";
import { putObject } from "../lib/s3-service";
import { serverSupabase } from "../lib/serverSupabase";
import { TelegramService } from "../lib/telegram/client";
import { MetadataParser } from "../lib/telegram/parser";

dotenv.config();

// Определяем интерфейс для книги из базы данных
interface BookRecord {
	id: string;
	title: string;
	author: string;
}

/**
 * Нормализация текста для сравнения (заменяет ё на е, й на и)
 */
function normalizeText(text: string): string {
	return text
		.normalize("NFD")
		.replace(/ё/g, "е")
		.replace(/Ё/g, "Е")
		.replace(/й/g, "и")
		.replace(/Й/g, "И")
		.toLowerCase();
}

/**
 * Проверка, существует ли уже книга с таким названием и автором
 */
async function checkDuplicateBook(
	title: string,
	author: string,
): Promise<boolean> {
	console.log(`🔍 Checking for duplicate book: "${title}" by ${author}`);

	// Нормализуем параметры поиска
	const normalizedTitle = normalizeText(title);
	const normalizedAuthor = normalizeText(author);

	// Разбиваем на слова для поиска
	const titleWords = normalizedTitle
		.split(/\s+/)
		.filter((word) => word.length > 2);
	const authorWords = normalizedAuthor
		.split(/\s+/)
		.filter((word) => word.length > 2);
	const allSearchWords = [...titleWords, ...authorWords].filter(
		(word) => word.length > 0,
	);

	console.log(`  Search words: [${allSearchWords.join(", ")}]`);

	if (allSearchWords.length === 0) {
		console.log(`⚠️  Not enough words for search`);
		return false;
	}

	// Ищем книги, где в названии или авторе встречаются слова из поискового запроса
	const searchPromises = allSearchWords.map(async (word) => {
		const { data: titleMatches } = await serverSupabase
			.from("books")
			.select("id, title, author")
			.ilike("title", `%${word}%`)
			.limit(5);

		const { data: authorMatches } = await serverSupabase
			.from("books")
			.select("id, title, author")
			.ilike("author", `%${word}%`)
			.limit(5);

		const allMatches: BookRecord[] = [
			...(titleMatches || []),
			...(authorMatches || []),
		];

		// Удаляем дубликаты по ID
		const uniqueMatches = allMatches.filter(
			(bookItem, index, self) =>
				index === self.findIndex((b) => b.id === bookItem.id),
		);

		return uniqueMatches;
	});

	// Выполняем все поисковые запросы параллельно
	const results = await Promise.all(searchPromises);

	// Объединяем все результаты
	const allMatches: BookRecord[] = results.flat();

	// Удаляем дубликаты по ID
	const uniqueMatches = allMatches.filter(
		(bookItem, index, self) =>
			index === self.findIndex((b) => b.id === bookItem.id),
	);

	// Сортируем по релевантности (по количеству совпадений)
	const matchesWithScores = uniqueMatches.map((bookItem) => {
		const bookTitleWords = normalizeText(bookItem.title).split(/\s+/);
		const bookAuthorWords = normalizeText(bookItem.author).split(/\s+/);
		const allBookWords = [...bookTitleWords, ...bookAuthorWords];

		// Считаем количество совпадений поисковых слов с словами в книге
		let score = 0;
		for (const searchWord of allSearchWords) {
			let _found = false;
			for (const bookWord of allBookWords) {
				// Проверяем точное совпадение или частичное включение
				if (bookWord.includes(searchWord) || searchWord.includes(bookWord)) {
					score++;
					_found = true;
					break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
				}
			}
		}

		return { ...bookItem, score } as BookRecord & { score: number };
	});

	// Сортируем по убыванию счета
	matchesWithScores.sort((a, b) => (b.score || 0) - (a.score || 0));

	// Берем только лучшие совпадения и фильтруем по минимальной релевантности
	const topMatches = matchesWithScores.slice(0, 5);

	// Проверяем, есть ли среди них точно совпадающие книги
	for (const match of topMatches) {
		const matchTitle = normalizeText(match.title);
		const matchAuthor = normalizeText(match.author);

		// Проверяем точное совпадение
		if (matchTitle === normalizedTitle && matchAuthor === normalizedAuthor) {
			console.log(
				`⚠️  Exact duplicate found: "${match.title}" by ${match.author} (ID: ${match.id})`,
			);
			return true;
		}

		// Проверяем высокую релевантность (релевантность >= 75% слов)
		const relevance = (match.score || 0) / allSearchWords.length;
		if (relevance >= 0.75) {
			console.log(
				`⚠️  High relevance duplicate found: "${match.title}" by ${match.author} (ID: ${match.id}, relevance: ${(relevance * 100).toFixed(1)}%)`,
			);
			return true;
		}
	}

	console.log(`✅ No duplicates found`);
	return false;
}

async function addBookMetadata() {
	try {
		console.log("🚀 Getting all book metadata from Telegram...");

		const telegramService = await TelegramService.getInstance();
		const metadataChannel = await telegramService.getMetadataChannel();

		// Get all messages from the channel
		// @ts-expect-error
		const messages = await telegramService.getAllMessages(metadataChannel.id);

		if (messages && messages.length > 0) {
			console.log(
				`📚 Found ${messages.length} messages. Processing each one with deduplication...`,
			);

			let processedCount = 0;
			let skippedCount = 0;
			let duplicateCount = 0;

			// Process each message
			for (const message of messages) {
				// @ts-expect-error
				const messageText = message.text;
				// @ts-expect-error
				const messageId = message.id;

				if (!messageText) {
					console.log(
						`⚠️ Message ${messageId} does not contain any text. Skipping.`,
					);
					skippedCount++;
					continue;
				}

				// Check if this message has already been processed
				// @ts-expect-error
				const { data: existingRecord, error: checkError } = await serverSupabase
					.from("telegram_processed_messages")
					.select("id")
					.eq("message_id", messageId.toString())
					.single();

				if (checkError && checkError.code !== "PGRST116") {
					// PGRST116 means no rows returned
					console.error(
						`❌ Error checking if message ${messageId} is already processed:`,
						checkError,
					);
					skippedCount++;
					continue;
				}

				if (existingRecord) {
					console.log(`⏭️ Message ${messageId} already processed. Skipping.`);
					skippedCount++;
					continue;
				}

				try {
					console.log(`📝 Processing message ${messageId}...`);
					// @ts-expect-error
					const metadata = MetadataParser.parseMessage(messageText);

					// Проверка на наличие автора и названия
					if (!metadata.author || !metadata.title) {
						console.log(
							`⚠️ Message ${messageId} is missing author or title. Skipping.`,
						);
						skippedCount++;
						continue;
					}

					// Проверка на дубликаты
					const isDuplicate = await checkDuplicateBook(
						metadata.title,
						metadata.author,
					);
					if (isDuplicate) {
						console.log(`⏭️ Message ${messageId} is a duplicate. Skipping.`);
						duplicateCount++;
						// Помечаем сообщение как обработанное, чтобы не проверять его снова
						const processedTable: any = serverSupabase.from(
							"telegram_processed_messages",
						);
						await processedTable.insert([
							{
								message_id: messageId.toString(),
								channel: metadataChannel.id.toString(),
								book_id: null,
							},
						]);
						continue;
					}

					let coverUrl = null;
					// @ts-expect-error
					if (message.media) {
						console.log("🖼️ Cover found, downloading...");
						try {
							// @ts-expect-error
							const buffer = await telegramService.downloadMedia(message);
							if (buffer) {
								const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
								if (!coversBucket) {
									throw new Error(
										"S3_COVERS_BUCKET_NAME environment variable is not set.",
									);
								}
								const coverPath = `${messageId}_cover.jpg`;
								await putObject(coverPath, buffer, coversBucket);
								coverUrl = `https://${coversBucket}.s3.cloud.ru/${coverPath}`;
								console.log(
									`✅ Cover uploaded to S3 successfully: ${coverUrl}`,
								);
							}
						} catch (error) {
							console.error(
								`❌ Error uploading cover for message ${messageId} to S3:`,
								error,
							);
						}
					}

					let seriesId = null;
					// @ts-expect-error
					if (metadata.books && metadata.books.length > 0) {
						console.log("📚 This is a series, creating a series record...");
						const seriesData: any = {
							title: metadata.title,
							author: metadata.author,
							description: metadata.description,
							genres: metadata.genres,
							tags: metadata.tags,
							rating: metadata.rating,
							telegram_post_id: messageId.toString(),
							series_composition: metadata.books.map((b) => ({
								title: b.title,
								year: b.year,
							})),
						};
						if (coverUrl) {
							seriesData.cover_url = coverUrl;
						}

						// Workaround for TypeScript typing issue
						const seriesTable: any = serverSupabase.from("series");
						const seriesResult: any = await seriesTable.insert([seriesData]);

						if (seriesResult.error) {
							console.error(
								`❌ Error inserting series record for message ${messageId}:`,
								seriesResult.error,
							);
						} else {
							// Get the inserted series ID
							// @ts-expect-error
							const { data: newSeries, error: selectError }: any =
								await serverSupabase
									.from("series")
									.select("id")
									.eq("telegram_post_id", messageId.toString())
									.single();

							if (selectError) {
								console.error(
									`❌ Error retrieving series record for message ${messageId}:`,
									selectError,
								);
							} else {
								seriesId = newSeries.id;
								console.log(
									`✅ Series record created successfully with ID: ${seriesId}`,
								);
							}
						}
					}

					console.log("📚 Inserting book metadata into the database...");

					const bookData: any = {
						title: metadata.title,
						author: metadata.author,
						description: metadata.description,
						genres: metadata.genres,
						tags: metadata.tags,
						rating: metadata.rating,
						telegram_post_id: messageId.toString(),
					};

					if (coverUrl) {
						bookData.cover_url = coverUrl;
					}
					if (seriesId) {
						bookData.series_id = seriesId;
					}

					// Workaround for TypeScript typing issue
					const booksTable: any = serverSupabase.from("books");
					const bookResult: any = await booksTable.insert([bookData]);

					if (bookResult.error) {
						console.error(
							`❌ Error inserting book metadata for message ${messageId}:`,
							bookResult.error,
						);
					} else {
						console.log(
							`✅ Book metadata inserted successfully for message ${messageId}`,
						);

						// Get the inserted book ID
						// @ts-expect-error
						const { data: bookRecord, error: selectError }: any =
							await serverSupabase
								.from("books")
								.select("id")
								.eq("telegram_post_id", messageId.toString())
								.single();

						if (selectError) {
							console.error(
								`❌ Error retrieving book record for message ${messageId}:`,
								selectError,
							);
						} else {
							// Mark this message as processed
							// Workaround for TypeScript typing issue
							const processedTable: any = serverSupabase.from(
								"telegram_processed_messages",
							);
							const { error: processedError }: any =
								await processedTable.insert([
									{
										message_id: messageId.toString(),
										channel: metadataChannel.id.toString(),
										book_id: bookRecord.id,
									},
								]);

							if (processedError) {
								console.error(
									`❌ Error marking message ${messageId} as processed:`,
									processedError,
								);
							} else {
								console.log(`✅ Message ${messageId} marked as processed`);
								processedCount++;
							}
						}
					}
				} catch (error) {
					console.error(`❌ Error processing message ${messageId}:`, error);
					skippedCount++;
				}
			}

			console.log(
				`\n📊 Processing complete! Successfully processed: ${processedCount}, Skipped: ${skippedCount}, Duplicates: ${duplicateCount}`,
			);
		} else {
			console.log("⚠️ No messages found in the metadata channel.");
		}
	} catch (error) {
		console.error("❌ Error adding book metadata:", error);
	} finally {
		const telegramService = await TelegramService.getInstance();
		await telegramService.disconnect();
	}
}

addBookMetadata();
