import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { TelegramSyncService } from "@/lib/telegram/sync";

/**
 * POST /api/admin/process-file
 * Обрабатывает один файл по ID сообщения
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		// Получаем ID сообщения из тела запроса
		let messageId: number | string | undefined;
		try {
			const body = await request.json();
			messageId = body.messageId;
		} catch (_e) {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		if (!messageId) {
			return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
		}

		// Получаем экземпляр сервиса синхронизации
		const syncService = await TelegramSyncService.getInstance();

		// Обрабатываем файл
		const result = await syncService.processSingleFileById(Number(messageId));

		const success = result.success !== false;

		// Формируем отчет об операции
		let report = `📚 Результаты обработки файла\n\n`;
		report += `Статус: ${success ? "Успешно" : "Ошибка"}\n`;
		report += `Файл: ${result.filename || "Без имени"} (ID: ${result.messageId})\n\n`;

		if (!success && result.error) {
			report += `❌ Ошибка: ${result.error}\n`;
		}

		if (result.bookTitle && result.bookAuthor) {
			report += `📘 Книга: ${result.bookAuthor} - ${result.bookTitle}\n`;
		}

		if (result.fileSize) {
			report += `📏 Размер файла: ${result.fileSize} байт\n`;
		}

		if (result.fileUrl) {
			report += `🔗 URL файла: ${result.fileUrl}\n`;
		}

		return NextResponse.json({
			message: success ? "Файл успешно обработан" : "Ошибка обработки файла",
			result,
			report,
		});
	} catch (error) {
		console.error("Ошибка обработки файла:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
