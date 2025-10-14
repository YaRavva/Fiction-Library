import 'dotenv/config';
import { getS3AuthHeaders } from './cloud-ru-s3-service';
import { Buffer } from 'buffer';

/**
 * Загрузка файла в бакет Cloud.ru S3
 * @param bucketName - имя бакета
 * @param fileName - имя файла в бакете
 * @param fileContent - содержимое файла (строка или Buffer)
 * @param contentType - MIME-тип файла (по умолчанию application/octet-stream)
 * @returns Promise с результатом загрузки
 */
export async function uploadFileToCloudRu(
  bucketName: string,
  fileName: string,
  fileContent: string | Buffer,
  contentType: string = 'application/octet-stream'
): Promise<{ success: boolean; statusCode?: number; statusText?: string; error?: string }> {
  
  try {
    // Проверка переменных окружения
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      return {
        success: false,
        error: 'Не установлены необходимые переменные окружения: AWS_ACCESS_KEY_ID или AWS_SECRET_ACCESS_KEY'
      };
    }
    
    // Разбор ключа доступа для Cloud.ru
    const accessKeyParts = accessKeyId.split(':');
    if (accessKeyParts.length !== 2) {
      return {
        success: false,
        error: 'Неверный формат AWS_ACCESS_KEY_ID. Ожидается формат "tenantId:keyId"'
      };
    }
    
    const [tenantId, keyId] = accessKeyParts;
    const region = process.env.AWS_REGION || 'ru-central-1';
    
    // Преобразование содержимого файла в Buffer
    const fileBuffer = typeof fileContent === 'string' ? Buffer.from(fileContent, 'utf-8') : fileContent;
    
    // Подготовка параметров для аутентификации
    const requestParams = {
      method: 'PUT',
      pathname: `/${bucketName}/${fileName}`,
      query: {},
      headers: {
        'host': 's3.cloud.ru',
        'content-type': contentType,
        'content-length': fileBuffer.length.toString(),
      },
      payload: fileBuffer.toString('utf-8'),
      keyId: keyId,
      keySecret: secretAccessKey,
      tenantId: tenantId,
      region: region,
      service: 's3'
    };
    
    // Генерация заголовков аутентификации
    const authHeaders = await getS3AuthHeaders(requestParams);
    
    // Выполняем PUT запрос для загрузки файла
    const url = `https://s3.cloud.ru/${bucketName}/${fileName}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: authHeaders,
      body: fileBuffer
    });
    
    return {
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Получение файла из бакета Cloud.ru S3
 * @param bucketName - имя бакета
 * @param fileName - имя файла в бакете
 * @returns Promise с содержимым файла или ошибкой
 */
export async function getFileFromCloudRu(
  bucketName: string,
  fileName: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  
  try {
    // Проверка переменных окружения
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      return {
        success: false,
        error: 'Не установлены необходимые переменные окружения: AWS_ACCESS_KEY_ID или AWS_SECRET_ACCESS_KEY'
      };
    }
    
    // Разбор ключа доступа для Cloud.ru
    const accessKeyParts = accessKeyId.split(':');
    if (accessKeyParts.length !== 2) {
      return {
        success: false,
        error: 'Неверный формат AWS_ACCESS_KEY_ID. Ожидается формат "tenantId:keyId"'
      };
    }
    
    const [tenantId, keyId] = accessKeyParts;
    const region = process.env.AWS_REGION || 'ru-central-1';
    
    // Подготовка параметров для аутентификации GET запроса
    const requestParams = {
      method: 'GET',
      pathname: `/${bucketName}/${fileName}`,
      query: {},
      headers: {
        'host': 's3.cloud.ru',
      },
      payload: '',
      keyId: keyId,
      keySecret: secretAccessKey,
      tenantId: tenantId,
      region: region,
      service: 's3'
    };
    
    // Генерация заголовков аутентификации
    const authHeaders = await getS3AuthHeaders(requestParams);
    
    // Выполняем GET запрос для получения файла
    const url = `https://s3.cloud.ru/${bucketName}/${fileName}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders
    });
    
    if (response.ok) {
      const content = await response.text();
      return {
        success: true,
        content
      };
    } else {
      return {
        success: false,
        error: `Ошибка при получении файла: ${response.status} ${response.statusText}`
      };
    }
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  uploadFileToCloudRu,
  getFileFromCloudRu
};