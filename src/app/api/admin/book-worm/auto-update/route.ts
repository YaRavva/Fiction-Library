import { type NextRequest, NextResponse } from "next/server";
import { saveSyncResult, updateSyncResult } from "../../sync-results/route";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BookWormService } from "@/lib/telegram/book-worm-service";

// Интерфейс для хранения настроек автообновления
interface AutoUpdateSettings {
	enabled: boolean;
	interval: number; // в минутах
	lastRun: string | null;
	nextRun: string | null;
}

// Функция для проверки авторизации
async function checkAuthorization(request: NextRequest, supabaseAdmin: any) {
	let userIsAdmin = false;
	const authHeader = request.headers.get("authorization");

	if (authHeader) {
		// Получаем токен из заголовка
		const token = authHeader.replace("Bearer ", "");

		// Проверяем пользователя через Supabase
		try {
			const {
				data: { user },
				error: authError,
			} = await supabaseAdmin.auth.getUser(token);

			if (authError) {
				console.error("Supabase auth error:", authError);
				// Если ошибка авторизации, возвращаем 401
				if (
					authError.message.includes("Invalid JWT") ||
					authError.message.includes("jwt")
				) {
					return {
						authorized: false,
						error: "Unauthorized: Invalid token",
						status: 401,
					};
				}
				// Для других ошибок возвращаем 500
				return {
					authorized: false,
					error: `Authentication service error: ${authError.message}`,
					status: 500,
				};
			}

			if (user) {
				// Проверяем, что пользователь - админ
				const { data: profile, error: profileError } = await supabaseAdmin
					.from("user_profiles")
					.select("role")
					.eq("id", user.id)
					.single();

				if (!profileError && (profile as { role?: string })?.role === "admin") {
					userIsAdmin = true;
				}
			}
		} catch (authException: unknown) {
			console.error("Authentication exception:", authException);
			const errorMessage =
				authException instanceof Error
					? authException.message
					: "Unknown auth error";
			return {
				authorized: false,
				error: `Authentication failed: ${errorMessage}`,
				status: 500,
			};
		}
	}

	// Если пользователь не является администратором, проверяем специальный токен для GitHub Actions
	if (!userIsAdmin) {
		// Проверяем, установлен ли специальный токен для GitHub Actions
		const githubToken = process.env.BOOKWORM_GITHUB_ACTION_TOKEN;
		const requestToken = request.headers.get("X-GitHub-Token");

		if (!githubToken || !requestToken || requestToken !== githubToken) {
			return {
				authorized: false,
				error: "Unauthorized: Invalid GitHub token",
				status: 401,
			};
		}
	}

	// Если мы дошли до этой точки, у пользователя есть доступ
	if (!userIsAdmin && !process.env.BOOKWORM_GITHUB_ACTION_TOKEN) {
		return {
			authorized: false,
			error: "Server configuration error: GitHub token not configured",
			status: 500,
		};
	}

	return { authorized: true, userIsAdmin };
}

