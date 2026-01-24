import { NextResponse } from "next/server";
import { getDownloadUrl } from "@/lib/cloud-ru-s3-service";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ bookId: string }> },
) {
	let bookId: string;
	try {
		const resolvedParams = await params;
		bookId = resolvedParams?.bookId;
		if (!bookId) {
			console.error(
				`[Download API] bookId is missing in params:`,
				resolvedParams,
			);
			return NextResponse.json(
				{ error: "Book ID is required" },
				{ status: 400 },
			);
		}
	} catch (paramsError) {
		console.error(`[Download API] Error accessing params:`, paramsError);
		return NextResponse.json(
			{ error: "Invalid request parameters" },
			{ status: 400 },
		);
	}

	const supabase = serverSupabase;

	try {
		console.log(`[Download API] Request for book ID: ${bookId}`);
		// Получаем информацию о книге
		interface BookInfo {
			title: string;
			author: string;
			file_url: string;
			file_format: string;
		}

		console.log(`[Download API] Fetching book data for ID: ${bookId}`);
		const { data: bookData, error: bookError } = await supabase
			.from("books")
			.select("title, author, file_url, file_format")
			.eq("id", bookId)
			.single<BookInfo>();

		// Проверка на существование bookData
		if (bookError) {
			console.error(
				`[Download API] Ошибка при получении данных книги ${bookId}:`,
				bookError,
			);
			return NextResponse.json(
				{ error: "Книга не найдена", details: bookError.message },
				{ status: 404 },
			);
		}

		if (!bookData) {
			console.error(
				`[Download API] Книга с ID ${bookId} не найдена в базе данных`,
			);
			return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
		}

		console.log(`[Download API] Book data retrieved:`, {
			title: bookData.title,
			author: bookData.author,
			file_format: bookData.file_format,
			has_file_url: !!bookData.file_url,
		});

		if (!bookData.file_url) {
			console.error(`[Download API] File URL is missing for book ${bookId}`);
			return NextResponse.json(
				{ error: "File not found", bookId },
				{ status: 404 },
			);
		}

		// Попытка получить presigned URL или загрузить файл напрямую
		let finalFileContent: ArrayBuffer;
		let contentType = "application/octet-stream";

		try {
			// Если URL ведет на cloud.ru S3, пытаемся получить presigned URL для обхода проблем с fetch на сервере
			if (bookData.file_url.includes("s3.cloud.ru")) {
				console.log(
					`[Download API] URL is Cloud.ru S3, generating presigned URL...`,
				);
				const urlParts = new URL(bookData.file_url);
				const bucketName = process.env.S3_BUCKET_NAME || "books";
				// Извлекаем ключ из пути (удаляем ведущий слэш и имя бакета если оно в пути)
				let key = urlParts.pathname.startsWith("/")
					? urlParts.pathname.substring(1)
					: urlParts.pathname;
				if (key.startsWith(`${bucketName}/`)) {
					key = key.substring(bucketName.length + 1);
				}

				const presignedUrl = await getDownloadUrl(bucketName, key);
				console.log(`[Download API] Presigned URL generated, fetching...`);
				const response = await fetch(presignedUrl);
				if (!response.ok)
					throw new Error(`Fetch failed with status ${response.status}`);

				contentType =
					response.headers.get("content-type") || "application/octet-stream";
				finalFileContent = await response.arrayBuffer();
			} else {
				// Прямая загрузка для остальных URL
				console.log(
					`[Download API] Fetching file directly from: ${bookData.file_url}`,
				);
				const response = await fetch(bookData.file_url);
				if (!response.ok)
					throw new Error(`Fetch failed with status ${response.status}`);

				contentType =
					response.headers.get("content-type") || "application/octet-stream";
				finalFileContent = await response.arrayBuffer();
			}
		} catch (fetchError) {
			console.error(`[Download API] Fetch failed:`, fetchError);
			return NextResponse.json(
				{
					error: "Failed to download file from storage",
					details: String(fetchError),
				},
				{ status: 502 },
			);
		}

		console.log(
			`[Download API] File fetched successfully, size: ${finalFileContent.byteLength} bytes`,
		);

		// Формируем имя файла
		const rawTitle =
			bookData.title && bookData.title.trim() !== ""
				? bookData.title.trim()
				: "Без названия";
		const rawAuthor =
			bookData.author && bookData.author.trim() !== ""
				? bookData.author.trim()
				: "Неизвестный автор";
		const fileExtension =
			bookData.file_format && bookData.file_format !== ""
				? bookData.file_format
				: "zip";

		// Очищаем только запрещенные в именах файлов символы
		const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "");
		const cleanAuthor = rawAuthor.replace(/[\\/:*?"<>|]/g, "");

		const filename = `${cleanAuthor} - ${cleanTitle}.${fileExtension}`;

		console.log(`[Download API] Generated filename: "${filename}"`);

		// Обновляем счетчик скачиваний
		try {
			await supabase.rpc("increment_downloads", { book_id: bookId } as any);
		} catch (error) {
			console.error("Error incrementing download count:", error);
		}

		// Формируем Content-Disposition строго по RFC 6266
		// Экранируем кавычки для filename
		const safeFilename = filename.replace(/"/g, '\\"');
		// Кодируем для filename* (UTF-8)
		const encodedFilename = encodeURIComponent(filename).replace(
			/['()!*]/g,
			(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
		);

		// Собираем заголовки. ВНИМАНИЕ: filename в кавычках может содержать только ASCII!
		// Для кириллицы ОБЯЗАТЕЛЬНО использование filename*
		const contentDisposition = `attachment; filename="file.${fileExtension}"; filename*=UTF-8''${encodedFilename}`;

		const responseHeaders = new Headers();

		// Очищаем Content-Type от не-ASCII на всякий случай
		const cleanContentType = (
			contentType === "application/octet-stream"
				? "application/force-download"
				: contentType
		).replace(/[^\x00-\x7F]/g, "");

		responseHeaders.set("Content-Type", cleanContentType);
		responseHeaders.set("Content-Disposition", contentDisposition);
		responseHeaders.set(
			"Content-Length",
			finalFileContent.byteLength.toString(),
		);
		responseHeaders.set("Cache-Control", "no-cache");

		console.log(`[Download API] Sending response with headers:`, {
			"Content-Type": cleanContentType,
			"Content-Disposition": contentDisposition,
		});

		return new NextResponse(finalFileContent, {
			headers: responseHeaders,
		});
	} catch (error) {
		console.error(`[Download API] Critical Error:`, error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: String(error), bookId },
			{ status: 500 },
		);
	}
}
