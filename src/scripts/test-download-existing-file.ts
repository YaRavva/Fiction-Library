#!/usr/bin/env tsx

import 'dotenv/config';
import { getS3AuthHeaders } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

async function testDownloadExistingFile() {
  console.log('=== Тестирование загрузки существующего файла 1039.zip ===');
  
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
  const fileName = '1039.zip';
  
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Key ID: ${keyId}`);
  console.log(`Бакет: ${bucketName}`);
  console.log(`Регион: ${region}`);
  console.log(`Файл: ${fileName}`);
  
  try {
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
    
    console.log('\n1. Генерация заголовков аутентификации...');
    const authHeaders = await getS3AuthHeaders(requestParams);
    console.log('✅ Заголовки аутентификации успешно сгенерированы');
    
    // Выполняем GET запрос для получения файла
    console.log('\n2. Получение файла из бакета...');
    const url = `https://s3.cloud.ru/${bucketName}/${fileName}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders
    });
    
    console.log(`Статус ответа: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Файл успешно получен!');
      
      // Получаем содержимое файла
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      console.log(`Размер файла: ${fileBuffer.length} байт`);
      
      // Сохраняем файл локально для проверки
      const localFilePath = path.join(__dirname, fileName);
      fs.writeFileSync(localFilePath, fileBuffer);
      console.log(`Файл сохранен локально: ${localFilePath}`);
      
      // Проверяем, является ли файл ZIP архивом
      if (fileBuffer.length >= 4) {
        const header = fileBuffer.subarray(0, 4);
        const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
        console.log(`Файл является ZIP архивом: ${isZip ? 'Да' : 'Нет'}`);
      }
      
      // Попытка получить метаданные файла (Content-Type, Content-Length и т.д.)
      console.log('\n3. Метаданные файла:');
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
      
    } else {
      const errorText = await response.text();
      console.log(`❌ Ошибка при получении файла: ${response.status} ${response.statusText}`);
      console.log('Тело ошибки:', errorText);
      
      // Дополнительная диагностика
      console.log('\nДополнительная диагностика:');
      console.log('URL запроса:', url);
      console.log('Pathname для подписи:', requestParams.pathname);
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
  testDownloadExistingFile()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testDownloadExistingFile };