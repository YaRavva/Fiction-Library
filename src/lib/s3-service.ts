/**
 * S3 сервис для Cloud.ru
 * @deprecated Используйте импорты из "@/lib/s3" напрямую
 *
 * Этот файл сохранен для обратной совместимости.
 * Все функции реэкспортируются из нового модуля.
 */

import {
	getBooksBucketName,
	getS3Client,
	deleteObject as newDeleteObject,
	getObject as newGetObject,
	headObject as newHeadObject,
	putObject as newPutObject,
} from "./s3";

// Реэкспорт с адаптацией для обратной совместимости
// (старый API использовал process.env напрямую для имени бакета)

export const getObject = async (key: string) => {
	return newGetObject(key, getBooksBucketName());
};

export const putObject = async (
	key: string,
	body: Buffer,
	bucketName?: string,
) => {
	return newPutObject(key, body, bucketName || getBooksBucketName());
};

export const headObject = async (key: string, bucketName?: string) => {
	return newHeadObject(key, bucketName || getBooksBucketName());
};

export const deleteObject = async (key: string, bucketName?: string) => {
	return newDeleteObject(key, bucketName || getBooksBucketName());
};

// Реэкспорт клиента для прямого использования
export { getS3Client };
