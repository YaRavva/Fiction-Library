import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { BackgroundDownloadHandler } from "@/lib/background-download";
import { taskManager } from "@/lib/task-manager";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/download-files
 * Запускает асинхронную загрузку отсутствующих файлов книг с отображением прогресса
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
		let limit = 50; // Значение по умолчанию
		try {
			const body = await request.json();
			limit = body.limit || limit;
		} catch (_e) {
			// Если не удалось получить тело запроса, используем значение по умолчанию
		}

		// Создаем уникальный ID для этой операции
		const operationId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Создаем задачу
		taskManager.createTask(operationId);

		// Запускаем фоновую загрузку в отдельном потоке
		setImmediate(() => {
			BackgroundDownloadHandler.startDownload(operationId, limit);
		});

		// Отправляем немедленный ответ с ID операции
		return NextResponse.json({
			message: "Операция загрузки файлов запущена",
			operationId,
			status: "started",
		});
	} catch (error) {
		console.error("Ошибка запуска загрузки файлов:", error);
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
 * GET /api/admin/download-files?operationId=...
 * Получает статус и прогресс операции загрузки файлов
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

		// Если задача не найдена, возвращаем специфичную ошибку
		if (!taskStatus) {
			return NextResponse.json(
				{ error: "Operation not found" },
				{ status: 404 },
			);
		}

		// Если операция завершена, формируем отчет
		if (taskStatus.status === "completed" && taskStatus.result) {
			const result = taskStatus.result;
			const successCount = result.successCount || 0;
			const failedCount = result.failedCount || 0;
			const skippedCount = result.skippedCount || 0;
			const results = result.results || [];

			// Формируем компактный отчет об операции
			let report = `🚀 Результаты загрузки файлов\n`;
			report += `📊 Статистика:\n`;
			report += `  ✅ Успешно: ${successCount}\n`;
			report += `  ❌ Ошибки: ${failedCount}\n`;
			report += `  ⚠️ Пропущено: ${skippedCount}\n`;
			report += `  📚 Всего: ${result.totalFiles || results.length}\n\n`;

			// Добавляем историю обработанных файлов из сообщения
			const messageLines = taskStatus.message
				? taskStatus.message.split("\n")
				: [];
			// Ищем строку с историей файлов (все строки до строки с "🏁 Завершено:")
			const historyLines = [];
			for (const line of messageLines) {
				if (line.startsWith("🏁 Завершено:")) {
					break;
				}
				if (line.includes("✅") || line.includes("❌") || line.includes("⚠️")) {
					historyLines.push(line);
				}
			}

			if (historyLines.length > 0) {
				report += `${historyLines.join("\n")}\n`;
			}

			return NextResponse.json({
				message: "Загрузка файлов завершена",
				operationId,
				status: taskStatus.status,
				progress: taskStatus.progress,
				results: {
					success: successCount,
					failed: failedCount,
					skipped: skippedCount,
					errors: [],
					actions: [
						`Обработано файлов: ${result.totalFiles || results.length}`,
						`Успешно: ${successCount}`,
						`С ошибками: ${failedCount}`,
						`Пропущено: ${skippedCount}`,
						...results.map(
							(
								result: {
									success?: boolean;
									filename?: string;
									skipped?: boolean;
								},
								_index: number,
							) => {
								const status = result.success !== false ? "✅" : "❌";
								const filename = result.filename || "Без имени";
								if (result.skipped) {
									return `⚠️ ${filename} (пропущен)`;
								}
								return `${status} ${filename}`;
							},
						),
					],
				},
				report,
			});
		}

		// Если операция еще не завершена, возвращаем текущий статус
		// Формируем компактный отчет об операции
		let report = `🚀 Результаты загрузки файлов\n\n`;

		// Разбираем сообщение для отображения
		const messageLines = taskStatus.message
			? taskStatus.message.split("\n")
			: [];
		if (messageLines.length > 0) {
			// Первая строка - обработанные файлы
			if (messageLines[0]) {
				report += `Обработанные файлы: ${messageLines[0]}\n`;
			}

			// Остальные строки - текущий статус
			for (let i = 1; i < messageLines.length; i++) {
				if (messageLines[i]) {
					report += `${messageLines[i]}\n`;
				}
			}
		} else {
			report += `${taskStatus.message || ""}\n`;
		}

		report += `\n📊 Статус: ${taskStatus.status}  📈 Прогресс: ${taskStatus.progress}%\n`;

		return NextResponse.json({
			operationId,
			status: taskStatus.status,
			progress: taskStatus.progress,
			message: taskStatus.message,
			result: taskStatus.result,
			createdAt: taskStatus.createdAt,
			updatedAt: taskStatus.updatedAt,
			report,
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
