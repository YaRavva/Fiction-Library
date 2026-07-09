import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import {
	type BookWithoutFile,
	FileSearchService,
	type TelegramFile,
} from "@/lib/file-search-service";

export async function POST(request: NextRequest) {
	try {
		console.log("POST /api/admin/file-search called");

		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const { book, telegramFiles } = await request.json();

		if (!book || !telegramFiles) {
			return NextResponse.json(
				{ error: "Отсутствуют необходимые параметры: book или telegramFiles" },
				{ status: 400 },
			);
		}

		const fileSearchService = new FileSearchService();
		const result = fileSearchService.searchFilesForBook(
			book as BookWithoutFile,
			telegramFiles as TelegramFile[],
		);

		return NextResponse.json(result);
	} catch (error) {
		console.error("Error in /api/admin/file-search:", error);
		return NextResponse.json(
			{
				error: "Внутренняя ошибка сервера",
				details: error instanceof Error ? error.message : "Неизвестная ошибка",
			},
			{ status: 500 },
		);
	}
}
