#!/usr/bin/env tsx

import 'dotenv/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function testUploadToExistingBucket() {
  console.log('=== Тест загрузки в существующий бакет ===');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'fiction-library-1760461283197';
  const testFileName = 'test-upload.txt';
  const testContent = 'Это тестовый файл для проверки загрузки в существующий бакет Cloud.ru S3';
  
  console.log(`Бакет: ${bucketName}`);
  console.log(`Тестовый файл: ${testFileName}`);
  
  try {
    // Создание команды для загрузки объекта
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: testFileName,
      Body: testContent,
    });
    
    // Выполнение загрузки
    console.log('\n📥 Загрузка тестового файла...');
    const response = await cloudRuS3.send(command);
    
    console.log('✅ Тестовый файл успешно загружен');
    console.log('ETag:', response.ETag);
    
    console.log('\n📊 Результаты теста:');
    console.log(`Бакет: ${bucketName}`);
    console.log(`Файл: ${testFileName}`);
    console.log('Статус: Успешно');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА ЗАГРУЗКИ:', error.message);
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
  testUploadToExistingBucket()
    .then(() => {
      console.log('\n✅ Тест загрузки завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест загрузки завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testUploadToExistingBucket };