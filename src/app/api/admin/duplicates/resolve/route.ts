import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/duplicates/resolve
 * Удаляет выбранные дубликаты книг
 * Body: { idsToDelete: string[] }
 */
export async function POST(request: NextRequest) {
	try {
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

		// Проверяем пользователя (аналогично другим admin роутам)
		let user = null;
		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			const {
				data: { user: bearerUser },
			} = await supabaseAdmin.auth.getUser(token);
			user = bearerUser;
		}
		if (!user) {
			const {
				data: { user: cookieUser },
			} = await supabase.auth.getUser();
			user = cookieUser;
		}

		if (!user) {
			return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
		}

		// Проверяем роль
		const { data: profile } = await supabaseAdmin
			.from("user_profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (!profile || profile.role !== "admin") {
			return NextResponse.json({ error: "Нет прав admin" }, { status: 403 });
		}

		// Получаем данные
		const body = await request.json();
		const { idsToDelete } = body;

		if (!Array.isArray(idsToDelete) || idsToDelete.length === 0) {
			return NextResponse.json(
				{ message: "Нет ID для удаления" },
				{ status: 400 },
			);
		}

		console.log(`🗑️ Удаление ${idsToDelete.length} дубликатов...`);

		// Удаляем книги
		const { error } = await supabaseAdmin
			.from("books")
			.delete()
			.in("id", idsToDelete);

		if (error) {
			console.error("Error deleting duplicates:", error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			deletedCount: idsToDelete.length,
			message: `Успешно удалено ${idsToDelete.length} книг`,
		});
	} catch (error) {
		console.error("Resolve API error:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
