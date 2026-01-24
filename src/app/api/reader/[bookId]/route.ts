import JSZip from "jszip";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ bookId: string }> },
) {
	const { bookId } = await params;
	const supabase = serverSupabase;

	try {
		interface BookData {
			file_url: string;
			file_format: string;
		}

		const { data: bookData, error: bookError } = await supabase
			.from("books")
			.select("file_url,file_format")
			.eq("id", bookId)
			.single<BookData>();

		// Mock content if file not found (for testing)
		if (bookError || !bookData || !bookData.file_url) {
			console.warn("File not found via DB, serving mock content for testing.");
			const mockContent = `
                <h1>Тестовая книга</h1>
                <p>Это автоматическая заглушка, так как реальный файл книги не был найден в базе данных.</p>
                <p>Здесь должен быть текст книги с ID: ${bookId}</p>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            `;
			return new NextResponse(mockContent, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		}

		const response = await fetch(bookData.file_url);

		if (!response.ok) {
			return new NextResponse("Failed to fetch file", {
				status: response.status,
			});
		}

		// Get content type from upstream or fallback to DB format
		const contentType =
			response.headers.get("content-type") ||
			(bookData.file_format === "zip"
				? "application/zip"
				: bookData.file_format === "fb2"
					? "text/xml; charset=utf-8"
					: "text/plain; charset=utf-8");

		// Proxy the file content directly as ArrayBuffer
		const arrayBuffer = await response.arrayBuffer();

		return new NextResponse(arrayBuffer, {
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": `attachment; filename="book.${bookData.file_format}"`,
			},
		});
	} catch (error) {
		console.error("Error fetching book content:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
