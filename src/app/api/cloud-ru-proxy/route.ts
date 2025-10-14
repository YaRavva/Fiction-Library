import { NextRequest } from 'next/server';
import { getS3AuthHeaders } from '@/lib/cloud-ru-s3-service';

// Конфигурация Cloud.ru S3
const BUCKET = process.env.S3_BUCKET_NAME || 'books';
const REGION = process.env.AWS_REGION || 'ru-central-1';

/**
 * GET /api/cloud-ru-proxy
 * Проксирующий endpoint для доступа к файлам в Cloud.ru S3 с аутентификацией
 * 
 * Query params:
 * - fileName: имя файла в бакете
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем параметры запроса
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    
    // Проверяем обязательные параметры
    if (!fileName) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: fileName' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Проверяем переменные окружения
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Cloud.ru S3 environment variables' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Разбор ключа доступа для Cloud.ru
    const accessKeyParts = accessKeyId.split(':');
    if (accessKeyParts.length !== 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid AWS_ACCESS_KEY_ID format. Expected "tenantId:keyId"' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const [tenantId, keyId] = accessKeyParts;
    
    // Подготовка параметров для аутентификации GET запроса
    const requestParams = {
      method: 'GET',
      pathname: `/${BUCKET}/${fileName}`, // Путь с именем бакета
      query: {},
      headers: {
        'host': 's3.cloud.ru',
      },
      payload: '',
      keyId: keyId,
      keySecret: secretAccessKey,
      tenantId: tenantId,
      region: REGION,
      service: 's3'
    };
    
    // Генерация заголовков аутентификации
    const authHeaders = await getS3AuthHeaders(requestParams);
    
    // Формируем URL
    const cloudRuUrl = `https://s3.cloud.ru/${BUCKET}/${fileName}`;
    
    // Выполняем запрос к Cloud.ru S3 с аутентификацией
    const response = await fetch(cloudRuUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders.Authorization,
        'x-amz-date': authHeaders['x-amz-date'],
        'x-amz-content-sha256': authHeaders['x-amz-content-sha256'],
        'host': 's3.cloud.ru'
      }
    });
    
    // Проверяем успешность запроса
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ 
          error: `Cloud.ru S3 request failed: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Получаем содержимое ответа
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    // Возвращаем ответ с содержимым файла
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    
    return new Response(arrayBuffer, {
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error('Error in cloud-ru-proxy endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}