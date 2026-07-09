import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BookWormService } from "@/lib/telegram/book-worm-service";
import { saveSyncResult, updateSyncResult } from "../sync-results/route";

/**
 * Verify admin authorization. Returns null if OK, or NextResponse with error.
 */
async function requireAdmin(request: NextRequest) {
	const supabaseAdmin = getSupabaseAdmin();
	if (!supabaseAdmin) {
		return {
			error: NextResponse.json(
				{ error: "Supabase not available" },
				{ status: 500 },
			),
		};
	}

	const authHeader = request.headers.get("authorization");
	if (!authHeader) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}

	const token = authHeader.replace("Bearer ", "");
	const {
		data: { user },
		error: authError,
	} = await supabaseAdmin.auth.getUser(token);

	if (authError || !user) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}

	const { data: profile } = await supabaseAdmin
		.from("user_profiles")
		.select("role")
		.eq("id", user.id)
		.single();

	if (!profile || (profile as { role?: string }).role !== "admin") {
		return {
			error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}

	return { supabaseAdmin };
}

/**
 * GET /api/admin/book-worm — last sync status + recent history
 */
export async function GET(request: NextRequest) {
	const auth = await requireAdmin(request);
	if ("error" in auth) return auth.error;

	const { data: lastSync } = await auth.supabaseAdmin
		.from("sync_job_results")
		.select(
			"id, job_type, status, started_at, completed_at, error_message, log_output",
		)
		.order("started_at", { ascending: false })
		.limit(1)
		.single();

	const { data: recentMessages } = await auth.supabaseAdmin
		.from("telegram_processed_messages")
		.select("id", { count: "exact", head: true });

	return NextResponse.json({
		lastSync: lastSync || null,
		totalProcessedMessages: recentMessages || 0,
	});
}

/**
 * POST /api/admin/book-worm — run sync
 * Body: { mode: "update" | "full" }
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdmin(request);
		if ("error" in auth) return auth.error;
		const { supabaseAdmin } = auth;

		const body = await request.json();
		const mode = body.mode;

		if (!mode || !["full", "update"].includes(mode)) {
			return NextResponse.json(
				{ error: 'Invalid mode. Use "full" or "update"' },
				{ status: 400 },
			);
		}

		const bookWorm = await BookWormService.getInstance();
		const syncRecord = await saveSyncResult(supabaseAdmin, {
			job_type: mode,
			status: "running",
			started_at: new Date().toISOString(),
		});

		// Таймаут: если sync не завершится за 60 минут, помечаем как failed
		const SYNC_TIMEOUT_MS = 60 * 60 * 1000;
		let timeoutCleared = false;
		const timeoutId = setTimeout(async () => {
			if (timeoutCleared) return;
			console.error(`[book-worm] Sync timed out after 60 minutes (${mode})`);
			if (syncRecord?.id) {
				await updateSyncResult(supabaseAdmin, syncRecord.id, {
					status: "failed",
					completed_at: new Date().toISOString(),
					error_message: "Timeout: sync exceeded 60 minutes",
				});
			}
		}, SYNC_TIMEOUT_MS);

		try {
			const result =
				mode === "full"
					? await bookWorm.runFullSync()
					: await bookWorm.runUpdateSync();

			let formattedMessage = `🔄 Синхронизация завершена (${mode}):

📊 Обработано: ${result.processed}
➕ Добавлено: ${result.added}
🔄 Обновлено: ${result.updated}
🔗 Привязано: ${result.matched}
📸 Обложки: ${result.coversDownloaded || 0}

💬 ${result.message}`;

			if (result.detailedLogs?.length > 0) {
				formattedMessage += `\n\n📜 Детальный лог:\n${result.detailedLogs.join("\n")}`;
			}

			if (syncRecord?.id) {
				await updateSyncResult(supabaseAdmin, syncRecord.id, {
					status: "completed",
					completed_at: new Date().toISOString(),
					metadata_processed: result.processed || 0,
					metadata_added: result.added || 0,
					metadata_updated: result.updated || 0,
					files_linked: result.matched || 0,
					covers_downloaded: result.coversDownloaded || 0,
					log_output: formattedMessage,
				});
			}

			clearTimeout(timeoutId);
			timeoutCleared = true;

			return NextResponse.json({
				success: true,
				mode,
				status: "completed",
				result,
				formattedMessage,
			});
		} catch (syncError: unknown) {
			clearTimeout(timeoutId);
			timeoutCleared = true;
			const errorMessage =
				syncError instanceof Error ? syncError.message : "Unknown error";

			if (syncRecord?.id) {
				await updateSyncResult(supabaseAdmin, syncRecord.id, {
					status: "failed",
					completed_at: new Date().toISOString(),
					error_message: errorMessage,
				});
			}

			return NextResponse.json({ error: errorMessage }, { status: 500 });
		}
	} catch (error: unknown) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
