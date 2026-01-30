import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * API для получения истории всех операций админки
 * GET /api/admin/sync-results - получить последние результаты
 *
 * Поддерживаемые типы операций (job_type):
 * - full, update, auto: синхронизация книг
 * - file_index: индексация файлов Telegram
 * - stats_update: обновление статистики
 * - duplicates_resolve: удаление дубликатов
 * - file_link: привязка файлов к книгам
 */

// Максимальное количество записей для хранения
const MAX_RESULTS = 20;

// Типы операций
export type OperationType =
	| "full"
	| "update"
	| "auto"
	| "file_index"
	| "stats_update"
	| "duplicates_resolve"
	| "file_link";

// Интерфейс результата операции
export interface OperationResult {
	id: string;
	job_type: OperationType;
	status: "running" | "completed" | "failed";
	started_at: string;
	completed_at?: string;
	// Поля для синхронизации
	metadata_processed?: number;
	metadata_added?: number;
	metadata_updated?: number;
	metadata_skipped?: number;
	metadata_errors?: number;
	files_processed?: number;
	files_linked?: number;
	files_skipped?: number;
	files_errors?: number;
	// Общие поля
	error_message?: string;
	log_output?: string;
	details?: Record<string, unknown>; // Дополнительные данные операции
	created_at?: string;
}

async function checkAuthorization(
	request: NextRequest,
	supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
) {
	const authHeader = request.headers.get("authorization");

	if (!authHeader) {
		return {
			authorized: false,
			error: "Authorization header required",
			status: 401,
		};
	}

	const token = authHeader.replace("Bearer ", "");

	try {
		const {
			data: { user },
			error: authError,
		} = await supabaseAdmin.auth.getUser(token);

		if (authError || !user) {
			return { authorized: false, error: "Invalid token", status: 401 };
		}

		// Проверяем роль admin
		const { data: profile } = await supabaseAdmin
			.from("profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if ((profile as { role?: string } | null)?.role !== "admin") {
			return { authorized: false, error: "Admin access required", status: 403 };
		}

		return { authorized: true, userId: user.id };
	} catch (error) {
		console.error("Auth error:", error);
		return { authorized: false, error: "Authentication failed", status: 500 };
	}
}

export async function GET(request: NextRequest) {
	try {
		const supabaseAdmin = getSupabaseAdmin();

		if (!supabaseAdmin) {
			return NextResponse.json(
				{ error: "Supabase admin client not available" },
				{ status: 500 },
			);
		}

		// Проверяем авторизацию
		const authResult = await checkAuthorization(request, supabaseAdmin);
		if (!authResult.authorized) {
			return NextResponse.json(
				{ error: authResult.error },
				{ status: authResult.status },
			);
		}

		// Получаем параметры запроса
		const { searchParams } = new URL(request.url);
		const limit = Math.min(
			Number(searchParams.get("limit")) || MAX_RESULTS,
			50,
		);
		const jobType = searchParams.get("type"); // 'full' | 'update' | 'auto' | null

		// Формируем запрос (используем as any для работы с новой таблицей)
		let query = (supabaseAdmin as any)
			.from("sync_job_results")
			.select("*")
			.order("started_at", { ascending: false })
			.limit(limit);

		if (jobType) {
			query = query.eq("job_type", jobType);
		}

		const { data: results, error } = await query;

		if (error) {
			console.error("Error fetching sync results:", error);
			return NextResponse.json(
				{ error: `Failed to fetch results: ${error.message}` },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			results: (results as OperationResult[]) || [],
			count: results?.length || 0,
		});
	} catch (error) {
		console.error("Sync results API error:", error);
		return NextResponse.json(
			{ error: `Internal server error: ${(error as Error).message}` },
			{ status: 500 },
		);
	}
}

/**
 * Вспомогательная функция для сохранения результата синхронизации
 * Используется из других API endpoints
 */
export async function saveSyncResult(
	supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
	result: Omit<OperationResult, "id" | "created_at">,
): Promise<OperationResult | null> {
	// Используем as any для работы с новой таблицей без автогенерированных типов
	const { data, error } = await (supabaseAdmin as any)
		.from("sync_job_results")
		.insert(result)
		.select()
		.single();

	if (error) {
		console.error("Error saving sync result:", error);
		return null;
	}

	// Удаляем старые записи, оставляем только последние MAX_RESULTS
	await cleanupOldResults(supabaseAdmin);

	return data as OperationResult;
}

/**
 * Обновление существующего результата синхронизации
 */
export async function updateSyncResult(
	supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
	id: string,
	updates: Partial<Omit<OperationResult, "id" | "job_type" | "created_at">>,
): Promise<OperationResult | null> {
	// Используем as any для работы с новой таблицей без автогенерированных типов
	const { data, error } = await (supabaseAdmin as any)
		.from("sync_job_results")
		.update(updates)
		.eq("id", id)
		.select()
		.single();

	if (error) {
		console.error("Error updating sync result:", error);
		return null;
	}

	return data as OperationResult;
}

/**
 * Очистка старых записей
 */
async function cleanupOldResults(
	supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
) {
	try {
		// Получаем ID записей, которые нужно оставить
		const { data: recentResults } = await (supabaseAdmin as any)
			.from("sync_job_results")
			.select("id")
			.order("started_at", { ascending: false })
			.limit(MAX_RESULTS);

		if (!recentResults || recentResults.length < MAX_RESULTS) {
			return; // Нечего удалять
		}

		const keepIds = recentResults.map((r: { id: string }) => r.id);

		// Удаляем все записи, кроме последних MAX_RESULTS
		await (supabaseAdmin as any)
			.from("sync_job_results")
			.delete()
			.not("id", "in", `(${keepIds.join(",")})`);
	} catch (error) {
		console.error("Error cleaning up old results:", error);
	}
}
