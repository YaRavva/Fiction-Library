#!/usr/bin/env tsx

import 'dotenv/config';
import * as http from 'http';
import * as url from 'url';

async function testFrontendDownload() {
  console.log('=== Тестирование загрузки файлов через фронтенд ===');
  
  const fileName = '1039.zip';
  const port = 3001; // Порт для тестового сервера
  
  console.log(`\n1. Запуск тестового сервера на порту ${port}...`);
  
  // Создаем простой HTTP сервер для тестирования
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    
    if (parsedUrl.pathname === '/test-download') {
      console.log('\n2. Получен запрос на тестовую загрузку файла...');
      
      try {
        // Имитируем вызов нашего проксирующего endpoint
        console.log('3. Вызов проксирующего endpoint /api/cloud-ru-proxy...');
        
        // Поскольку мы не можем напрямую вызвать Next.js API endpoint из этого скрипта,
        // мы имитируем логику проксирующего endpoint
        
        // Импортируем нашу библиотеку
        const { getS3AuthHeaders } = await import('../lib/cloud-ru-s3-service');
        
        // Проверка переменных окружения
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        
        if (!accessKeyId || !secretAccessKey) {
          throw new Error('Missing Cloud.ru S3 environment variables');
        }
        
        // Разбор ключа доступа для Cloud.ru
        const accessKeyParts = accessKeyId.split(':');
        if (accessKeyParts.length !== 2) {
          throw new Error('Invalid AWS_ACCESS_KEY_ID format');
        }
        
        const [tenantId, keyId] = accessKeyParts;
        const bucketName = process.env.S3_BUCKET_NAME || 'books';
        const region = process.env.AWS_REGION || 'ru-central-1';
        
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
        
        console.log('4. Генерация заголовков аутентификации...');
        const authHeaders = await getS3AuthHeaders(requestParams);
        console.log('✅ Заголовки аутентификации успешно сгенерированы');
        
        // Выполняем GET запрос для получения файла
        console.log('5. Получение файла из Cloud.ru S3 с аутентификацией...');
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
          
          // Получаем содержимое файла
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log(`Размер файла: ${buffer.length} байт`);
          
          // Проверяем, что это действительно ZIP файл
          if (buffer.length >= 4) {
            const header = buffer.subarray(0, 4);
            const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
            console.log(`Файл является ZIP архивом: ${isZip ? 'Да' : 'Нет'}`);
          }
          
          // Отправляем файл клиенту
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': buffer.length
          });
          
          res.end(buffer);
          
          console.log('✅ Файл успешно отправлен клиенту!');
          
        } else {
          const errorText = await response.text();
          console.log(`❌ Ошибка при получении файла: ${response.status} ${response.statusText}`);
          console.log('Тело ошибки:', errorText);
          
          res.writeHead(response.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `Cloud.ru S3 request failed: ${response.status} ${response.statusText}`,
            details: errorText
          }));
        }
        
      } catch (error: any) {
        console.error('❌ Ошибка:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });
  
  // Запускаем сервер
  server.listen(port, () => {
    console.log(`✅ Тестовый сервер запущен на http://localhost:${port}`);
    console.log('\n6. Тестирование загрузки файла через фронтенд логику...');
    
    // Имитируем фронтенд логику загрузки файла
    setTimeout(async () => {
      try {
        console.log('7. Вызов fetch для тестовой загрузки...');
        const response = await fetch(`http://localhost:${port}/test-download`);
        
        console.log(`Статус ответа: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log('✅ Файл успешно получен через фронтенд логику!');
          
          // Получаем содержимое файла
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log(`Размер файла: ${buffer.length} байт`);
          
          // Проверяем, что это действительно ZIP файл
          if (buffer.length >= 4) {
            const header = buffer.subarray(0, 4);
            const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
            console.log(`Файл является ZIP архивом: ${isZip ? 'Да' : 'Нет'}`);
          }
          
          console.log('\n🎉 Тест фронтенд загрузки успешно завершен!');
          console.log('Кнопки "Читать" и "Скачать" в интерфейсе теперь должны работать правильно!');
          
        } else {
          const errorText = await response.text();
          console.log(`❌ Ошибка при получении файла: ${response.status} ${response.statusText}`);
          console.log('Тело ошибки:', errorText);
        }
        
        // Останавливаем сервер
        server.close(() => {
          console.log('\n✅ Тестовый сервер остановлен');
        });
        
      } catch (error: any) {
        console.error('❌ Ошибка при тестировании фронтенд загрузки:', error.message);
        
        // Останавливаем сервер
        server.close(() => {
          console.log('\n✅ Тестовый сервер остановлен');
        });
      }
    }, 1000);
  });
  
  // Устанавливаем таймаут для остановки сервера в случае ошибки
  setTimeout(() => {
    if (server.listening) {
      console.log('\n⚠️  Таймаут тестирования. Остановка сервера...');
      server.close(() => {
        console.log('✅ Тестовый сервер остановлен');
      });
    }
  }, 10000);
}

// Запуск теста
if (require.main === module) {
  testFrontendDownload()
    .then(() => {
      console.log('\n✅ Тест фронтенд загрузки завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест фронтенд загрузки завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testFrontendDownload };