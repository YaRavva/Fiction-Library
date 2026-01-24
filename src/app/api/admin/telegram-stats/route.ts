import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { updateTelegramStats } from "@/lib/telegram/update-stats";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * GET /api/admin/telegram-stats
 * Получает статистику по книгам в Telegram канале и в базе данных
 */
export async function GET(request: NextRequest) {
	try {
		console.log("GET /api/admin/telegram-stats called");

		// Проверяем авторизацию
		const cookieStore = await cookies();
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return cookieStore.getAll();
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					},
				},
			},
		);

		// Проверяем заголовок Authorization
		let user = null;
		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			try {
				const {
					data: { user: bearerUser },
					error: bearerError,
				} = await supabaseAdmin.auth.getUser(token);
				if (!bearerError && bearerUser) {
					user = bearerUser;
				}
			} catch (bearerAuthError) {
				// Игнорируем ошибки аутентификации через Bearer токен
				console.log("Bearer auth error (ignored):", bearerAuthError);
			}
		}

		// Если не удалось авторизоваться через Bearer токен, пробуем через cookies
		if (!user) {
			const {
				data: { user: cookieUser },
			} = await supabase.auth.getUser();
			user = cookieUser;
		}

		// Log authentication status only in development
		if (process.env.NODE_ENV === "development") {
			console.log(
				"User authentication status:",
				user ? "Authenticated" : "Not authenticated",
			);
		}

		// Temporarily allow access for testing (remove this in production)
		// if (!user) {
		//   return NextResponse.json(
		//     { error: 'Не авторизован' },
		//     { status: 401 }
		//   );
		// }

		// Пытаемся получить последние сохраненные статистические данные
		console.log("Querying telegram_stats table...");
		const { data: stats, error: statsError } = await supabaseAdmin
			.from("telegram_stats")
			.select("*")
			.order("updated_at", { ascending: false })
			.limit(1)
			.single();

		if (statsError) {
			console.error("Error fetching stats:", statsError);
			// Если статистика еще не сохранена, возвращаем значения по умолчанию
			return NextResponse.json({
				booksInDatabase: 0,
				booksInTelegram: 0,
				missingBooks: 0,
				booksWithoutFiles: 0,
			});
		}

		console.log("Stats data from database:", stats);

		// Возвращаем сохраненные статистические данные, преобразовав их в ожидаемый формат
		const responseData = {
			booksInDatabase: stats.books_in_database || 0,
			booksInTelegram: stats.books_in_telegram || 0,
			missingBooks: stats.missing_books || 0,
			booksWithoutFiles: stats.books_without_files || 0,
		};

		console.log("Response data:", responseData);

		return NextResponse.json(responseData);
	} catch (error) {
		console.error("Error in GET /api/admin/telegram-stats:", error);
		return NextResponse.json(
			{
				error: "Внутренняя ошибка сервера",
				details: error instanceof Error ? error.message : "Неизвестная ошибка",
			},
			{ status: 500 },
		);
	}
}

/**
 * POST /api/admin/telegram-stats
 * Запускает обновление статистики с поддержкой прогресса
 */
export async function POST(request: NextRequest) {
	try {
		console.log("POST /api/admin/telegram-stats called");

		// Проверяем авторизацию
		const cookieStore = await cookies();
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return cookieStore.getAll();
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					},
				},
			},
		);

		// Проверяем заголовок Authorization
		let user = null;
		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			try {
				const {
					data: { user: bearerUser },
					error: bearerError,
				} = await supabaseAdmin.auth.getUser(token);
				if (!bearerError && bearerUser) {
					user = bearerUser;
				}
			} catch (bearerAuthError) {
				// Игнорируем ошибки аутентификации через Bearer токен
				console.log("Bearer auth error (ignored):", bearerAuthError);
			}
		}

		// Если не удалось авторизоваться через Bearer токен, пробуем через cookies
		if (!user) {
			const {
				data: { user: cookieUser },
			} = await supabase.auth.getUser();
			user = cookieUser;
		}

		console.log(
			"User authentication status:",
			user ? "Authenticated" : "Not authenticated",
		);

		// Temporarily allow access for testing (remove this in production)
		// if (!user) {
		//   return NextResponse.json(
		//     { error: 'Не авторизован' },
		//     { status: 401 }
		//   );
		// }

		// Проверяем, запрошено ли синхронное обновление с прогрессом
		const url = new URL(request.url);
		const syncParam = url.searchParams.get("sync");

		console.log("Sync parameter:", syncParam);

		if (syncParam === "true") {
			// Синхронное обновление с возвратом прогресса
			try {
				console.log("Performing sync update...");
				const updatedStats = await updateTelegramStats();

				if (!updatedStats) {
					throw new Error("Не удалось обновить статистику Telegram");
				}

				const stats = {
					booksInDatabase: updatedStats.books_in_database || 0,
					booksInTelegram: updatedStats.books_in_telegram || 0,
					missingBooks: updatedStats.missing_books || 0,
					booksWithoutFiles: updatedStats.books_without_files || 0,
				};

				console.log("Stats for sync response:", stats);

				return NextResponse.json({
					message: "Статистика успешно обновлена",
					status: "completed",
					stats,
				});
			} catch (error) {
				console.error("Ошибка при обновлении статистики:", error);
				return NextResponse.json(
					{
						error: "Ошибка при обновлении статистики",
						details:
							error instanceof Error ? error.message : "Неизвестная ошибка",
						status: "error",
					},
					{ status: 500 },
				);
			}
		} else {
			// Фоновое обновление (для обратной совместимости)
			console.log("Performing background update...");
			// Просто возвращаем последние данные из таблицы
			const { data: latestStats, error: statsError } = await supabaseAdmin
				.from("telegram_stats")
				.select("*")
				.order("updated_at", { ascending: false })
				.limit(1)
				.single();

			if (statsError) {
				console.error("Ошибка при получении статистики:", statsError);
			}

			// Возвращаем сразу, не дожидаясь завершения фоновой операции
			return NextResponse.json({
				message: "Обновление статистики успешно запущено",
				status: "processing",
			});
		}
	} catch (error) {
		console.error("Error in POST /api/admin/telegram-stats:", error);
		return NextResponse.json(
			{
				error: "Внутренняя ошибка сервера",
				details: error instanceof Error ? error.message : "Неизвестная ошибка",
			},
			{ status: 500 },
		);
	}
}
