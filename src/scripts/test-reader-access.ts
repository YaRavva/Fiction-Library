#!/usr/bin/env tsx

import 'dotenv/config';
import { getS3AuthHeaders } from '../lib/cloud-ru-s3-service';
import * as fs from 'fs';

async function testReaderAccess() {
  console.log('=== Тестирование доступа к файлу для читалки ===');
  
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
    console.log('\n2. Получение файла из Cloud.ru S3 с аутентификацией...');
    const url = `https://s3.cloud.ru/${bucketName}/${fileName}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders
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
      
      // Сохраняем файл локально для дальнейшего анализа
      const localFilePath = `./src/scripts/${fileName}`;
      fs.writeFileSync(localFilePath, buffer);
      console.log(`Файл сохранен локально: ${localFilePath}`);
      
      // Для читалки нам нужно извлечь содержимое ZIP архива
      // В браузере это делается с помощью JSZip
      console.log('\n3. Анализ содержимого ZIP архива...');
      
      // Имитируем работу с JSZip (в браузере)
      console.log('В браузере используется JSZip для извлечения содержимого архива.');
      console.log('Если архив содержит FB2 файлы, они будут отображены в читалке.');
      
      console.log('\n🎉 Файл готов для использования в читалке!');
      console.log('Для работы кнопок "Читать" и "Скачать" в интерфейсе:');
      console.log('1. Кнопка "Скачать" будет работать, если файл доступен по URL без аутентификации');
      console.log('2. Кнопка "Читать" будет работать, если файл доступен по URL без аутентификации');
      console.log('3. Для Cloud.ru S3 файлы недоступны без аутентификации, поэтому кнопки не будут работать');
      
      console.log('\nДля решения этой проблемы можно:');
      console.log('1. Использовать проксирующий endpoint на сервере, который будет добавлять аутентификацию');
      console.log('2. Загружать файлы в Supabase Storage, который поддерживает публичный доступ');
      console.log('3. Реализовать серверный endpoint для генерации signed URLs');
      
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
  testReaderAccess()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testReaderAccess };