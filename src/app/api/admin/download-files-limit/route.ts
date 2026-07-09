import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { TelegramService } from "@/lib/telegram/client";
import { FileProcessingService } from "@/lib/telegram/file-processing-service-enhanced";

interface TelegramMessage {
	id: number | string;
	media?: unknown;
	document?: {
		className?: string;
		attributes?: Array<{
			className?: string;
			fileName?: string;
		}>;
	};
	[key: string]: unknown;
}

/**
 * POST /api/admin/download-files-limit
 * Добавляет задачи загрузки файлов в очередь из Telegram с указанным лимитом
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		// Получаем лимит из тела запроса
		const body = await request.json();
		const limit = body.limit || 10; // По умолчанию 10 файлов

		console.log(
			`🚀 Добавление задач загрузки файлов в очередь с лимитом: ${limit}`,
		);

		// Получаем экземпляр Telegram клиента напрямую
		const telegramClient = await TelegramService.getInstance();

		// Получаем канал с файлами
		const channel = await telegramClient.getFilesChannel();

		// Convert BigInteger to string for compatibility
		const channelId =
			typeof channel.id === "object" && channel.id !== null
				? (channel.id as { toString: () => string }).toString()
				: String(channel.id);

		// Получаем сообщения с пагинацией
		console.log(`📥 Получаем сообщения (лимит: ${limit})...`);
		const messages = (await Promise.race([
			telegramClient.getMessages(channelId, limit),
			new Promise<TelegramMessage[]>((_, reject) =>
				setTimeout(() => reject(new Error("Timeout getting messages")), 60000),
			),
		])) as TelegramMessage[];
		console.log(
			`✅ Получено ${messages.length} сообщений для добавления в очередь\n`,
		);

		// Получаем экземпляр сервиса обработки файлов
		const fileService = await FileProcessingService.getInstance();

		// Обрабатываем файлы напрямую (вместо добавления в очередь)
		let addedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		for (const msg of messages) {
			const anyMsg = msg as TelegramMessage;

			// Проверяем, есть ли в сообщении медиа (файл)
			if (!anyMsg.media) {
				console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа, пропускаем`);
				skippedCount++;
				continue;
			}

			try {
				// Обрабатываем файл напрямую
				const result = await fileService.processSingleFile(anyMsg);
				if (result.success) {
					addedCount++;
					console.log(`  ✅ Файл обработан: ${anyMsg.id}`);
				} else {
					skippedCount++;
					console.log(
						`  ⚠️ Файл пропущен: ${anyMsg.id} - ${result.reason || "Неизвестная причина"}`,
					);
				}
			} catch (msgError) {
				console.error(`  ❌ Ошибка обработки файла ${anyMsg.id}:`, msgError);
				errorCount++;
			}
		}

		console.log(
			`✅ Обработка файлов завершена: ${addedCount} обработано, ${skippedCount} пропущено, ${errorCount} ошибок`,
		);

		// Формируем отчет об операции в простом текстовом формате с иконками
		let report = `📚 Результаты обработки файлов\n\n`;
		report += `📊 Статистика:\n`;
		report += `- Сообщений найдено: ${messages.length}\n`;
		report += `- Файлов обработано: ${addedCount}\n`;
		report += `- Пропущено: ${skippedCount}\n`;
		report += `- Ошибок: ${errorCount}\n\n`;

		if (addedCount > 0) {
			report += `✅ Обработанные файлы:\n`;
			let taskIndex = 1;
			for (const msg of messages) {
				const anyMsg = msg as TelegramMessage;
				if (anyMsg.media) {
					let filename = `book_${anyMsg.id}.fb2`;
					if (
						anyMsg.document &&
						(anyMsg.document as { [key: string]: unknown }).attributes
					) {
						const attributes = (anyMsg.document as { [key: string]: unknown })
							.attributes as unknown[];
						const attrFileName = attributes.find((attr: unknown) => {
							const attrObj = attr as { [key: string]: unknown };
							return attrObj.className === "DocumentAttributeFilename";
						}) as { [key: string]: unknown } | undefined;
						if (attrFileName?.fileName) {
							filename = attrFileName.fileName as string;
						}
					}
					report += `${taskIndex}. ${filename} (ID: ${anyMsg.id})\n`;
					taskIndex++;
				}
			}
			report += `\n📥 Файлы обработаны и загружены.\n\n`;
		}

		if (skippedCount > 0) {
			report += `⚠️ Пропущенные сообщения:\n`;
			let skippedIndex = 1;
			for (const msg of messages) {
				const anyMsg = msg as TelegramMessage;
				if (!anyMsg.media) {
					report += `${skippedIndex}. Сообщение ${anyMsg.id} (без медиа)\n`;
					skippedIndex++;
				}
			}
			report += `\n`;
		}

		if (errorCount > 0) {
			report += `❌ Ошибки:\n`;
			report += `- Количество ошибок: ${errorCount}\n\n`;
		}

		return NextResponse.json({
			message: "Обработка файлов завершена",
			results: {
				processed: addedCount,
				skipped: skippedCount,
				errors: errorCount,
				total: messages.length,
			},
			report,
		});
	} catch (error) {
		console.error("Ошибка обработки файлов:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
