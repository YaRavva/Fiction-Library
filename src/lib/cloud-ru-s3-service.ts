import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Создаем сконфигурированный S3-клиент для cloud.ru с аутентификацией
const cloudRuS3 = new S3Client({
  endpoint: 'https://s3.cloud.ru',
  region: process.env.AWS_REGION || 'ru-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Вспомогательная функция для вычисления HMAC-SHA256
 */
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const dataBuffer = encoder.encode(data);
  return crypto.subtle.sign('HMAC', keyBuffer, dataBuffer);
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

/**
 * Функция для генерации подписывающего ключа SigningKey в соответствии с алгоритмом AWS Signature V4
 * @param keySecret - секретный ключ API
 * @param date - дата в формате YYYYMMDD
 * @returns Promise, который резолвится с SigningKey в виде ArrayBuffer
 */
export async function createSigningKey(keySecret: string, date: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const secret = encoder.encode('AWS4' + keySecret);
  
  // DateKey = HMAC-SHA256("AWS4" + "<KeySecret>", "<YYYYMMDD>")
  let dateKey = await hmacSha256(secret.buffer, date);
  
  // DateRegionKey = HMAC-SHA256(DateKey, "ru-central-1")
  dateKey = await hmacSha256(dateKey, 'ru-central-1');
  
  // DateRegionServiceKey = HMAC-SHA256(DateRegionKey, "s3")
  dateKey = await hmacSha256(dateKey, 's3');
  
  // SigningKey = HMAC-SHA256(DateRegionServiceKey, "aws4_request")
  const signingKey = await hmacSha256(dateKey, 'aws4_request');
  
  return signingKey;
}

/**
 * Функция для создания канонического запроса (CanonicalRequest) в соответствии с алгоритмом AWS Signature V4
 * @param method - HTTP-метод (например, GET, POST)
 * @param pathname - URI-путь к ресурсу
 * @param query - параметры запроса в виде объекта
 * @param headers - заголовки запроса виде объекта
 * @param payload - тело запроса
 * @returns Promise, который резолвится с CanonicalRequest в виде строки
 */
export async function createCanonicalRequest(
  method: string,
  pathname: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  payload: string
): Promise<string> {
  // 1. HTTP-метод в верхнем регистре
  const httpMethod = method.toUpperCase();

  // 2. URI-кодированный путь к ресурсу
  const canonicalUri = pathname;

  // 3. Параметры запроса, отсортированные по ключу и объединенные через &
  const canonicalQueryString = Object.keys(query)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');

  // 4. Заголовки, отсортированные по имени в нижнем регистре
  const canonicalHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
    .join('');

  // 5. Имена заголовков, отсортированные, в нижнем регистре и объединенные через ;
  const signedHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(key => key.toLowerCase())
    .join(';');

  // 6. Хеш SHA-256 тела запроса в шестнадцатеричном формате
 const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedPayload = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  // Формирование CanonicalRequest
  return `${httpMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
}

/**
 * Функция для генерации строки подписи (StringToSign) в соответствии с форматом AWS Signature V4
 * @param dateTime - Время в формате ISO 8601 (например, 20230101T220855Z)
 * @param region - Регион AWS
 * @param service - Имя сервиса (например, s3)
 * @param canonicalRequest - Канонический запрос
 * @returns Promise, который резолвится со строкой подписи (StringToSign)
 */
export async function createStringToSign(
  dateTime: string,
  region: string,
  service: string,
  canonicalRequest: string
): Promise<string> {
  // Извлекаем дату в формате YYYYMMDD из dateTime
  const date = dateTime.substring(0, 8);
  
  // Формируем Scope
  const scope = `${date}/${region}/${service}/aws4_request`;
  
  // Вычисляем SHA-256 хеш от канонического запроса
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalRequest);
 const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedCanonicalRequest = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  
  // Формируем StringToSign
  return `AWS4-HMAC-SHA256\n${dateTime}\n${scope}\n${hashedCanonicalRequest}`;
}
/**
 * Функция для вычисления финальной подписи AWS Signature V4
 * @param signingKey - подписывающий ключ, полученный от createSigningKey
 * @param stringToSign - строка для подписи, полученная от createStringToSign
 * @returns Promise, который резолвится с финальной подписью в виде шестнадцатеричной строки в нижнем регистре
 */
export async function calculateSignature(signingKey: ArrayBuffer, stringToSign: string): Promise<string> {
  // Вычисляем HMAC-SHA256 от stringToSign с использованием signingKey
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  
  // Преобразуем результат в шестнадцатеричную строку в нижнем регистре
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  
  return signatureHex;
}

/**
 * Интерфейс для параметров аутентификации S3
 */
interface S3AuthParams {
  method: string;
  pathname: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  payload: string;
  keyId: string;
  keySecret: string;
  tenantId: string;
  region: string;
  service: string;
}

/**
 * Главная функция для генерации заголовков аутентификации S3
 * @param params - Параметры для генерации заголовков аутентификации
 * @returns Promise, который резолвится с объектом заголовков для HTTP-запроса
 */
export async function getS3AuthHeaders(params: S3AuthParams): Promise<Record<string, string>> {
  const {
    method,
    pathname,
    query = {},
    headers,
    payload,
    keyId,
    keySecret,
    tenantId,
    region,
    service
  } = params;

  // Получаем текущую дату и время в нужных форматах
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const dateTime = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  // Добавляем обязательные заголовки
  const host = headers['host'] || 's3.cloud.ru'; // по умолчанию используем cloud.ru
  headers['host'] = host;
  headers['x-amz-date'] = dateTime;
  
  // Вычисляем хеш тела запроса для x-amz-content-sha256
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedPayload = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  
  headers['x-amz-content-sha256'] = hashedPayload;

  // Создаем канонический запрос
  const canonicalRequest = await createCanonicalRequest(
    method,
    pathname,
    query,
    headers,
    payload
  );

  // Создаем строку для подписи
  const stringToSign = await createStringToSign(
    dateTime,
    region,
    service,
    canonicalRequest
  );

  // Создаем подписывающий ключ
  const signingKey = await createSigningKey(keySecret, date);

  // Вычисляем подпись
  const signature = await calculateSignature(signingKey, stringToSign);

  // Формируем имена подписанных заголовков
  const signedHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(key => key.toLowerCase())
    .join(';');

  // Формируем строку авторизации
  const authHeader = `AWS4-HMAC-SHA256 Credential=${tenantId}:${keyId}/${date}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Возвращаем готовые заголовки для HTTP-запроса
  return {
    ...headers,
    Authorization: authHeader
  };
}

export { cloudRuS3 };