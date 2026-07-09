import { putObject } from "../s3";
import type { TelegramService } from "./client";

interface CoverDownloadResult {
	coverUrls: string[];
}

async function downloadWithRetry(
	telegramClient: TelegramService,
	media: unknown,
	maxRetries = 3,
): Promise<Buffer | null> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`    → Попытка загрузки ${attempt}/${maxRetries}...`);
			const result = await Promise.race([
				telegramClient.downloadMedia(media),
				new Promise<never>((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(
									`Timeout: Downloading media took too long (attempt ${attempt}/${maxRetries})`,
								),
							),
						60000,
					),
				),
			]);
			return result instanceof Buffer ? result : null;
		} catch (err: unknown) {
			console.warn(
				`    ⚠️ Попытка ${attempt} не удалась:`,
				err instanceof Error ? err.message : "Unknown error",
			);
			if (attempt === maxRetries) return null;
			await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
		}
	}
	return null;
}

async function uploadCoverToS3(
	messageId: number,
	photoBuffer: Buffer,
): Promise<string | null> {
	const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
	if (!coversBucket) {
		console.warn("S3_COVERS_BUCKET_NAME not set, skipping cover upload");
		return null;
	}

	const photoKey = `${messageId}_${Date.now()}.jpg`;
	console.log(`  → Загружаем в Storage: covers/${photoKey}`);
	await putObject(photoKey, photoBuffer, coversBucket, "image/jpeg");
	return `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
}

/**
 * Скачивает обложку из сообщения Telegram и загружает в S3.
 * Поддерживает MessageMediaWebPage, MessageMediaPhoto и document images.
 */
export async function downloadCoverFromMessage(
	telegramClient: TelegramService,
	messageId: number,
	media: unknown,
): Promise<CoverDownloadResult> {
	const coverUrls: string[] = [];
	const mediaAny = media as {
		className: string;
		webpage?: { photo?: unknown };
		photo?: unknown;
		document?: { mimeType?: string };
	};

	try {
		let photoSource: unknown = null;

		if (
			mediaAny.className === "MessageMediaWebPage" &&
			mediaAny.webpage?.photo
		) {
			console.log(`  → Веб-превью с фото`);
			photoSource = mediaAny.webpage.photo;
		} else if (mediaAny.photo) {
			console.log(`  → Одиночное фото`);
			photoSource = media;
		} else if (mediaAny.document?.mimeType?.startsWith("image/")) {
			console.log(`  → Изображение (документ: ${mediaAny.document.mimeType})`);
			photoSource = media;
		}

		if (!photoSource) return { coverUrls };

		console.log(`  → Скачиваем фото...`);
		const photoBuffer = await downloadWithRetry(telegramClient, photoSource);
		if (!photoBuffer) {
			console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
			return { coverUrls };
		}

		const url = await uploadCoverToS3(messageId, photoBuffer);
		if (url) {
			coverUrls.push(url);
			console.log(`  ✅ Обложка загружена: ${url}`);
		}
	} catch (err: unknown) {
		console.error(
			`  ❌ Ошибка загрузки обложки:`,
			err instanceof Error ? err.message : "Unknown error",
		);
	}

	return { coverUrls };
}
