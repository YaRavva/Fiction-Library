/**
 * Централизованный S3 клиент для Cloud.ru
 * Использует singleton pattern для переиспользования TCP соединений
 */
import { S3Client } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

/**
 * Получает экземпляр S3 клиента (singleton)
 * @returns Настроенный S3Client для Cloud.ru
 */
export function getS3Client(): S3Client {
	if (!s3Client) {
		const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
		const region = process.env.AWS_REGION || "ru-central-1";

		if (!accessKeyId || !secretAccessKey) {
			throw new Error(
				"Missing S3 credentials: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required",
			);
		}

		s3Client = new S3Client({
			endpoint: "https://s3.cloud.ru",
			region,
			credentials: {
				accessKeyId,
				secretAccessKey,
			},
			forcePathStyle: true, // Важно для S3-совместимых хранилищ
		});
	}
	return s3Client;
}

/**
 * Сбрасывает S3 клиент (для тестирования)
 */
export function resetS3Client(): void {
	if (s3Client) {
		s3Client.destroy();
		s3Client = null;
	}
}

/**
 * Получает имя бакета для файлов книг
 */
export function getBooksBucketName(): string {
	const bucketName = process.env.S3_BUCKET_NAME;
	if (!bucketName) {
		throw new Error("S3_BUCKET_NAME environment variable is not set");
	}
	return bucketName;
}

/**
 * Получает имя бакета для обложек
 */
export function getCoversBucketName(): string {
	const bucketName = process.env.S3_COVERS_BUCKET_NAME;
	if (!bucketName) {
		throw new Error("S3_COVERS_BUCKET_NAME environment variable is not set");
	}
	return bucketName;
}

/**
 * Формирует публичный URL для файла в S3
 */
export function getPublicUrl(bucketName: string, key: string): string {
	return `https://${bucketName}.s3.cloud.ru/${key}`;
}
