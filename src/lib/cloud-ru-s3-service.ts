import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Создаем сконфигурированный S3-клиент для cloud.ru с аутентификацией
const cloudRuS3 = new S3Client({
  endpoint: "https://s3.cloud.ru",
  region: process.env.AWS_REGION || 'ru-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Важно для S3-совместимых хранилищ
});

/**
 * Функция для генерации заголовков аутентификации AWS Signature V4 для Cloud.ru S3
 * @param requestParams - параметры запроса
 * @returns Promise, который резолвится с заголовками аутентификации
 */
export async function getS3AuthHeaders(requestParams: {
  method: string;
  pathname: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  payload: string;
  keyId: string;
  keySecret: string;
  tenantId: string;
  region: string;
  service: string;
}) {
  // Для Cloud.ru S3 формируем правильные заголовки аутентификации
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = date.substring(0, 8); // Формат YYYYMMDD
  
  // Формируем credential scope
  const credentialScope = `${dateShort}/${requestParams.region}/${requestParams.service}/aws4_request`;
  
  // Формируем заголовки аутентификации
  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${requestParams.tenantId}:${requestParams.keyId}/${credentialScope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=UNSIGNED-PAYLOAD`,
    'x-amz-date': date,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'host': requestParams.headers.host
  };
}

/**
 * Функция для получения списка бакетов из S3-хранилища cloud.ru
 * @returns Promise, который резолвится с результатом операции ListBuckets
 */
export async function listBuckets() {
  try {
    const command = new ListBucketsCommand({});
    const response = await cloudRuS3.send(command);
    
    console.log('Список бакетов:');
    if (response.Buckets && response.Buckets.length > 0) {
      response.Buckets.forEach((bucket) => {
        console.log(`- ${bucket.Name} (создан: ${bucket.CreationDate})`);
      });
    } else {
      console.log('Бакеты не найдены');
    }
    
    return response;
  } catch (error) {
    console.error('Ошибка при получении списка бакетов:', error);
    throw error;
  }
}

/**
 * Функция для создания бакета в S3-хранилище cloud.ru
 * @param bucketName - имя бакета
 * @returns Promise, который резолвится с результатом операции CreateBucket
 */
export async function createBucket(bucketName: string) {
  try {
    const command = new CreateBucketCommand({
      Bucket: bucketName,
    });
    
    const response = await cloudRuS3.send(command);
    console.log(`Бакет ${bucketName} успешно создан`);
    return response;
  } catch (error) {
    console.error(`Ошибка при создании бакета ${bucketName}:`, error);
    throw error;
  }
}

/**
 * Функция для загрузки файла в S3-хранилище cloud.ru
 * @param bucketName - имя бакета
 * @param fileName - имя файла
 * @param fileContent - содержимое файла (Buffer или ReadableStream)
 * @returns Promise, который резолвится с результатом операции PutObject
 */
export async function uploadFile(bucketName: string, fileName: string, fileContent: Buffer | ReadableStream) {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
    });
    
    const response = await cloudRuS3.send(command);
    console.log(`Файл ${fileName} успешно загружен в бакет ${bucketName}`);
    return response;
  } catch (error) {
    console.error(`Ошибка при загрузке файла ${fileName} в бакет ${bucketName}:`, error);
    throw error;
  }
}

/**
 * Функция для получения файла из S3-хранилища cloud.ru
 * @param bucketName - имя бакета
 * @param fileName - имя файла
 * @returns Promise, который резолвится с содержимым файла в виде Buffer
 */
export async function getFile(bucketName: string, fileName: string): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });
    
    const response = await cloudRuS3.send(command);
    
    // Преобразуем ReadableStream в Buffer
    const body = response.Body;
    if (body instanceof Readable) {
      return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        body.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        body.on('error', reject);
        body.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } else if (body instanceof Uint8Array) {
      return Buffer.from(body);
    } else {
      throw new Error('Неожиданный тип тела ответа');
    }
  } catch (error) {
    console.error(`Ошибка при получении файла ${fileName} из бакета ${bucketName}:`, error);
    throw error;
  }
}

export { cloudRuS3 };