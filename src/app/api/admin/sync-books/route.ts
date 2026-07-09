import { NextResponse } from "next/server";
import { TelegramMetadataService } from "@/lib/telegram/metadata-service";

export const dynamic = "force-dynamic";

// Храним состояние синхронизации в памяти (в реальном приложении лучше использовать БД или Redis)
const syncStatus = {
	isRunning: false,
	startTime: null as number | null,
	progress: 0,
	message: "Готов к синхронизации",
	lastResult: null as any,
};

export async function POST(request: Request) {
	try {
		console.log("📥 Получен запрос на синхронизацию книг");

		// Проверяем, не запущена ли уже синхронизация
		if (syncStatus.isRunning) {
			return NextResponse.json(
				{
					success: false,
					message: "Синхронизация уже запущена",
					status: "already_running",
				},
				{ status: 409 },
			);
		}

		// Получаем параметры из тела запроса
		const { limit = 10 } = await request.json();

		console.log(`🚀 Запуск синхронизации книг (лимит: ${limit})`);

		// Обновляем статус
		syncStatus.isRunning = true;
		syncStatus.startTime = Date.now();
		syncStatus.progress = 0;
		syncStatus.message = `Запущена синхронизация ${limit} книг`;

		// Запускаем синхронизацию и ждем результата
		try {
			// Получаем экземпляр сервиса синхронизации метаданных
			const metadataService = await TelegramMetadataService.getInstance();

			// Выполняем синхронизацию
			const result = await metadataService.syncBooks(limit);

			syncStatus.lastResult = result;

			// Обновляем статус по завершении
			syncStatus.isRunning = false;
			syncStatus.message = `Синхронизация завершена: ${result.processed} обработано, ${result.added} добавлено`;
			syncStatus.progress = 100;
			console.log("✅ Синхронизация книг завершена:", result);

			// Формируем отчет
			const actions = [
				`Обработано сообщений: ${result.processed}`,
				`Добавлено книг: ${result.added}`,
				`Обновлено книг: ${result.updated}`,
				`Пропущено сообщений: ${result.skipped}`,
				`Ошибок: ${result.errors}`,
			];

			// Возвращаем результат
			return NextResponse.json({
				success: true,
				message: "Синхронизация завершена",
				status: "completed",
				results: result,
				actions,
				limit,
			});
		} catch (error) {
			// Обновляем статус при ошибке
			syncStatus.isRunning = false;
			syncStatus.message = `Ошибка синхронизации: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`;
			console.error("❌ Ошибка синхронизации книг:", error);

			return NextResponse.json(
				{
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Неизвестная ошибка синхронизации",
				},
				{ status: 500 },
			);
		}
	} catch (error) {
		syncStatus.isRunning = false;
		console.error("❌ Ошибка запуска синхронизации книг:", error);
		return NextResponse.json(
			{
				success: false,
				message:
					error instanceof Error
						? error.message
						: "Неизвестная ошибка синхронизации",
			},
			{ status: 500 },
		);
	}
}

export async function GET() {
	try {
		console.log("📥 Получен GET запрос статуса синхронизации книг");

		// Возвращаем текущий статус синхронизации
		return NextResponse.json({
			success: true,
			status: syncStatus,
		});
	} catch (error) {
		console.error("❌ Ошибка получения статуса синхронизации книг:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Неизвестная ошибка",
			},
			{ status: 500 },
		);
	}
}
