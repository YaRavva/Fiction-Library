import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

		// Проверяем наличие записей о последней синхронизации в базе данных
		const { data: lastSync, error: syncError } = await supabaseAdmin
			.from("telegram_processed_messages")
			.select("processed_at")
			.order("processed_at", { ascending: false })
			.limit(1)
			.single();

		if (syncError) {
			console.error("Error fetching sync status:", syncError);
			// Не возвращаем ошибку, а вместо этого возвращаем статус по умолчанию
		}

		// Получаем количество обработанных сообщений за последние 24 часа
		const twentyFourHoursAgo = new Date(
			Date.now() - 24 * 60 * 60 * 1000,
		).toISOString();

		const { count: recentCount, error: countError } = await supabaseAdmin
			.from("telegram_processed_messages")
			.select("*", { count: "exact" })
			.gte("processed_at", twentyFourHoursAgo);

		// Здесь будет логика получения статуса выполнения "Книжного Червя"
		// Пока что возвращаем информацию о последней синхронизации
		return NextResponse.json({
			status: lastSync ? "recent" : "idle",
			message: lastSync
				? `Last sync: ${new Date(lastSync.processed_at).toLocaleString("ru-RU")}`
				: "Book Worm has not run yet",
			lastSync: lastSync ? lastSync.processed_at : null,
			recentCount: recentCount || 0,
			progress: lastSync ? 100 : 0,
		});
	} catch (error) {
		console.error("Book Worm Status API error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
