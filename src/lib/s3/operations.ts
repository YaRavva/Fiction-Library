/**
 * S3 операции для Cloud.ru
 * Использует централизованный клиент
 */
import { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListBucketsCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./client";

/**
 * Загружает объект в S3 бакет
 */
export async function putObject(
	key: string,
	body: Buffer,
	bucketName: string,
	contentType?: string,
) {
	const client = getS3Client();
	const command = new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		Body: body,
		ContentType: contentType,
	});
	return client.send(command);
}

/**
 * Получает объект из S3 бакета
 */
export async function getObject(key: string, bucketName: string) {
	const client = getS3Client();
	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: key,
	});
	return client.send(command);
}

/**
 * Получает объект из S3 бакета как Buffer
 */
export async function getObjectAsBuffer(
	key: string,
	bucketName: string,
): Promise<Buffer> {
	const response = await getObject(key, bucketName);
	const body = response.Body;

	if (body instanceof Readable) {
		return new Promise((resolve, reject) => {
			const chunks: Uint8Array[] = [];
			body.on("data", (chunk: Uint8Array) => chunks.push(chunk));
			body.on("error", reject);
			body.on("end", () => resolve(Buffer.concat(chunks)));
		});
	} else if (body instanceof Uint8Array) {
		return Buffer.from(body);
	} else {
		throw new Error("Unexpected response body type");
	}
}

/**
 * Проверяет существование объекта и получает метаданные
 */
export async function headObject(key: string, bucketName: string) {
	const client = getS3Client();
	const command = new HeadObjectCommand({
		Bucket: bucketName,
		Key: key,
	});
	return client.send(command);
}

/**
 * Проверяет существование файла в S3
 * @returns Объект с информацией о файле или null если не найден
 */
export async function checkFileExists(
	key: string,
	bucketName: string,
): Promise<{ size: number; contentType: string | undefined } | null> {
	try {
		const response = await headObject(key, bucketName);
		return {
			size: response.ContentLength || 0,
			contentType: response.ContentType,
		};
	} catch (error) {
		// Файл не найден или ошибка доступа
		return null;
	}
}

/**
 * Удаляет объект из S3 бакета
 */
export async function deleteObject(key: string, bucketName: string) {
	const client = getS3Client();
	const command = new DeleteObjectCommand({
		Bucket: bucketName,
		Key: key,
	});
	return client.send(command);
}

/**
 * Получает список всех бакетов
 */
export async function listBuckets() {
	const client = getS3Client();
	const command = new ListBucketsCommand({});
	return client.send(command);
}

/**
 * Генерирует presigned URL для скачивания файла
 * @param expiresIn Время жизни ссылки в секундах (по умолчанию 1 час)
 */
export async function getDownloadUrl(
	key: string,
	bucketName: string,
	expiresIn = 3600,
): Promise<string> {
	const client = getS3Client();
	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: key,
	});
	// @ts-expect-error Несовместимость версий @smithy/types между @aws-sdk/client-s3 и @aws-sdk/s3-request-presigner
	return getSignedUrl(client, command, { expiresIn });
}
