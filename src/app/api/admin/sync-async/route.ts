import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { BackgroundSyncHandler } from "@/lib/background-sync";
import { taskManager } from "@/lib/task-manager";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/sync-async
 * Асинхронно синхронизирует метаданные из Telegram канала с отображением прогресса
 */
export async function POST(request: NextRequest) {
	try {
		// Проверяем авторизацию
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Получаем токен из заголовка
		const token = authHeader.replace("Bearer ", "");

		// Проверяем пользователя через Supabase
		const {
			data: { user },
			error: authError,
		} = await supabaseAdmin.auth.getUser(token);

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Проверяем, что пользователь - админ
		const { data: profile, error: profileError } = await supabaseAdmin
			.from("user_profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (profileError || profile?.role !== "admin") {
			return NextResponse.json(
				{ error: "Forbidden: Admin access required" },
				{ status: 403 },
			);
		}

		// Получаем лимит из тела запроса или используем значение по умолчанию
		let limit = 10; // Значение по умолчанию
		try {
			const body = await request.json();
			limit = body.limit || limit;
		} catch (_e) {
			// Если не удалось получить тело запроса, используем значение по умолчанию
		}

		// Создаем уникальный ID для этой операции
		const operationId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Создаем задачу
		taskManager.createTask(operationId);

		// Запускаем фоновую синхронизацию в отдельном потоке
		setImmediate(() => {
			BackgroundSyncHandler.startSync(operationId, limit);
		});

		// Отправляем немедленный ответ с ID операции
		return NextResponse.json({
			message: "Операция синхронизации метаданных запущена",
			operationId,
			status: "started",
		});
	} catch (error) {
		console.error(
			"Ошибка запуска асинхронной синхронизации метаданных:",
			error,
		);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/admin/sync-async?operationId=...
 * Получает статус и прогресс операции синхронизации метаданных
 */
export async function GET(request: NextRequest) {
	try {
		// Проверяем авторизацию
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Получаем токен из заголовка
		const token = authHeader.replace("Bearer ", "");

		// Проверяем пользователя через Supabase
		const {
			data: { user },
			error: authError,
		} = await supabaseAdmin.auth.getUser(token);

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Проверяем, что пользователь - админ
		const { data: profile, error: profileError } = await supabaseAdmin
			.from("user_profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (profileError || profile?.role !== "admin") {
			return NextResponse.json(
				{ error: "Forbidden: Admin access required" },
				{ status: 403 },
			);
		}

		// Получаем ID операции из параметров запроса
		const operationId = request.nextUrl.searchParams.get("operationId");

		if (!operationId) {
			return NextResponse.json(
				{ error: "Missing operationId parameter" },
				{ status: 400 },
			);
		}

		// Получаем статус задачи
		const taskStatus = taskManager.getTaskStatus(operationId);

		if (!taskStatus) {
			return NextResponse.json(
				{ error: "Operation not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			operationId,
			status: taskStatus.status,
			progress: taskStatus.progress,
			message: taskStatus.message,
			result: taskStatus.result,
			createdAt: taskStatus.createdAt,
			updatedAt: taskStatus.updatedAt,
		});
	} catch (error) {
		console.error("Ошибка получения статуса операции:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
