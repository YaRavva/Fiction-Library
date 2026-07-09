import { type NextRequest, NextResponse } from "next/server";
import {
	saveSyncResult,
	updateSyncResult,
} from "@/app/api/admin/sync-results/route";
import { requireAdminRequest } from "@/lib/admin-auth";
import type { Database } from "@/lib/database.types";
import { getSupabaseAdmin } from "@/lib/supabase";
import { TelegramService } from "@/lib/telegram/client";
import { ensureFileEmbedding } from "@/lib/telegram/unified-file-matcher";

interface TelegramDocumentAttr {
	className?: string;
	fileName?: string;
}

interface TelegramDocument {
	attributes?: TelegramDocumentAttr[];
	fileName?: string;
	size?: number;
	mimeType?: string;
}

interface TelegramMedia {
	document?: TelegramDocument;
	photo?: TelegramDocument;
}

interface TelegramMessage {
	id: number;
	document?: TelegramDocument;
	media?: TelegramMedia;
	message?: string;
	fileName?: string;
	date?: number;
}

interface TelegramChannel {
	id: number | string;
	title?: string;
}

/**
 * Извлекает оригинальное имя файла из сообщения Telegram
 */
function getOriginalFilename(message: TelegramMessage): string | null {
	try {
		if (message.document?.attributes) {
			for (const attr of message.document.attributes) {
				if (attr.className === "DocumentAttributeFilename" && attr.fileName) {
					return attr.fileName;
				}
			}
		}
		if (message.document?.fileName) return message.document.fileName;
		if (message.fileName) return message.fileName;
		if (message.media?.document?.fileName)
			return message.media.document.fileName;

		if (message.media?.document?.attributes) {
			for (const attr of message.media.document.attributes) {
				if (attr.className === "DocumentAttributeFilename" && attr.fileName) {
					return attr.fileName;
				}
			}
		}
	} catch (_e) {
		// ignore
	}
	return null;
}

/**
 * Извлекает метаданные файла из сообщения Telegram
 */
function extractFileData(message: TelegramMessage): {
	message_id: number;
	file_name: string | null;
	file_size: number | null;
	mime_type: string | null;
	caption: string | null;
	date: string | null;
} | null {
	if (!message?.id) return null;

	const doc = message.document || message.media?.document;
	if (!doc) return null;

	const fileName = getOriginalFilename(message);
	const fileSize = doc.size || null;
	const mimeType = doc.mimeType || null;
	const caption = message.message || null;
	const date = message.date
		? new Date(message.date * 1000).toISOString()
		: null;

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
export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const logs: string[] = [];
	let operationId: string | null = null;

	const log = (msg: string) => {
		logs.push(msg);
	};

	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;
		const { admin: supabaseAdmin } = auth;

		log("🚀 Начинаем индексацию файлов из Telegram...");

		const operation = await saveSyncResult(supabaseAdmin, {
			job_type: "file_index",
			status: "running",
			started_at: new Date().toISOString(),
			log_output: "🚀 Начало индексации файлов Telegram...",
		});
		if (operation) operationId = operation.id;

		const telegramClient = await TelegramService.getInstance();
		const channel = await telegramClient.getFilesChannel();

		log(
			`Подключились к каналу: ${(channel as unknown as TelegramChannel).title || channel}`,
		);

		const allMessages = await telegramClient.getAllMessages(channel, 300, {
			onLog: log,
		});

		log(`📥 Загружено ${allMessages.length} сообщений`);

		const fileRecords: Database["public"]["Tables"]["telegram_files"]["Insert"][] =
			[];
		let skipped = 0;

		for (const msg of allMessages as TelegramMessage[]) {
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

		const batchSize = 500;
		let inserted = 0;
		let errors = 0;

		for (let i = 0; i < fileRecords.length; i += batchSize) {
			const batch = fileRecords.slice(i, i + batchSize);

			const { error } = await (supabaseAdmin as any)
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

		if (inserted > 0) {
			log(`\n⏳ Запуск генерации эмбеддингов для ${inserted} файлов в фоне...`);
		}

		if (operationId) {
			await updateSyncResult(supabaseAdmin, operationId, {
				status: "completed",
				completed_at: new Date().toISOString(),
				files_processed: fileRecords.length,
				files_linked: inserted,
				files_errors: errors,
				log_output: logs.join("\n"),
				details: {
					total_messages: allMessages.length,
					skipped,
					embeddings_queued: inserted,
					duration_seconds: parseFloat(duration),
				},
			});
		}

		// Генерация эмбеддингов для всех новых файлов — в фоне, не блокируя ответ
		// Лимит = количество вставленных файлов (все новые файлы)
		const filesNeedingEmbeddings = inserted;
		if (filesNeedingEmbeddings > 0) {
			(supabaseAdmin as any)
				.from("telegram_files")
				.select("message_id, file_name")
				.is("embedding", null)
				.limit(filesNeedingEmbeddings)
				.then(
					async ({
						data,
					}: {
						data: { message_id: number; file_name: string | null }[] | null;
					}) => {
						if (!data || data.length === 0) return;
						let embeddingsGenerated = 0;
						for (const f of data) {
							const success = await ensureFileEmbedding(
								supabaseAdmin,
								f.message_id,
								f.file_name ?? "",
							);
							if (success) embeddingsGenerated++;
						}
						log(
							`\n✨ Сгенерировано эмбеддингов: ${embeddingsGenerated}/${data.length}`,
						);
					},
				)
				.catch(() => {});
		}

		return NextResponse.json({
			success: true,
			stats: {
				total_messages: allMessages.length,
				total_files: fileRecords.length,
				skipped,
				inserted,
				errors,
				embeddings_queued: inserted, // Все вставленные файлы будут иметь эмбеддинги
				duration_seconds: parseFloat(duration),
			},
			logs,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`❌ Критическая ошибка: ${errorMessage}`);

		if (operationId) {
			await updateSyncResult(getSupabaseAdmin()!, operationId, {
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
export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;
		const { admin: supabaseAdmin } = auth;

		const { count, error } = await (supabaseAdmin as any)
			.from("telegram_files")
			.select("*", { count: "exact", head: true });

		if (error) throw error;

		const { data: lastIndexed } = await (supabaseAdmin as any)
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
