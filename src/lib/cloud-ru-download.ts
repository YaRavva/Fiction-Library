/**
 * Утилита для генерации URL для скачивания файлов из Cloud.ru S3
 */

/**
 * Генерирует URL для скачивания файла из Cloud.ru S3 через проксирующий endpoint
 * @param fileName Имя файла в бакете
 * @returns URL для скачивания файла
 */
export function getCloudRuDownloadUrl(fileName: string): string {
  // Используем проксирующий endpoint на сервере
  return `/api/cloud-ru-proxy?fileName=${encodeURIComponent(fileName)}`;
}

/**
 * Генерирует URL для чтения файла из Cloud.ru S3 через проксирующий endpoint
 * @param fileName Имя файла в бакете
 * @returns URL для чтения файла
 */
export function getCloudRuReadUrl(fileName: string): string {
  // Используем проксирующий endpoint на сервере
  return `/api/cloud-ru-proxy?fileName=${encodeURIComponent(fileName)}`;
}

export default {
  getCloudRuDownloadUrl,
  getCloudRuReadUrl
};