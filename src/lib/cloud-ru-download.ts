/**
 * Утилита для генерации URL для скачивания файлов из Cloud.ru S3
 */

/**
 * Генерирует прямой URL для скачивания файла из Cloud.ru S3
 * @param bucketName Имя бакета
 * @param fileName Имя файла в бакете
 * @returns URL для скачивания файла
 */
export function getCloudRuDownloadUrl(bucketName: string, fileName: string): string {
  return `https://${bucketName}.s3.cloud.ru/${encodeURIComponent(fileName)}`;
}

/**
 * Генерирует прямой URL для чтения файла из Cloud.ru S3
 * @param bucketName Имя бакета
 * @param fileName Имя файла в бакете
 * @returns URL для чтения файла
 */
export function getCloudRuReadUrl(bucketName: string, fileName: string): string {
  return `https://${bucketName}.s3.cloud.ru/${encodeURIComponent(fileName)}`;
}

export default {
  getCloudRuDownloadUrl,
  getCloudRuReadUrl
};