#!/usr/bin/env tsx

import 'dotenv/config';
import { CreateBucketCommand } from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';
import * as fs from 'fs';
import * as path from 'path';

async function createBucketSimple() {
  console.log('=== Создание бакета (упрощенный вариант) ===');
  
  // Создаем уникальное имя бакета с временной меткой
  const bucketName = `books-${Date.now()}`;
  console.log(`Новый бакет: ${bucketName}`);
  
  try {
    // 1. Создание бакета
    console.log('\n1. Создание бакета...');
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
    });
    
    const createResponse = await cloudRuS3.send(createCommand);
    console.log('✅ Бакет успешно создан');
    console.log('Location:', createResponse.Location);
    
    console.log('\n📊 Результаты создания:');
    console.log(`Новый бакет: ${bucketName}`);
    
    // 2. Обновляем переменную окружения в файле .env
    console.log('\n📝 Обновление файла .env...');
    const envPath = path.join(process.cwd(), '.env');
    
    // Читаем содержимое файла .env
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Находим строку с S3_BUCKET_NAME и заменяем её
    const bucketNameRegex = /^S3_BUCKET_NAME=.*$/m;
    if (bucketNameRegex.test(envContent)) {
      envContent = envContent.replace(bucketNameRegex, `S3_BUCKET_NAME=${bucketName}`);
    } else {
      // Если переменная не найдена, добавляем её
      envContent += `\nS3_BUCKET_NAME=${bucketName}`;
    }
    
    // Записываем обновленное содержимое
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Файл .env обновлен. Новый бакет: ${bucketName}`);
    
    console.log('\n💡 Теперь вы можете запустить миграцию с новым бакетом:');
    console.log('   npx tsx src/scripts/migrate-to-cloud-ru.ts');
    
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

// Запуск создания бакета
if (require.main === module) {
  createBucketSimple()
    .then(() => {
      console.log('\n✅ Создание бакета завершено');
    })
    .catch((error) => {
      console.error('\n❌ Создание бакета завершено с ошибкой:', error);
      process.exit(1);
    });
}

export { createBucketSimple };