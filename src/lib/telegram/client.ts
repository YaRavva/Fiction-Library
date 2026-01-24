import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export class TelegramService {
	private client: TelegramClient;
	private static instance: TelegramService;
	private isConnected: boolean = false;

	private constructor() {
		const apiId = process.env.TELEGRAM_API_ID;
		const apiHash = process.env.TELEGRAM_API_HASH;
		const sessionString = process.env.TELEGRAM_SESSION;

		if (!apiId || !apiHash || !sessionString) {
			throw new Error(
				"TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELELEGRAM_SESSION must be set in environment variables",
			);
		}

		const session = new StringSession(sessionString);
		this.client = new TelegramClient(session, parseInt(apiId, 10), apiHash, {
			connectionRetries: 5,
		});
	}

	public static async getInstance(): Promise<TelegramService> {
		if (!TelegramService.instance) {
			TelegramService.instance = new TelegramService();
		}

		// Проверяем, подключен ли клиент, и подключаемся, если нет
		await TelegramService.instance.ensureConnected();

		return TelegramService.instance;
	}

	private async ensureConnected(): Promise<void> {
		try {
			// Проверяем соединение, отправив тестовый запрос
			if (!this.isConnected) {
				await this.client.connect();
				this.isConnected = true;
			}

			// Проверяем соединение, отправив тестовый запрос
			await this.client.getMe();
		} catch (_error) {
			console.log("Connection lost, reconnecting...");
			try {
				await this.client.connect();
				this.isConnected = true;

				// Проверяем соединение после переподключения
				await this.client.getMe();
			} catch (reconnectError) {
				this.isConnected = false;
				console.error("Error reconnecting Telegram client:", reconnectError);
				throw reconnectError;
			}
		}
	}

	public async getMetadataChannel() {
		await this.ensureConnected();

		const channelUrl = process.env.TELEGRAM_METADATA_CHANNEL;
		if (!channelUrl) {
			throw new Error("TELEGRAM_METADATA_CHANNEL must be set");
		}

		try {
			// Extract channel identifier from URL
			let channelIdentifier = channelUrl;
			if (channelUrl.startsWith("http")) {
				const url = new URL(channelUrl);
				if (url.pathname.startsWith("/+")) {
					// This is an invite link, we need to join the channel first
					const inviteHash = url.pathname.substring(2); // Remove the leading '/+'
					try {
						// Try to join the channel using the invite link
						const result = await this.client.invoke(
							new Api.messages.ImportChatInvite({
								hash: inviteHash,
							}),
						);
						// After joining, we should be able to get the entity using the chat ID
						// The result contains the chat information
						if (result && "chats" in result && result.chats.length > 0) {
							// Use the actual chat ID instead of the invite hash
							// Convert BigInteger to string
							channelIdentifier = result.chats[0].id.toString();
						} else {
							// Fallback to using the invite hash directly
							channelIdentifier = inviteHash;
						}
					} catch (joinError: any) {
						// If user is already participant, we can try to access the channel directly
						if (
							joinError &&
							joinError.errorMessage === "USER_ALREADY_PARTICIPANT"
						) {
							console.log(
								"User is already participant, trying to access channel directly",
							);
							channelIdentifier = inviteHash;
						} else {
							console.warn(
								"Could not join channel via invite link, trying direct access:",
								joinError,
							);
							channelIdentifier = inviteHash;
						}
					}
				} else {
					// This is a regular channel link, extract the username
					channelIdentifier = url.pathname.substring(1); // Remove the leading '/'
				}
			}

			console.log(
				"Получаем сущность канала с идентификатором:",
				channelIdentifier,
			);
			const entity = await this.client.getEntity(channelIdentifier);
			console.log(
				"Получена сущность канала:",
				entity?.constructor?.name,
				(entity as any)?.id,
				(entity as any)?.username,
				(entity as any)?.title,
			);
			return entity;
		} catch (error) {
			console.error("Error getting metadata channel:", error);
			throw error;
		}
	}

	public async getFilesChannel() {
		await this.ensureConnected();

		// Используем прямой доступ к каналу по ID вместо invite link
		const logMessage =
			'📚 Получаем доступ к каналу "Архив для фантастики" по ID...';
		console.log(logMessage);
		if (
			typeof window !== "undefined" &&
			(window as any).updateFileSearchResults
		) {
			(window as any).updateFileSearchResults(`${logMessage}\n`);
		}
		const channelId = 1515159552; // ID канала "Архив для фантастики"

		try {
			const entity = await this.client.getEntity(
				new Api.PeerChannel({ channelId: bigInt(channelId) }),
			);
			return entity;
		} catch (error) {
			console.error("Error getting files channel by ID:", error);
			throw error;
		}
	}

	public async getMessages(
		chatId: any,
		limit: number = 10,
		offsetId?: number,
		options: {
			minId?: number;
			maxId?: number;
			reverse?: boolean;
			ids?: number[];
		} = {},
	): Promise<unknown[]> {
		await this.ensureConnected();

		try {
			// Если переданы конкретные ID, используем их
			if (options.ids && options.ids.length > 0) {
				const messages = await this.client.getMessages(chatId, {
					ids: options.ids,
				});
				return messages;
			}

			// Для получения конкретного сообщения по offsetId (старое поведение для совместимости)
			if (offsetId !== undefined && limit === 1 && !options.minId) {
				const messages = await this.client.getMessages(chatId, {
					ids: [offsetId],
				});
				return messages;
			}

			// Формируем параметры запроса
			const requestOptions: any = {
				limit,
			};

			if (offsetId !== undefined) {
				requestOptions.offsetId = offsetId;
				requestOptions.addOffset = 0;
			}

			if (options.minId !== undefined) {
				requestOptions.minId = options.minId;
			}

			if (options.maxId !== undefined) {
				requestOptions.maxId = options.maxId;
			}

			if (options.reverse !== undefined) {
				requestOptions.reverse = options.reverse;
			}

			const messages = await this.client.getMessages(chatId, requestOptions);
			return messages;
		} catch (error) {
			console.error("Error getting messages:", error);
			throw error;
		}
	}

	/**
	 * Получает все сообщения из канала с постраничной загрузкой
	 * @param chatId ID чата или канала
	 * @param batchSize Размер пакета для загрузки (по умолчанию 300)
	 * @returns Массив всех сообщений из канала
	 */
	public async getAllMessages(
		chatId: any,
		batchSize: number = 300,
		options: { onLog?: (msg: string) => void } = {},
	): Promise<unknown[]> {
		await this.ensureConnected();

		try {
			const logMessage = `📥 Получение всех сообщений из канала (пакетами по ${batchSize})...`;
			console.log(logMessage);
			if (options.onLog) options.onLog(logMessage);

			const allMessages: unknown[] = [];
			let offsetId: number | undefined;
			let batchCount = 0;

			while (true) {
				batchCount++;
				const batchLogMessage = `   Загрузка пакета ${batchCount} сообщений (offsetId: ${offsetId || "начало"})...`;
				console.log(batchLogMessage);
				if (options.onLog) options.onLog(batchLogMessage);

				// Получаем пакет сообщений
				const messages = await this.client.getMessages(chatId, {
					limit: batchSize,
					offsetId: offsetId,
					addOffset: 0,
				});

				// Если сообщений нет, выходим из цикла
				if (messages.length === 0) {
					break;
				}

				// Добавляем сообщения в общий массив
				allMessages.push(...messages);
				const totalLogMessage = `   Получено ${messages.length} сообщений. Всего: ${allMessages.length}`;
				console.log(totalLogMessage);
				if (options.onLog) options.onLog(totalLogMessage);

				// Если получено меньше сообщений, чем batchSize, значит, больше сообщений нет
				if (messages.length < batchSize) {
					break;
				}

				// Устанавливаем offsetId для следующего запроса
				// Берем минимальный ID из текущего пакета для следующей итерации, так как Telegram API возвращает сообщения в порядке убывания ID
				const messageIds = messages
					.map((msg) => (msg as { id?: number }).id)
					.filter((id) => id !== undefined && id > 0) as number[];

				if (messageIds.length > 0) {
					offsetId = Math.min(...messageIds) - 1; // Вычитаем 1, чтобы не дублировать уже обработанное сообщение
				} else {
					break;
				}

				// Пауза в 500 мс между запросами, чтобы не перегружать Telegram API
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			const finalLogMessage = `✅ Всего получено сообщений: ${allMessages.length}`;
			console.log(finalLogMessage);
			if (options.onLog) options.onLog(finalLogMessage);
			return allMessages;
		} catch (error) {
			console.error("Error getting all messages:", error);
			throw error;
		}
	}

	public async downloadFile(_fileId: string): Promise<Buffer> {
		try {
			// This is a placeholder - we'll need to implement proper file downloading
			throw new Error("downloadFile not implemented for session-based client");
		} catch (error) {
			console.error("Error downloading file:", error);
			throw error;
		}
	}

	// Addeded methods for sync.ts
	public async downloadMedia(message: unknown): Promise<Buffer> {
		try {
			if (!this.client) {
				throw new Error("Telegram client not initialized");
			}

			// Download media from the message
			// We need to cast to any to avoid type issues with the Telegram library
			const buffer = await this.client.downloadMedia(message as any, {});

			if (!buffer) {
				throw new Error("Failed to download media");
			}

			// Convert to Buffer if it's not already
			if (Buffer.isBuffer(buffer)) {
				return buffer;
			} else {
				// For other types, we assume it's a Uint8Array or similar
				return Buffer.from(buffer as unknown as Uint8Array);
			}
		} catch (error) {
			console.error("Error downloading media:", error);
			throw error;
		}
	}

	/**
	 * Получает сущность канала по ID напрямую
	 * @param channelId ID канала
	 * @returns Сущность канала
	 */
	public async getChannelEntityById(channelId: number): Promise<unknown> {
		await this.ensureConnected();

		try {
			const entity = await this.client.getEntity(
				new Api.PeerChannel({ channelId: bigInt(channelId) }),
			);
			return entity;
		} catch (error) {
			console.error(`Error getting channel entity by ID ${channelId}:`, error);
			throw error;
		}
	}

	public async disconnect(): Promise<void> {
		try {
			if (this.client && this.isConnected) {
				await this.client.disconnect();
				this.isConnected = false;
			}
		} catch (error) {
			console.error("Error disconnecting Telegram client:", error);
		}
	}

	/**
	 * Получает конкретное сообщение по его ID
	 * @param chatId ID чата или канала
	 * @param messageId ID сообщения
	 * @returns Сообщение или null, если не найдено
	 */
	public async getMessageById(
		chatId: any,
		messageId: number,
	): Promise<unknown | null> {
		await this.ensureConnected();

		try {
			console.log(`🔍 Получение сообщения с ID ${messageId}...`);

			// Получаем конкретное сообщение по ID
			const messages = await this.client.getMessages(chatId, {
				ids: [messageId],
			});

			// Возвращаем первое (и единственное) сообщение, если оно найдено
			if (messages && messages.length > 0) {
				console.log(`✅ Сообщение с ID ${messageId} найдено`);
				return messages[0];
			} else {
				console.log(`⚠️ Сообщение с ID ${messageId} не найдено`);
				return null;
			}
		} catch (error) {
			console.error(`Ошибка при получении сообщения с ID ${messageId}:`, error);
			return null;
		}
	}
}
