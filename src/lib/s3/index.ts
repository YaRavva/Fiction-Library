/**
 * Модуль S3 для Cloud.ru
 * Экспортирует все необходимые функции для работы с S3 хранилищем
 */

// Клиент
export {
	getBooksBucketName,
	getCoversBucketName,
	getPublicUrl,
	getS3Client,
	resetS3Client,
} from "./client";
// Типы
export type { S3Object } from "./operations";
// Операции
export {
	checkFileExists,
	deleteObject,
	getDownloadUrl,
	getObject,
	getObjectAsBuffer,
	headObject,
	listBuckets,
	listObjects,
	putObject,
} from "./operations";
