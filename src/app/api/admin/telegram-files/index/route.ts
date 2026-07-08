import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import {
	saveSyncResult,
	updateSyncResult,
} from "@/app/api/admin/sync-results/route";
import { TelegramService } from "@/lib/telegram/client";

// Используем service role key для доступа ко всем данным
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Извлекает оригинальное имя файла из сообщения Telegram
 */
function getOriginalFilename(message: any): string | null {
	try {
		// Проверяем document.attributes
		if (message.document?.attributes) {
			for (const attr of message.document.attributes) {
				if (attr.className === "DocumentAttributeFilename" && attr.fileName) {
					return attr.fileName;
				}
			}
		}
		// Альтернативные пути
		if (message.document?.fileName) return message.document.fileName;
		if (message.fileName) return message.fileName;
		if (message.media?.document?.fileName)
			return message.media.document.fileName;

		// Проверяем media.document.attributes
		if (message.media?.document?.attributes) {
			for (const attr of message.media.document.attributes) {
				if (attr.className === "DocumentAttributeFilename" && attr.fileName) {
					return attr.fileName;
				}
			}
		}
	} catch (e) {
		// ignore
	}
	return null;
}

/**
 * Извлекает метаданные файла из сообщения Telegram
 */
function extractFileData(message: any): {
	message_id: number;
	file_name: string | null;
	file_size: number | null;
	mime_type: string | null;
	caption: string | null;
	date: Date | null;
} | null {
	if (!message || !message.id) return null;

	const doc = message.document || message.media?.document;
	if (!doc) return null; // Пропускаем сообщения без файлов

	const fileName = getOriginalFilename(message);
	const fileSize = doc.size || null;
	const mimeType = doc.mimeType || null;
	const caption = message.message || null;
	const date = message.date ? new Date(message.date * 1000) : null;

	return {
		message_id: message.id,
		file_name: fileName,
		file_size: fileSize,
		mime_type: mimeType,
		caption,
		date,
	};
}

/**
 * POST /api/admin/telegram-files/index
 * Запускает индексацию всех файлов из Telegram канала
 */
export async function POST(_request: NextRequest) {
	const startTime = Date.now();
	const logs: string[] = [];
	let operationId: string | null = null;

	const log = (msg: string) => {
		logs.push(msg);
	};

	try {
		log("🚀 Начинаем индексацию файлов из Telegram...");

		// Создаём запись об операции со статусом "running"
		const operation = await saveSyncResult(supabaseAdmin as any, {
			job_type: "file_index",
			status: "running",
			started_at: new Date().toISOString(),
			log_output: "🚀 Начало индексации файлов Telegram...",
		});
		if (operation) operationId = operation.id;

		// 1. Получаем Telegram клиент и канал
		const telegramClient = await TelegramService.getInstance();
		const channel = await telegramClient.getFilesChannel();

		log(`📡 Подключились к каналу: ${(channel as any).title || channel}`);

		// 2. Загружаем все сообщения из канала
		const allMessages = await telegramClient.getAllMessages(channel, 300, {
			onLog: log,
		});

		log(`📥 Загружено ${allMessages.length} сообщений`);

		// 3. Извлекаем данные о файлах
		const fileRecords: any[] = [];
		let skipped = 0;

		for (const msg of allMessages) {
			const fileData = extractFileData(msg);
			if (fileData?.file_name) {
				fileRecords.push(fileData);
			} else {
				skipped++;
			}
		}

		log(
			`📂 Найдено ${fileRecords.length} файлов (пропущено ${skipped} сообщений без файлов)`,
		);

		// 4. Upsert в базу данных пакетами по 500
		const batchSize = 500;
		let inserted = 0;
		const updated = 0;
		let errors = 0;

		for (let i = 0; i < fileRecords.length; i += batchSize) {
			const batch = fileRecords.slice(i, i + batchSize);

			const { error } = await supabaseAdmin
				.from("telegram_files")
				.upsert(batch, {
					onConflict: "message_id",
					ignoreDuplicates: false,
				});

			if (error) {
				log(
					`❌ Ошибка при сохранении пакета ${Math.floor(i / batchSize) + 1}: ${error.message}`,
				);
				errors += batch.length;
			} else {
				inserted += batch.length;
				log(
					`✅ Сохранен пакет ${Math.floor(i / batchSize) + 1}/${Math.ceil(fileRecords.length / batchSize)} (${batch.length} файлов)`,
				);
			}
		}

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		log(`\n🎉 Индексация завершена за ${duration}с`);
		log(
			`   📊 Всего: ${fileRecords.length}, Сохранено: ${inserted}, Ошибок: ${errors}`,
		);

		// Обновляем запись об операции
		if (operationId) {
			await updateSyncResult(supabaseAdmin as any, operationId, {
				status: "completed",
				completed_at: new Date().toISOString(),
				files_processed: fileRecords.length,
				files_linked: inserted,
				files_errors: errors,
				log_output: logs.join("\n"),
				details: {
					total_messages: allMessages.length,
					skipped,
					duration_seconds: parseFloat(duration),
				},
			});
		}

		return NextResponse.json({
			success: true,
			stats: {
				total_messages: allMessages.length,
				total_files: fileRecords.length,
				skipped,
				inserted,
				errors,
				duration_seconds: parseFloat(duration),
			},
			logs,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`❌ Критическая ошибка: ${errorMessage}`);

		// Обновляем запись об операции с ошибкой
		if (operationId) {
			await updateSyncResult(supabaseAdmin as any, operationId, {
				status: "failed",
				completed_at: new Date().toISOString(),
				error_message: errorMessage,
				log_output: logs.join("\n"),
			});
		}

		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
				logs,
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/admin/telegram-files/index
 * Возвращает статистику текущего индекса
 */
export async function GET(_request: NextRequest) {
	try {
		const { count, error } = await supabaseAdmin
			.from("telegram_files")
			.select("*", { count: "exact", head: true });

		if (error) throw error;

		// Получаем дату последней индексации
		const { data: lastIndexed } = await supabaseAdmin
			.from("telegram_files")
			.select("indexed_at")
			.order("indexed_at", { ascending: false })
			.limit(1)
			.single();

		return NextResponse.json({
			total_files: count || 0,
			last_indexed_at: lastIndexed?.indexed_at || null,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
}
