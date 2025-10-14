#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

/**
 * Скрипт для создания бакета в Cloud.ru S3
 */

async function createCloudRuBucket() {
  console.log('🚀 Создаем бакет в Cloud.ru S3');
  
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
  
  try {
    console.log(`\n📋 Создаем бакет "${bucketName}"...`);
    
    const command = new CreateBucketCommand({
      Bucket: bucketName,
    });
    
    const response = await s3Client.send(command);
    console.log('✅ Бакет успешно создан');
    
    console.log('\n📊 Результат создания:');
    console.log(response);
    
    console.log(`\nℹ️  Имя созданного бакета: ${bucketName}`);
    
  } catch (error: any) {
    console.error('❌ Ошибка при создании бакета в Cloud.ru S3:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск создания бакета
if (require.main === module) {
  createCloudRuBucket()
    .then(() => {
      console.log('\n✅ Создание бакета завершено');
    })
    .catch((error) => {
      console.error('\n❌ Создание бакета завершено с ошибкой:', error);
      process.exit(1);
    });
}

export { createCloudRuBucket };