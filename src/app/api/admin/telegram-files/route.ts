import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";

interface TelegramMessage {
	id: number;
	document?: {
		attributes?: Array<{ className?: string; fileName?: string }>;
		fileName?: string;
		size?: number;
		mimeType?: string;
	};
	media?: {
		document?: { fileName?: string; filename?: string; size?: number; mimeType?: string; mime_type?: string };
		photo?: { fileName?: string; filename?: string; size?: number; mimeType?: string; mime_type?: string };
	};
	message?: string;
	fileName?: string;
	date?: number;
}

/**
 * Извлекает оригинальное имя файла из сообщения Telegram
 */
function getOriginalFilename(message: TelegramMessage): string {
	let originalFilename = `file_${message.id}`;

	try {
		if (message.document) {
			if (message.document.attributes) {
				for (const attr of message.document.attributes) {
					if (
						attr &&
						attr.className === "DocumentAttributeFilename" &&
						attr.fileName
					) {
						originalFilename = attr.fileName;
						break;
					}
				}
			}

			if (
				originalFilename === `file_${message.id}` &&
				message.document.fileName
			) {
				originalFilename = message.document.fileName;
			}
		}

		if (originalFilename === `file_${message.id}` && message.fileName) {
			originalFilename = message.fileName;
		}

		if (originalFilename === `file_${message.id}` && message.media) {
			const media = message.media.document || message.media.photo;
			if (media?.fileName) {
				originalFilename = media.fileName;
			} else if (media?.filename) {
				originalFilename = media.filename;
			}
		}
	} catch (error) {
		console.warn(
			`Ошибка при извлечении имени файла для сообщения ${message.id}:`,
			error,
		);
	}

	return originalFilename;
}

/**
 * GET /api/admin/telegram-files
 * Получает список всех файлов из приватного Telegram канала
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const { TelegramService } = await import("@/lib/telegram/client");
		const telegramClient = await TelegramService.getInstance();

		try {
			const fileChannel = await telegramClient.getFilesChannel();

			const channelId =
				typeof fileChannel.id === "object" && fileChannel.id !== null
					? (fileChannel.id as { toString: () => string }).toString()
					: String(fileChannel.id);

			console.log(`📂 Загрузка файлов из канала ${channelId}...`);
			const messages = await telegramClient.getAllMessages(channelId, 10000);

			const files = (messages as TelegramMessage[])
				.filter(
					(msg) => msg.media && (msg.media.document || msg.media.photo),
				)
				.map((msg) => {
					const rawFileName = getOriginalFilename(msg);
					const normalizedFileName = rawFileName.normalize("NFC");
					const media = msg.media?.document || msg.media?.photo;

					return {
						message_id: msg.id,
						file_name: normalizedFileName,
						file_size: media?.size || 0,
						mime_type: media?.mimeType || media?.mime_type,
						caption: msg.message || "",
						date: msg.date || Date.now() / 1000,
					};
				});

			return NextResponse.json({
				files,
				total: files.length,
			});
		} catch (telegramError) {
			console.error("Telegram API error:", telegramError);
			return NextResponse.json(
				{
					error: "Failed to fetch files from Telegram",
					details: (telegramError as Error).message,
				},
				{ status: 500 },
			);
		}
	} catch (error) {
		console.error("Error getting Telegram files:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
