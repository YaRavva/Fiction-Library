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

// Операции
export {
	checkFileExists,
	deleteObject,
	getDownloadUrl,
	getObject,
	getObjectAsBuffer,
	headObject,
	listBuckets,
	putObject,
} from "./operations";
