import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BookWormService } from "@/lib/telegram/book-worm-service";

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
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

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
					return NextResponse.json(
						{ error: "Unauthorized: Invalid token" },
						{ status: 401 },
					);
				}
				// Для других ошибок возвращаем 500
				return NextResponse.json(
					{ error: `Authentication service error: ${authError.message}` },
					{ status: 500 },
				);
			}

			if (!user) {
				return NextResponse.json(
					{ error: "Unauthorized: User not found" },
					{ status: 401 },
				);
			}

			// Проверяем, что пользователь - админ
			const { data: profile, error: profileError } = await supabaseAdmin
				.from("user_profiles")
				.select("role")
				.eq("id", user.id)
				.single();

			if (profileError || (profile as { role?: string })?.role !== "admin") {
				return NextResponse.json(
					{ error: "Forbidden: Admin access required" },
					{ status: 403 },
				);
			}
		} catch (authException: unknown) {
			console.error("Authentication exception:", authException);
			const errorMessage =
				authException instanceof Error
					? authException.message
					: "Unknown auth error";
			return NextResponse.json(
				{ error: `Authentication failed: ${errorMessage}` },
				{ status: 500 },
			);
		}

		// Для режима \"full\" выполняем полную синхронизацию непосредственно в этом запросе
		try {
			// Создаем экземпляр сервиса
			const bookWorm = await BookWormService.getInstance();

			// Выполняем полную синхронизацию асинхронно без ожидания
			bookWorm
				.runFullSync()
				.then((result) => {
					console.log("Book Worm full sync completed successfully:", result);
				})
				.catch((error) => {
					console.error("Book Worm full sync failed:", error);
				});

			// Возвращаем ответ сразу, не ожидая завершения операции
			return NextResponse.json({
				success: true,
				message: "Book Worm full sync started",
				mode: "full",
				status: "processing",
			});
		} catch (syncError: unknown) {
			console.error("Book Worm full sync error:", syncError);
			const errorMessage =
				syncError instanceof Error
					? syncError.message
					: "Unknown sync error occurred";
			return NextResponse.json(
				{ error: `Sync error: ${errorMessage}` },
				{ status: 500 },
			);
		}
	} catch (error: unknown) {
		console.error("Book Worm Full Sync API error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		return NextResponse.json(
			{ error: `Internal server error: ${errorMessage}` },
			{ status: 500 },
		);
	}
}
