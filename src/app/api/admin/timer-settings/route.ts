import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * GET /api/admin/timer-settings
 * Получает настройки таймеров для всех процессов
 */
export async function GET(request: NextRequest) {
	try {
		// Проверяем авторизацию
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const token = authHeader.replace("Bearer ", "");
		const {
			data: { user },
			error: authError,
		} = await supabaseAdmin.auth.getUser(token);

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Проверяем роль админа
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

		// Получаем настройки таймеров для всех процессов
		const { data: timerSettings, error: timerError } = await supabaseAdmin
			.from("timer_settings")
			.select("*");

		if (timerError) {
			console.error("Error fetching timer settings:", timerError);
			return NextResponse.json(
				{ error: "Failed to fetch timer settings" },
				{ status: 500 },
			);
		}

		// Форматируем данные для фронтенда
		const formattedSettings: { [key: string]: unknown } = {};
		let lastRun: string | null = null;
		let nextRun: string | null = null;

		timerSettings.forEach((setting) => {
			formattedSettings[setting.process_name] = {
				enabled: setting.enabled,
				intervalMinutes: setting.interval_minutes,
			};

			// Используем последние значения для общего статуса
			if (!lastRun || (setting.last_run && setting.last_run > lastRun)) {
				lastRun = setting.last_run;
			}
			if (!nextRun || (setting.next_run && setting.next_run < nextRun)) {
				nextRun = setting.next_run;
			}
		});

		return NextResponse.json({
			...formattedSettings,
			lastRun,
			nextScheduledRun: nextRun,
		});
	} catch (error) {
		console.error("Error getting timer settings:", error);
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
 * PUT /api/admin/timer-settings
 * Обновляет настройки таймеров для всех процессов
 */
export async function PUT(request: NextRequest) {
	try {
		// Проверяем авторизацию
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const token = authHeader.replace("Bearer ", "");
		const {
			data: { user },
			error: authError,
		} = await supabaseAdmin.auth.getUser(token);

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Проверяем роль админа
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

		// Получаем параметры из body
		const body = await request.json();

		// Обновляем настройки для каждого процесса
		const processes = ["deduplication", "channel_sync", "file_download"];

		for (const process of processes) {
			if (body[process]) {
				const { enabled, intervalMinutes } = body[process];

				// Обновляем настройки таймера
				const updateData: { [key: string]: unknown } = {
					updated_at: new Date().toISOString(),
				};

				if (enabled !== undefined) {
					updateData.enabled = enabled;
				}

				if (intervalMinutes !== undefined) {
					updateData.interval_minutes = Math.max(
						1,
						Math.min(1440, intervalMinutes),
					);
				}

				// Если включаем таймер, вычисляем следующее время запуска
				if (enabled === true) {
					const intervalMinutes = (updateData.interval_minutes as number) || 60;
					const nextRun = new Date(
						Date.now() + intervalMinutes * 60 * 1000,
					).toISOString();
					updateData.next_run = nextRun;
				}

				const { error: updateError } = await supabaseAdmin
					.from("timer_settings")
					.update(updateData)
					.eq("process_name", process);

				if (updateError) {
					console.error(
						`Error updating timer settings for ${process}:`,
						updateError,
					);
					return NextResponse.json(
						{ error: `Failed to update timer settings for ${process}` },
						{ status: 500 },
					);
				}
			}
		}

		return NextResponse.json({
			message: "Timer settings updated successfully",
		});
	} catch (error) {
		console.error("Error updating timer settings:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
