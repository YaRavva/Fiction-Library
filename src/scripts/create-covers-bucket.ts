#!/usr/bin/env tsx

import 'dotenv/config';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

/**
 * Скрипт для создания бакета в Cloud.ru S3 для хранения обложек книг
 */

async function createCoversBucket() {
  console.log('🚀 Создаем бакет для обложек книг в Cloud.ru S3');
  
  // Создаем сконфигурированный S3-клиент для cloud.ru с аутентификацией
  const s3Client = new S3Client({
    endpoint: 'https://s3.cloud.ru',
    region: process.env.AWS_REGION || 'ru-central-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  
  // Имя бакета для обложек
  const bucketName = 'fiction-library-covers';
  
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
    
    // Обновляем переменную окружения в файле .env
    console.log('\n📝 Обновление файла .env...');
    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Добавляем переменную для бакета обложек
    const coversBucketLine = `S3_COVERS_BUCKET_NAME=${bucketName}`;
    
    // Проверяем, существует ли уже эта переменная
    if (!envContent.includes('S3_COVERS_BUCKET_NAME=')) {
      envContent += `\n${coversBucketLine}`;
      console.log(`✅ Добавлена переменная: S3_COVERS_BUCKET_NAME=${bucketName}`);
    } else {
      // Обновляем существующую переменную
      envContent = envContent.replace(/S3_COVERS_BUCKET_NAME=.*/g, coversBucketLine);
      console.log(`✅ Обновлена переменная: S3_COVERS_BUCKET_NAME=${bucketName}`);
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Файл .env обновлен');
    
  } catch (error: any) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`⚠️  Бакет "${bucketName}" уже существует и принадлежит вам`);
      
      // Обновляем переменную окружения в файле .env
      console.log('\n📝 Обновление файла .env...');
      const fs = require('fs');
      const path = require('path');
      
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Добавляем переменную для бакета обложек
      const coversBucketLine = `S3_COVERS_BUCKET_NAME=${bucketName}`;
      
      // Проверяем, существует ли уже эта переменная
      if (!envContent.includes('S3_COVERS_BUCKET_NAME=')) {
        envContent += `\n${coversBucketLine}`;
        console.log(`✅ Добавлена переменная: S3_COVERS_BUCKET_NAME=${bucketName}`);
      } else {
        // Обновляем существующую переменную
        envContent = envContent.replace(/S3_COVERS_BUCKET_NAME=.*/g, coversBucketLine);
        console.log(`✅ Обновлена переменная: S3_COVERS_BUCKET_NAME=${bucketName}`);
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Файл .env обновлен');
    } else {
      console.error('❌ Ошибка при создании бакета в Cloud.ru S3:', error.message);
      console.error('Полный стек ошибки:');
      console.error(error);
    }
  }
}

// Запуск создания бакета
if (require.main === module) {
  createCoversBucket()
    .then(() => {
      console.log('\n✅ Создание бакета завершено');
    })
    .catch((error) => {
      console.error('\n❌ Создание бакета завершено с ошибкой:', error);
      process.exit(1);
    });
}

export { createCoversBucket };