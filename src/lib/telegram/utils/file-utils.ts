/**
 * Утилиты для работы с Telegram сообщениями
 */

import * as path from "node:path";

/**
 * Интерфейс для Telegram сообщения с файлом
 */
export interface TelegramFileMessage {
	id: number | string;
	fileName?: string;
	document?: {
		fileName?: string;
		mimeType?: string;
		attributes?: Array<{
			className?: string;
			fileName?: string;
		}>;
	};
	media?: {
		document?: {
			fileName?: string;
			mimeType?: string;
			attributes?: Array<{
				className?: string;
				fileName?: string;
			}>;
		};
	};
	mimeType?: string;
	file_size?: number;
}

/**
 * Извлекает имя файла из Telegram сообщения
 * Проверяет все возможные источники имени файла
 *
 * @param message Telegram сообщение
 * @param defaultExtension Расширение по умолчанию (если не удалось определить)
 * @returns Нормализованное имя файла
 */
export function extractFilename(
	message: TelegramFileMessage,
	defaultExtension = ".fb2",
): string {
	const sources: Array<() => string | undefined | null> = [
		// 1. DocumentAttributeFilename из document.attributes
		() => {
			const attrs = message.document?.attributes;
			if (!attrs || !Array.isArray(attrs)) return undefined;

			const fileAttr = attrs.find(
				(attr) => attr.className === "DocumentAttributeFilename",
			);
			return fileAttr?.fileName;
		},

		// 2. DocumentAttributeFilename из media.document.attributes
		() => {
			const attrs = message.media?.document?.attributes;
			if (!attrs || !Array.isArray(attrs)) return undefined;

			const fileAttr = attrs.find(
				(attr) => attr.className === "DocumentAttributeFilename",
			);
			return fileAttr?.fileName;
		},

		// 3. document.fileName напрямую
		() => message.document?.fileName,

		// 4. media.document.fileName
		() => message.media?.document?.fileName,

		// 5. message.fileName
		() => message.fileName,
	];

	for (const source of sources) {
		try {
			const name = source();
			if (name && typeof name === "string" && name.trim().length > 0) {
				// Нормализуем Unicode (NFC) для консистентности
				return name.normalize("NFC");
			}
		} catch {}
	}

	// Если имя не найдено, генерируем на основе ID сообщения
	return `book_${message.id}${defaultExtension}`;
}

/**
 * Извлекает MIME-тип из Telegram сообщения
 */
export function extractMimeType(message: TelegramFileMessage): string {
	return (
		message.mimeType ||
		message.document?.mimeType ||
		message.media?.document?.mimeType ||
		"application/octet-stream"
	);
}

/**
 * Извлекает расширение файла из имени
 */
export function extractExtension(filename: string): string {
	const ext = path.extname(filename);
	return ext || ".fb2";
}

/**
 * Определяет формат файла для базы данных
 * Возвращает только допустимые форматы: fb2, zip
 */
export function getFileFormat(filename: string): "fb2" | "zip" {
	const ext = extractExtension(filename).toLowerCase().normalize("NFC");

	const formatMap: Record<string, "fb2" | "zip"> = {
		".fb2": "fb2",
		".zip": "zip",
	};

	return formatMap[ext] || "fb2";
}

/**
 * Определяет Content-Type по расширению файла
 */
export function getMimeTypeByExtension(filename: string): string {
	const ext = extractExtension(filename).toLowerCase().normalize("NFC");

	const mimeTypes: Record<string, string> = {
		".fb2": "application/fb2+xml",
		".zip": "application/zip",
		".epub": "application/epub+zip",
		".pdf": "application/pdf",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".webp": "image/webp",
	};

	return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Санитизирует имя файла для использования в S3
 * Удаляет недопустимые символы
 */
export function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_") // Заменяем недопустимые символы
		.replace(/^\.+/, "") // Удаляем точки в начале
		.replace(/\.+$/, "") // Удаляем точки в конце
		.substring(0, 255); // Ограничиваем длину
}

/**
 * Генерирует ключ для хранения файла в S3
 * Формат: {messageId}.{extension}
 */
export function generateStorageKey(
	messageId: number | string,
	filename: string,
): string {
	const ext = extractExtension(filename);
	return sanitizeFilename(`${messageId}${ext}`);
}

/**
 * Проверяет, является ли файл техническим (эскиз, превью)
 */
export function isTechnicalFile(filename: string): boolean {
	const technicalPatterns = [
		"_thumb.jpg",
		".pdf_thumb",
		"_preview",
		"_thumbnail",
	];

	const lowerFilename = filename.toLowerCase();
	return technicalPatterns.some((pattern) => lowerFilename.includes(pattern));
}
