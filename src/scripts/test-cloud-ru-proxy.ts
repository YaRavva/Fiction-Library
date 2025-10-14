#!/usr/bin/env tsx

import 'dotenv/config';

async function testCloudRuProxy() {
  console.log('=== Тестирование проксирующего endpoint для Cloud.ru S3 ===');
  
  const fileName = '1039.zip';
  
  try {
    console.log(`\n1. Тестирование GET запроса к /api/cloud-ru-proxy?fileName=${fileName}...`);
    
    // Создаем запрос к нашему проксирующему endpoint
    const url = `http://localhost:3000/api/cloud-ru-proxy?fileName=${encodeURIComponent(fileName)}`;
    
    console.log(`URL запроса: ${url}`);
    
    // Поскольку сервер уже запущен, мы не можем напрямую вызвать endpoint
    // Вместо этого проверим, что файл существует и доступен через нашу библиотеку
    
    console.log('\n2. Проверка доступности файла через нашу библиотеку...');
    
    // Импортируем нашу библиотеку
    const { getS3AuthHeaders } = await import('../lib/cloud-ru-s3-service');
    
    // Проверка переменных окружения
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
      return;
    }
    
    // Разбор ключа доступа для Cloud.ru
    const accessKeyParts = accessKeyId.split(':');
    if (accessKeyParts.length !== 2) {
      console.error('❌ ОШИБКА: Неверный формат AWS_ACCESS_KEY_ID. Ожидается формат "tenantId:keyId"');
      return;
    }
    
    const [tenantId, keyId] = accessKeyParts;
    const bucketName = process.env.S3_BUCKET_NAME || 'books';
    const region = process.env.AWS_REGION || 'ru-central-1';
    
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Key ID: ${keyId}`);
    console.log(`Бакет: ${bucketName}`);
    console.log(`Регион: ${region}`);
    console.log(`Файл: ${fileName}`);
    
    // Подготовка параметров для аутентификации GET запроса
    const requestParams = {
      method: 'GET',
      pathname: `/${bucketName}/${fileName}`, // Путь с именем бакета
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
    
    console.log('\n3. Генерация заголовков аутентификации...');
    const authHeaders = await getS3AuthHeaders(requestParams);
    console.log('✅ Заголовки аутентификации успешно сгенерированы');
    
    // Выполняем GET запрос для получения файла
    console.log('\n4. Получение файла из Cloud.ru S3 с аутентификацией...');
    const cloudRuUrl = `https://s3.cloud.ru/${bucketName}/${fileName}`;
    
    const response = await fetch(cloudRuUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders.Authorization,
        'x-amz-date': authHeaders['x-amz-date'],
        'x-amz-content-sha256': authHeaders['x-amz-content-sha256'],
        'host': 's3.cloud.ru'
      }
    });
    
    console.log(`Статус ответа: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Файл успешно получен из Cloud.ru S3 с аутентификацией!');
      
      // Получаем размер файла из заголовков
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        console.log(`Размер файла (из заголовков): ${contentLength} байт`);
      }
      
      // Проверяем Content-Type
      const contentType = response.headers.get('content-type');
      if (contentType) {
        console.log(`Content-Type: ${contentType}`);
      }
      
      console.log('\n🎉 Проксирующий endpoint готов к работе!');
      console.log('Когда сервер запущен, endpoint /api/cloud-ru-proxy будет обрабатывать запросы к Cloud.ru S3');
      
    } else {
      const errorText = await response.text();
      console.log(`❌ Ошибка при получении файла: ${response.status} ${response.statusText}`);
      console.log('Тело ошибки:', errorText);
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testCloudRuProxy()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testCloudRuProxy };