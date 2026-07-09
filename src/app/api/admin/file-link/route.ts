import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { TelegramSyncService } from "@/lib/telegram/sync";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/sync-files
 * Сканирует канал "Архив для фантастики" и добавляет файлы в очередь загрузки
 *
 * Body:
 * - limit: number (опционально) - количество сообщений для обработки (по умолчанию 10)
 * - addToQueue: boolean (опционально) - добавлять ли файлы в очередь (по умолчанию true)
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;
		// Получаем параметры из body
		const body = await request.json();
		const { limit = 10, addToQueue = true } = body;

		// Запускаем синхронизацию файлов
		const syncService = await TelegramSyncService.getInstance();
		const results = await syncService.downloadFilesFromArchiveChannel(
			limit,
			addToQueue,
		);

		return NextResponse.json({
			message: `Успешно обработано ${results.length} файлов`,
			files: results,
		});
	} catch (error) {
		console.error("Ошибка синхронизации файлов из канала архива:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
