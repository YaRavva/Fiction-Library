import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";

/**
 * GET /api/admin/timer-settings
 * Получает настройки таймеров для всех процессов
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		// Получаем настройки таймеров для всех процессов
		const { data: timerSettings, error: timerError } = (await (
			auth.admin as any
		)
			.from("timer_settings")
			.select("*")) as {
			data: Array<{
				process_name: string;
				enabled: boolean;
				interval_minutes: number;
				last_run: string | null;
				next_run: string | null;
			}> | null;
			error: any;
		};

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

		timerSettings?.forEach((setting) => {
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
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

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

				const { error: updateError } = await (auth.admin as any)
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
