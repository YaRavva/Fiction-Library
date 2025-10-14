#!/usr/bin/env tsx

import 'dotenv/config';
import { uploadFile, listBuckets, getFile } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

async function testUploadUsingService() {
  console.log('=== Тестирование загрузки файлов с использованием существующего сервиса ===');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'books';
  console.log(`Бакет: ${bucketName}`);
  
  try {
    // 1. Проверка подключения - получение списка бакетов
    console.log('\n1. Проверка подключения - получение списка бакетов...');
    const listResponse = await listBuckets();
    console.log('✅ Список бакетов успешно получен');
    
    // 2. Тестовая загрузка файла
    console.log('\n2. Тестовая загрузка файла...');
    const testFileName = `test-upload-service-${Date.now()}.txt`;
    const testContent = Buffer.from('Тестовый файл для проверки загрузки в Cloud.ru S3 через сервис\nДата: ' + new Date().toISOString(), 'utf-8');
    
    const uploadResponse = await uploadFile(bucketName, testFileName, testContent);
    console.log('✅ Файл успешно загружен через сервис!');
    
    // 3. Попытка получить загруженный файл
    console.log('\n3. Проверка загруженного файла...');
    const fileContent = await getFile(bucketName, testFileName);
    console.log('✅ Файл успешно получен!');
    console.log('Содержимое файла:');
    console.log(fileContent.toString('utf-8'));
    
    console.log('\n🎉 Все тесты пройдены успешно!');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    console.error('Код ошибки:', error.name);
    
    // Дополнительная информация об ошибке
    if (error.$metadata) {
      console.error('HTTP Status:', error.$metadata.httpStatusCode);
      console.error('Request ID:', error.$metadata.requestId);
    }
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testUploadUsingService()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testUploadUsingService };