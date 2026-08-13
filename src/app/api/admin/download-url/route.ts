import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { getDownloadUrlForReference } from "@/lib/s3";
import { serverSupabase } from "@/lib/serverSupabase";

interface Book {
	id: string;
	file_url: string;
}

interface DownloadTask {
	id: string;
	storage_path: string;
}

const BUCKET = process.env.S3_BUCKET_NAME || "books";
const SIGNED_URL_EXPIRY = 3600;

/**
 * GET /api/admin/download-url
 * Генерирует signed URL для скачивания файла из приватного bucket
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

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
				.select("storage_path")
				.eq("id", taskId)
				.single<DownloadTask>();

			if (taskError || !task) {
				return NextResponse.json({ error: "Task not found" }, { status: 404 });
			}

			storagePath = task.storage_path;
		}

		if (!storagePath) {
			return NextResponse.json(
				{ error: "Файл не найден в хранилище" },
				{ status: 404 },
			);
		}

		let url: string;
		try {
			url = await getDownloadUrlForReference(storagePath, BUCKET, expiresIn);
		} catch (error) {
			console.error("Ошибка создания подписанного URL:", error);
			return NextResponse.json(
				{ error: "Не удалось сгенерировать URL для загрузки" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			url,
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
