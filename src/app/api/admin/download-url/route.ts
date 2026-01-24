import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

// Интерфейсы для типизации данных
interface Book {
	id: string;
	file_url: string;
	// ... другие поля книги
}

interface DownloadTask {
	id: string;
	file_url: string;
	// ... другие поля задачи
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "books";
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

/**
 * GET /api/admin/download-url
 * Генерирует signed URL для скачивания файла из приватного bucket
 *
 * Query params:
 * - bookId: UUID книги
 * - taskId: UUID задачи из download_queue (альтернатива bookId)
 * - expiresIn: время жизни URL в секундах (по умолчанию 3600)
 */
export async function GET(request: NextRequest) {
	try {
		// Проверяем аутентификацию пользователя
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

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Проверяем права администратора
		const { data: profile } = await supabase
			.from("user_profiles")
			.select("role")
			.eq("id", user.id)
			.single();

		if (!profile || profile.role !== "admin") {
			return NextResponse.json(
				{ error: "Forbidden: Admin access required" },
				{ status: 403 },
			);
		}

		// Получаем параметры запроса
		const { searchParams } = new URL(request.url);
		const bookId = searchParams.get("bookId");
		const taskId = searchParams.get("taskId");
		const expiresIn = parseInt(
			searchParams.get("expiresIn") || String(SIGNED_URL_EXPIRY),
			10,
		);

		if (!bookId && !taskId) {
			return NextResponse.json(
				{ error: "Missing required parameter: bookId or taskId" },
				{ status: 400 },
			);
		}

		let storagePath: string | null = null;

		// Получаем file_url из books или download_queue
		if (bookId) {
			const { data: book, error: bookError } = await serverSupabase
				.from("books")
				.select("file_url")
				.eq("id", bookId)
				.single<Book>();

			if (bookError || !book) {
				return NextResponse.json({ error: "Book not found" }, { status: 404 });
			}

			storagePath = book.file_url;
		} else if (taskId) {
			const { data: task, error: taskError } = await serverSupabase
				.from("download_queue")
				.select("file_url")
				.eq("id", taskId)
				.single<DownloadTask>();

			if (taskError || !task) {
				return NextResponse.json({ error: "Task not found" }, { status: 404 });
			}

			storagePath = task.file_url;
		}

		if (!storagePath) {
			return NextResponse.json(
				{ error: "Файл не найден в хранилище" },
				{ status: 404 },
			);
		}

		// Генерируем signed URL с использованием service role client
		const { data: signedUrlData, error: signedUrlError } =
			await serverSupabase.storage
				.from(BUCKET)
				.createSignedUrl(storagePath, expiresIn);

		if (signedUrlError || !signedUrlData) {
			console.error("Ошибка создания подписанного URL:", signedUrlError);
			return NextResponse.json(
				{ error: "Не удалось сгенерировать URL для загрузки" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			url: signedUrlData.signedUrl,
			expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
			storagePath,
		});
	} catch (error) {
		console.error("Ошибка в endpoint download-url:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
