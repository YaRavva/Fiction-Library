#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client, PutObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';

/**
 * Скрипт для тестирования загрузки файлов в новый бакет Cloud.ru S3
 */

async function testUploadToNewBucket() {
  console.log('🚀 Тестируем загрузку файлов в новый бакет Cloud.ru S3');
  
  // Создаем сконфигурированный S3-клиент для cloud.ru с аутентификацией
  const s3Client = new S3Client({
    endpoint: 'https://s3.cloud.ru',
    region: process.env.AWS_REGION || 'ru-central-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  
  const bucketName = `fiction-library-${Date.now()}`;
  const testFileName = 'test-upload.txt';
  const testContent = 'Это тестовый файл для проверки загрузки в Cloud.ru S3';
  
  try {
    console.log(`\n📋 Создаем бакет "${bucketName}"...`);
    
    // Создаем бакет
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
    });
    
    await s3Client.send(createCommand);
    console.log('✅ Бакет успешно создан');
    
    console.log(`\n📋 Загружаем тестовый файл "${testFileName}" в бакет "${bucketName}"...`);
    const fileBuffer = Buffer.from(testContent, 'utf-8');
    
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testFileName,
      Body: fileBuffer,
    });
    
    const response = await s3Client.send(putCommand);
    console.log('✅ Тестовый файл успешно загружен');
    
    console.log('\n📊 Результат загрузки:');
    console.log(response);
    
  } catch (error: any) {
    console.error('❌ Ошибка при тестировании загрузки файла в Cloud.ru S3:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testUploadToNewBucket()
    .then(() => {
      console.log('\n✅ Тест загрузки в новый бакет завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест загрузки в новый бакет завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testUploadToNewBucket };