export async function GET(request: NextRequest) {
	try {
		// Получаем клиент Supabase с service role key
		const supabaseAdmin = getSupabaseAdmin();

		if (!supabaseAdmin) {
			return NextResponse.json(
				{
					error:
						"Server configuration error: Supabase admin client not available",
				},
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

		// Получаем настройки автообновления из базы данных
		const { data: settings, error: settingsError } = await supabaseAdmin
			.from("auto_update_settings")
			.select("*")
			.single();

		if (settingsError && settingsError.code !== "PGRST116") {
			// PGRST116 означает "Row not found"
			console.error("Error fetching auto update settings:", settingsError);
			return NextResponse.json(
				{
					error: `Error fetching auto update settings: ${settingsError.message}`,
				},
				{ status: 500 },
			);
		}

		const autoUpdateSettings: AutoUpdateSettings = settings || {
			enabled: false,
			interval: 30,
			lastRun: null,
			nextRun: null,
		};

		return NextResponse.json({
			success: true,
			settings: autoUpdateSettings,
		});
	} catch (error: unknown) {
		console.error("Auto Update Settings API error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		return NextResponse.json(
			{ error: `Internal server error: ${errorMessage}` },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		// Получаем клиент Supabase с service role key
		const supabaseAdmin = getSupabaseAdmin();

		if (!supabaseAdmin) {
			return NextResponse.json(
				{
					error:
						"Server configuration error: Supabase admin client not available",
				},
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

		// Получаем настройки автообновления из базы данных
		const { data: settings, error: settingsError } = await supabaseAdmin
			.from("auto_update_settings")
			.select("*")
			.single();

		if (settingsError && settingsError.code !== "PGRST116") {
			// PGRST116 означает "Row not found"
			console.error("Error fetching auto update settings:", settingsError);
			return NextResponse.json(
				{
					error: `Error fetching auto update settings: ${settingsError.message}`,
				},
				{ status: 500 },
			);
		}

		const autoUpdateSettings: AutoUpdateSettings = settings || {
			enabled: false,
			interval: 30,
			lastRun: null,
			nextRun: null,
		};

		// Проверяем, включено ли автообновление
		if (!autoUpdateSettings.enabled) {
			console.log("Auto update is disabled");
			return NextResponse.json({
				success: true,
				message: "Auto update is disabled",
				settings: autoUpdateSettings,
			});
		}

		// Проверяем, пришло ли время для выполнения обновления
		const now = new Date();
		const nextRunTime = autoUpdateSettings.nextRun
			? new Date(autoUpdateSettings.nextRun)
			: null;

		// Если nextRun не установлено, устанавливаем его и пропускаем текущий запуск
		if (!nextRunTime) {
			const updatedNextRun = new Date(
				now.getTime() + autoUpdateSettings.interval * 60000,
			); // interval в минутах

			// Преобразуем camelCase поля в snake_case для соответствия схеме PostgreSQL
			const settingsForDb = {
				enabled: autoUpdateSettings.enabled,
				interval: autoUpdateSettings.interval,
				last_run: autoUpdateSettings.lastRun,
				next_run: updatedNextRun.toISOString(),
			};

			// Обновляем настройки в базе данных
			console.log(
				"Attempting to update auto update settings after first check:",
				settingsForDb,
			); // Отладочный лог

			const { data, error: updateError } = await supabaseAdmin
				.from("auto_update_settings")
				.upsert(settingsForDb, { onConflict: "id" });

			if (updateError) {
				console.error("Error updating auto update settings:", updateError);
				return NextResponse.json(
					{
						error: `Error updating auto update settings: ${updateError.message}`,
					},
					{ status: 500 },
				);
			}

			console.log(
				"Auto update settings updated successfully after first check:",
				data,
			); // Отладочный лог

			console.log("Next run scheduled for:", updatedNextRun.toISOString());
			return NextResponse.json({
				success: true,
				message: "Auto update scheduled for next run",
				nextRun: updatedNextRun.toISOString(),
			});
		}

		// Если время следующего запуска еще не наступило
		if (nextRunTime > now) {
			console.log("Next auto update scheduled for:", nextRunTime.toISOString());
			return NextResponse.json({
				success: true,
				message: "Auto update not due yet",
				nextRun: nextRunTime.toISOString(),
			});
		}

		// Создаем запись о начале автосинхронизации
		const syncRecord = await saveSyncResult(supabaseAdmin, {
			job_type: "auto",
			status: "running",
			started_at: new Date().toISOString(),
		});

		// Получаем экземпляр сервиса
		const bookWorm = await BookWormService.getInstance();

		// Выполняем обновление асинхронно
		bookWorm
			.runUpdateSync()
			.then(async (result) => {
				console.log("Auto update completed successfully:", result);

				// Обновляем настройки - фиксируем время последнего запуска и планируем следующий
				const now = new Date();
				const nextRun = new Date(
					now.getTime() + autoUpdateSettings.interval * 60000,
				); // interval в минутах

				// Преобразуем camelCase поля в snake_case для соответствия схеме PostgreSQL
				const settingsForDb = {
					enabled: true,
					interval: autoUpdateSettings.interval,
					last_run: now.toISOString(),
					next_run: nextRun.toISOString(),
				};

				console.log(
					"Attempting to update auto update settings after sync:",
					settingsForDb,
				); // Отладочный лог

				const { data, error: updateError } = await supabaseAdmin
					.from("auto_update_settings")
					.upsert(settingsForDb, { onConflict: "id" });

				if (updateError) {
					console.error(
						"Error updating auto update settings after sync:",
						updateError,
					);
				} else {
					console.log(
						"Auto update settings updated after sync:",
						data,
						". Next run:",
						nextRun.toISOString(),
					);
				}

				// Сохраняем результат в БД
				if (syncRecord?.id) {
					const formattedMessage = `🔄 Автосинхронизация завершена:
📊 Обработано: ${result.processed}
➕ Добавлено: ${result.added}
🔄 Обновлено: ${result.updated}
🔗 Привязано: ${result.matched}`;

					await updateSyncResult(supabaseAdmin, syncRecord.id, {
						status: "completed",
						completed_at: now.toISOString(),
						metadata_processed: result.processed || 0,
						metadata_added: result.added || 0,
						metadata_updated: result.updated || 0,
						files_linked: result.matched || 0,
						log_output: formattedMessage,
					});
				}
			})
			.catch(async (error) => {
				console.error("Auto update failed:", error);

				// Сохраняем ошибку в БД
				if (syncRecord?.id) {
					await updateSyncResult(supabaseAdmin, syncRecord.id, {
						status: "failed",
						completed_at: new Date().toISOString(),
						error_message: error instanceof Error ? error.message : "Неизвестная ошибка",
					});
				}
			});

		// Возвращаем ответ сразу, не ожидая завершения операции
		return NextResponse.json({
			success: true,
			message: "Auto update started",
			mode: "update",
			status: "processing",
		});
	} catch (error: unknown) {
		console.error("Auto Update API error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		return NextResponse.json(
			{ error: `Internal server error: ${errorMessage}` },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		// Получаем клиент Supabase с service role key
		const supabaseAdmin = getSupabaseAdmin();

		if (!supabaseAdmin) {
			return NextResponse.json(
				{
					error:
						"Server configuration error: Supabase admin client not available",
				},
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

		// Получаем данные из тела запроса
		const body = await request.json();
		const { enabled, interval } = body;

		// Валидируем параметры
		if (enabled !== undefined && typeof enabled !== "boolean") {
			return NextResponse.json(
				{ error: "Invalid enabled value. Must be boolean." },
				{ status: 400 },
			);
		}

		if (interval !== undefined) {
			const intervalNum = Number(interval);
			if (Number.isNaN(intervalNum) || intervalNum < 5 || intervalNum > 1440) {
				return NextResponse.json(
					{
						error:
							"Invalid interval. Must be a number between 5 and 1440 minutes.",
					},
					{ status: 400 },
				);
			}
		}

		// Получаем текущие настройки
		const { data: currentSettings, error: settingsError } = await supabaseAdmin
			.from("auto_update_settings")
			.select("*")
			.single();

		// Формируем новые настройки
		const newSettings = {
			id: 1, // Используем один общий ID для настроек
			enabled:
				enabled !== undefined ? enabled : (currentSettings?.enabled ?? false),
			interval:
				interval !== undefined
					? Number(interval)
					: (currentSettings?.interval ?? 30),
			lastRun: currentSettings?.lastRun || null,
			nextRun: currentSettings?.nextRun || null,
		};

		// Если включаем автообновление и оно было отключено, устанавливаем следующий запуск
		if (enabled && !currentSettings?.enabled) {
			const now = new Date();
			newSettings.nextRun = new Date(
				now.getTime() + newSettings.interval * 60000,
			).toISOString();
		}
		// Если выключаем автообновление, обнуляем nextRun
		else if (enabled === false) {
			newSettings.nextRun = null;
		}

		// Преобразуем camelCase поля в snake_case для соответствия схеме PostgreSQL
		const settingsForDb = {
			id: newSettings.id,
			enabled: newSettings.enabled,
			interval: newSettings.interval,
			last_run: newSettings.lastRun,
			next_run: newSettings.nextRun,
		};

		console.log("Attempting to save auto update settings:", settingsForDb); // Отладочный лог

		// Сохраняем настройки в базе данных
		const { data, error: updateError } = await supabaseAdmin
			.from("auto_update_settings")
			.upsert(settingsForDb, { onConflict: "id" });

		if (updateError) {
			console.error("Error saving auto update settings:", updateError);
			return NextResponse.json(
				{ error: `Error saving auto update settings: ${updateError.message}` },
				{ status: 500 },
			);
		}

		console.log("Auto update settings saved successfully:", data); // Отладочный лог

		console.log("Auto update settings updated:", newSettings);

		return NextResponse.json({
			success: true,
			message: "Auto update settings updated",
			settings: newSettings,
		});
	} catch (error: unknown) {
		console.error("Auto Update Settings PUT API error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		return NextResponse.json(
			{ error: `Internal server error: ${errorMessage}` },
			{ status: 500 },
		);
	}
}
