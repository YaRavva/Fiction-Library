#!/usr/bin/env tsx

import 'dotenv/config';
import { listBuckets } from '../lib/cloud-ru-s3-service';

async function testConnection() {
  console.log('=== Тестирование подключения к Cloud.ru S3 ===');
  
  try {
    console.log('\n🔍 Получение списка бакетов...');
    const buckets = await listBuckets();
    
    console.log('\n✅ Подключение успешно!');
    console.log('\n📁 Доступные бакеты:');
    if (buckets.Buckets && buckets.Buckets.length > 0) {
      buckets.Buckets.forEach((bucket: any) => {
        console.log(`  - ${bucket.Name} (создан: ${bucket.CreationDate})`);
      });
    } else {
      console.log('  Нет доступных бакетов');
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА ПОДКЛЮЧЕНИЯ:', error.message);
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
  testConnection()
    .then(() => {
      console.log('\n✅ Тест подключения завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест подключения завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testConnection };