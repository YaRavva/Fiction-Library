#!/usr/bin/env tsx

import 'dotenv/config';
import { getS3AuthHeaders } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

async function testEndpointUploadFixed() {
  console.log('=== Тестирование загрузки файлов через endpoint https://s3.cloud.ru/books (исправленный) ===');
  
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
  const region = process.env.AWS_REGION || 'ru-central-1';
  
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Key ID: ${keyId}`);
  console.log(`Регион: ${region}`);
  
  try {
    // Создание тестового файла
    const testFileName = `endpoint-test-fixed-${Date.now()}.txt`;
    const testContent = 'Тестовый файл для проверки загрузки через endpoint (исправленный)\nДата: ' + new Date().toISOString();
    const testContentBuffer = Buffer.from(testContent, 'utf-8');
    
    // Подготовка параметров для аутентификации
    // При использовании endpoint https://s3.cloud.ru/books путь к файлу 
    // должен быть относительно этого endpoint, то есть просто имя файла
    const requestParams = {
      method: 'PUT',
      pathname: `/${testFileName}`, // Путь к файлу относительно endpoint
      query: {},
      headers: {
        'host': 's3.cloud.ru',
        'content-type': 'text/plain',
        'content-length': testContentBuffer.length.toString(),
      },
      payload: testContent,
      keyId: keyId,
      keySecret: secretAccessKey,
      tenantId: tenantId,
      region: region,
      service: 's3'
    };
    
    console.log('\n1. Генерация заголовков аутентификации...');
    const authHeaders = await getS3AuthHeaders(requestParams);
    console.log('✅ Заголовки аутентификации успешно сгенерированы');
    
    // Выполняем PUT запрос для загрузки файла
    // Используем endpoint https://s3.cloud.ru/books
    console.log('\n2. Загрузка файла через endpoint https://s3.cloud.ru/books...');
    // URL должен содержать полный путь к файлу относительно корня S3
    const url = `https://s3.cloud.ru/books/${testFileName}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: authHeaders,
      body: testContentBuffer
    });
    
    console.log(`Статус ответа: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Файл успешно загружен через endpoint!');
      
      // Попытка получить загруженный файл
      console.log('\n3. Проверка загруженного файла...');
      const getParams = {
        method: 'GET',
        pathname: `/${testFileName}`, // Путь к файлу относительно endpoint
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
      
      const getAuthHeaders = await getS3AuthHeaders(getParams);
      
      const getResponse = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders
      });
      
      if (getResponse.ok) {
        const fileContent = await getResponse.text();
        console.log('✅ Файл успешно получен!');
        console.log('Содержимое файла:');
        console.log(fileContent);
      } else {
        console.log(`❌ Ошибка при получении файла: ${getResponse.status} ${getResponse.statusText}`);
        const errorText = await getResponse.text();
        console.log('Тело ошибки:', errorText);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Ошибка при загрузке файла: ${response.status} ${response.statusText}`);
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
  testEndpointUploadFixed()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testEndpointUploadFixed };