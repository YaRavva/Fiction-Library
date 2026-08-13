import { NextResponse } from "next/server";
import { getDownloadUrlForReference } from "@/lib/s3";
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

		if (bookError || !bookData) {
			return NextResponse.json({ error: "Book not found" }, { status: 404 });
		}

		if (!bookData.file_url) {
			return NextResponse.json({ error: "File not found" }, { status: 404 });
		}

		const sourceUrl = bookData.file_url.includes("s3.cloud.ru")
			? await getDownloadUrlForReference(
					bookData.file_url,
					process.env.S3_BUCKET_NAME || "books",
				)
			: bookData.file_url;
		const response = await fetch(sourceUrl);

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
			},
		});
	} catch (error) {
		console.error("Error fetching book content:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
