import { type NextRequest, NextResponse } from "next/server";
import { getS3AuthHeaders } from "@/lib/cloud-ru-s3-service";

// Конфигурация Cloud.ru S3
const BUCKET = process.env.S3_BUCKET_NAME || "books";
const REGION = process.env.AWS_REGION || "ru-central-1";

/**
 * GET /api/cloud-ru-download
 * Генерирует signed URL для скачивания файла из Cloud.ru S3
 *
 * Query params:
 * - fileName: имя файла в бакете
 * - expiresIn: время жизни URL в секундах (по умолчанию 3600)
 */
export async function GET(request: NextRequest) {
	try {
		// Получаем параметры запроса
		const { searchParams } = new URL(request.url);
		const fileName = searchParams.get("fileName");
		const expiresInStr = searchParams.get("expiresIn");

		// Проверяем обязательные параметры
		if (!fileName) {
			return NextResponse.json(
				{ error: "Missing required parameter: fileName" },
				{ status: 400 },
			);
		}

		// Проверяем переменные окружения
		const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

		if (!accessKeyId || !secretAccessKey) {
			return NextResponse.json(
				{ error: "Missing Cloud.ru S3 environment variables" },
				{ status: 500 },
			);
		}

		// Разбор ключа доступа для Cloud.ru
		const accessKeyParts = accessKeyId.split(":");
		if (accessKeyParts.length !== 2) {
			return NextResponse.json(
				{
					error: 'Invalid AWS_ACCESS_KEY_ID format. Expected "tenantId:keyId"',
				},
				{ status: 500 },
			);
		}

		const [tenantId, keyId] = accessKeyParts;
		const expiresIn = expiresInStr ? parseInt(expiresInStr, 10) : 3600; // 1 hour default

		// Подготовка параметров для аутентификации GET запроса
		const requestParams = {
			method: "GET",
			pathname: `/${BUCKET}/${fileName}`, // Путь с именем бакета
			query: {},
			headers: {
				host: "s3.cloud.ru",
			},
			payload: "",
			keyId: keyId,
			keySecret: secretAccessKey,
			tenantId: tenantId,
			region: REGION,
			service: "s3",
		};

		// Генерация заголовков аутентификации
		const authHeaders = await getS3AuthHeaders(requestParams);

		// Формируем URL с аутентификационными заголовками
		// В реальной реализации здесь нужно создать проксирующий endpoint
		// который будет добавлять эти заголовки к запросу
		const cloudRuUrl = `https://s3.cloud.ru/${BUCKET}/${fileName}`;

		// Для демонстрации возвращаем URL и заголовки
		// В реальной реализации мы бы создали проксирующий endpoint
		return NextResponse.json({
			url: cloudRuUrl,
			authHeaders: {
				Authorization: authHeaders.Authorization,
				"x-amz-date": authHeaders["x-amz-date"],
				"x-amz-content-sha256": authHeaders["x-amz-content-sha256"],
			},
			expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
			fileName,
			bucket: BUCKET,
		});
	} catch (error) {
		console.error("Error in cloud-ru-download endpoint:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/cloud-ru-download
 * Создает проксирующий endpoint для скачивания файла из Cloud.ru S3
 *
 * Body:
 * {
 *   "fileName": "имя файла в бакете",
 *   "expiresIn": 3600 // опционально, время жизни в секундах
 * }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { fileName, expiresIn: expiresInStr } = body;

		// Проверяем обязательные параметры
		if (!fileName) {
			return NextResponse.json(
				{ error: "Missing required field: fileName" },
				{ status: 400 },
			);
		}

		// Проверяем переменные окружения
		const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

		if (!accessKeyId || !secretAccessKey) {
			return NextResponse.json(
				{ error: "Missing Cloud.ru S3 environment variables" },
				{ status: 500 },
			);
		}

		// Разбор ключа доступа для Cloud.ru
		const accessKeyParts = accessKeyId.split(":");
		if (accessKeyParts.length !== 2) {
			return NextResponse.json(
				{
					error: 'Invalid AWS_ACCESS_KEY_ID format. Expected "tenantId:keyId"',
				},
				{ status: 500 },
			);
		}

		const [tenantId, keyId] = accessKeyParts;
		const expiresIn = expiresInStr ? parseInt(expiresInStr, 10) : 3600; // 1 hour default

		// Подготовка параметров для аутентификации GET запроса
		const requestParams = {
			method: "GET",
			pathname: `/${BUCKET}/${fileName}`, // Путь с именем бакета
			query: {},
			headers: {
				host: "s3.cloud.ru",
			},
			payload: "",
			keyId: keyId,
			keySecret: secretAccessKey,
			tenantId: tenantId,
			region: REGION,
			service: "s3",
		};

		// Генерация заголовков аутентификации
		const authHeaders = await getS3AuthHeaders(requestParams);

		// Формируем URL
		const cloudRuUrl = `https://s3.cloud.ru/${BUCKET}/${fileName}`;

		// Для демонстрации возвращаем URL и заголовки
		return NextResponse.json({
			url: cloudRuUrl,
			authHeaders: {
				Authorization: authHeaders.Authorization,
				"x-amz-date": authHeaders["x-amz-date"],
				"x-amz-content-sha256": authHeaders["x-amz-content-sha256"],
			},
			expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
			fileName,
			bucket: BUCKET,
		});
	} catch (error) {
		console.error("Error in cloud-ru-download endpoint:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
