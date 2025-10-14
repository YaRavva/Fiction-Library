#!/usr/bin/env tsx

import 'dotenv/config';
import { uploadFile } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

/**
 * Скрипт для тестирования загрузки файлов в Cloud.ru S3
 */

async function testCloudRuUpload() {
  console.log('🚀 Тестируем загрузку файлов в Cloud.ru S3');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'fiction-library-1760461283197';
  const testFileName = 'test-upload.txt';
  const testContent = 'Это тестовый файл для проверки загрузки в Cloud.ru S3';
  
  try {
    console.log(`\n📋 Загружаем тестовый файл "${testFileName}" в бакет "${bucketName}"...`);
    const fileBuffer = Buffer.from(testContent, 'utf-8');
    
    const result = await uploadFile(bucketName, testFileName, fileBuffer);
    console.log('✅ Тестовый файл успешно загружен');
    
    console.log('\n📊 Результат загрузки:');
    console.log(result);
    
  } catch (error: any) {
    console.error('❌ Ошибка при тестировании загрузки файла в Cloud.ru S3:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testCloudRuUpload()
    .then(() => {
      console.log('\n✅ Тест загрузки завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест загрузки завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testCloudRuUpload };