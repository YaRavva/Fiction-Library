import { getS3AuthHeaders } from '../lib/cloud-ru-s3-service';
import dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

async function testS3Auth() {
  // Читаем необходимые переменные из окружения
  // Используем переменные из .env файла, которые соответствуют облачной инфраструктуре
  const keyId = process.env.AWS_ACCESS_KEY_ID?.split(':')[1]; // Извлекаем ключ из строки формата tenantId:keyId
  const tenantId = process.env.AWS_ACCESS_KEY_ID?.split(':')[0]; // Извлекаем tenantId из строки формата tenantId:keyId
  const keySecret = process.env.AWS_SECRET_ACCESS_KEY;

  if (!keyId || !keySecret || !tenantId) {
    console.error('Отсутствуют необходимые переменные окружения: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    console.log('Текущие значения:');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY);
    return;
  }

  // Определяем параметры для тестового запроса (листинг бакетов)
  const requestParams = {
    method: 'GET',
    pathname: '/books/',
    query: {},
    headers: {
      host: 's3.cloud.ru'
    },
    payload: '',
    keyId: keyId,
    keySecret: keySecret,
    tenantId: tenantId,
    region: 'ru-central-1',
    service: 's3'
  };

  try {
    // Вызываем функцию генерации заголовков аутентификации
    const authHeaders = await getS3AuthHeaders(requestParams);
    
    // Выводим полученные заголовки в консоль
    console.log('Сгенерированные заголовки аутентификации S3:');
    console.log(JSON.stringify(authHeaders, null, 2));
    
    // Выполняем GET запрос к S3 с использованием сгенерированных заголовков
    const response = await fetch('https://s3.cloud.ru/books/', {
      method: 'GET',
      headers: authHeaders
    });
    
    // Выводим статус ответа, заголовки и тело
    console.log('Статус ответа:', response.status);
    console.log('Заголовки ответа:', JSON.stringify([...response.headers.entries()], null, 2));
    const responseBody = await response.text();
    console.log('Тело ответа:', responseBody);
  } catch (error) {
    console.error('Ошибка при генерации заголовков аутентификации или выполнении запроса:', error);
  }
}

// Запускаем тест
testS3Auth();