import dotenv from "dotenv";
import { serverSupabase } from "../lib/serverSupabase";
import { TelegramService } from "../lib/telegram/client";
import { MetadataParser } from "../lib/telegram/parser";

dotenv.config();

// Определяем интерфейс для книги
interface Book {
	id: string;
	title: string;
	author: string;
}

async function countUniqueBooks() {
	console.log("🔍 Counting unique books in Telegram channel...");

	try {
		// Инициализируем Telegram клиент
		console.log("\n📱 Initializing Telegram client...");
		const telegramService = await TelegramService.getInstance();

		// Получаем канал с метаданными
		console.log("📡 Getting metadata channel...");
		const channel = await telegramService.getMetadataChannel();

		// Convert BigInteger to string for compatibility
		const channelId =
			typeof channel.id === "object" && channel.id !== null
				? (channel.id as { toString: () => string }).toString()
				: String(channel.id);

		console.log(`✅ Connected to channel ID: ${channelId}`);

		// Получаем все книги из базы данных для сравнения
		console.log("\n📚 Loading existing books from database for comparison...");
		const { data: existingBooks, error: booksError } = await serverSupabase
			.from("books")
			.select("id, title, author");

		if (booksError) {
			throw new Error(
				`Error loading books from database: ${booksError.message}`,
			);
		}

		// Создаем карту существующих книг для быстрого поиска
		const existingBooksMap = new Map<string, Book>();
		existingBooks?.forEach((book: Book) => {
			const key = `${book.author}|${book.title}`;
			existingBooksMap.set(key, book);
		});

		console.log(
			`✅ Loaded ${existingBooks?.length || 0} existing books from database`,
		);

		// Получаем сообщения из Telegram канала и анализируем их
		let totalMessages = 0;
		let bookMessages = 0;
		let offsetId: number | undefined;
		const batchSize = 100;
		const bookSet = new Set<string>(); // Для отслеживания уникальных книг в Telegram
		let processed = 0;

		console.log("\n📥 Starting to scan Telegram channel...");

		while (true) {
			try {
				console.log(
					`\n🔄 Getting messages batch (offsetId: ${offsetId || "start"}, batchSize: ${batchSize})...`,
				);
				const messages = (await telegramService.getMessages(
					channelId,
					batchSize,
					offsetId,
				)) as any[];

				console.log(`📥 Received ${messages?.length || 0} messages`);

				if (!messages || messages.length === 0) {
					console.log("🔚 No more messages to process");
					break;
				}

				totalMessages += messages.length;

				// Обрабатываем каждое сообщение
				for (const message of messages) {
					try {
						// Извлекаем текст сообщения
						let messageText = "";
						if (message && typeof message === "object") {
							if (
								"message" in message &&
								message.message &&
								typeof message.message === "string"
							) {
								messageText = message.message;
							} else if (
								"text" in message &&
								message.text &&
								typeof message.text === "string"
							) {
								messageText = message.text;
							}
						}

						if (
							messageText &&
							typeof messageText === "string" &&
							messageText.trim() !== ""
						) {
							try {
								// Пытаемся распарсить сообщение как метаданные книги
								const metadata = MetadataParser.parseMessage(messageText);

								// Проверяем, выглядит ли это как книга (есть автор и название)
								if (metadata.author && metadata.title) {
									bookMessages++;
									const bookKey = `${metadata.author}|${metadata.title}`;

									// Добавляем в набор уникальных книг
									if (!bookSet.has(bookKey)) {
										bookSet.add(bookKey);
										console.log(
											`🆕 New unique book: "${metadata.title}" by ${metadata.author}`,
										);
									}
								}
							} catch (_parseError) {
								// Не сообщение с книгой, пропускаем
							}
						}
					} catch (_messageError) {
						// Ошибка обработки отдельного сообщения, продолжаем с другими
						continue;
					}

					processed++;

					// Показываем прогресс каждые 50 сообщений
					if (processed % 50 === 0) {
						console.log(
							`📊 Progress: ${processed} messages processed, ${bookSet.size} unique books found`,
						);
					}
				}

				// Устанавливаем offsetId для следующей партии
				const lastMessage = messages[messages.length - 1];
				if (lastMessage?.id) {
					offsetId = lastMessage.id;
					console.log(`⏭️  Next batch will start from message ID: ${offsetId}`);
				} else {
					console.log("🔚 Could not get last message ID, ending loop");
					break;
				}

				// Добавляем задержку, чтобы не перегружать Telegram API
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (batchError) {
				console.error("❌ Error getting message batch:", batchError);
				break; // Прерываем цикл при ошибке получения сообщений
			}
		}

		console.log("\n📈 === FINAL RESULTS ===");
		console.log(`📧 Total messages processed: ${totalMessages}`);
		console.log(`📚 Messages with book metadata: ${bookMessages}`);
		console.log(`🆕 Unique books found in Telegram: ${bookSet.size}`);
		console.log(`💾 Books already in database: ${existingBooks?.length || 0}`);

		// Показываем несколько примеров уникальных книг
		console.log("\n📋 Sample of unique books found:");
		let count = 0;
		for (const bookKey of bookSet) {
			if (count >= 10) break;
			const [author, title] = bookKey.split("|");
			console.log(`  • "${title}" by ${author}`);
			count++;
		}

		if (bookSet.size > 10) {
			console.log(`  ... and ${bookSet.size - 10} more`);
		}

		console.log("\n✅ Counting completed successfully");
	} catch (error) {
		console.error("❌ Error during counting:", error);
	} finally {
		// Отключаем Telegram клиент
		try {
			const telegramService = await TelegramService.getInstance();
			await telegramService.disconnect();
			console.log("📱 Telegram client disconnected");
		} catch (disconnectError) {
			console.error("⚠️  Error disconnecting Telegram client:", disconnectError);
		}
	}
}

// Run the script
countUniqueBooks().catch(console.error);
