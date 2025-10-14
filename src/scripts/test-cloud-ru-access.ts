#!/usr/bin/env tsx

import 'dotenv/config';
import { listBuckets } from '../lib/cloud-ru-s3-service';

/**
 * Скрипт для тестирования доступа к Cloud.ru S3
 */

async function testCloudRuAccess() {
  console.log('🚀 Тестируем доступ к Cloud.ru S3');
  
  try {
    console.log('\n📋 Получаем список бакетов...');
    const buckets = await listBuckets();
    console.log('✅ Успешно получили список бакетов');
    
    if (buckets.Buckets && buckets.Buckets.length > 0) {
      console.log('\n📚 Найденные бакеты:');
      buckets.Buckets.forEach((bucket: any) => {
        console.log(`  - ${bucket.Name} (создан: ${bucket.CreationDate})`);
      });
    } else {
      console.log('ℹ️  Бакеты не найдены');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка при тестировании доступа к Cloud.ru S3:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testCloudRuAccess()
    .then(() => {
      console.log('\n✅ Тест доступа завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест доступа завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testCloudRuAccess };