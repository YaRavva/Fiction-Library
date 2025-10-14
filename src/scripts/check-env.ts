#!/usr/bin/env tsx

import 'dotenv/config';

/**
 * Скрипт для проверки переменных окружения
 */

function checkEnv() {
  console.log('🔧 Проверка переменных окружения');
  
  // Проверка переменных для Cloud.ru S3
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'ru-central-1';
  const bucketName = process.env.S3_BUCKET_NAME || 'books';
  
  console.log('\n🔐 Cloud.ru S3 переменные:');
  console.log(`AWS_ACCESS_KEY_ID: ${accessKeyId ? '✓ Установлен' : '❌ Не установлен'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${secretAccessKey ? '✓ Установлен' : '❌ Не установлен'}`);
  console.log(`AWS_REGION: ${region}`);
  console.log(`S3_BUCKET_NAME: ${bucketName}`);
  
  if (accessKeyId) {
    console.log(`\n📋 Формат AWS_ACCESS_KEY_ID: ${accessKeyId}`);
    const parts = accessKeyId.split(':');
    console.log(`Количество частей: ${parts.length}`);
    if (parts.length === 2) {
      console.log(`Tenant ID: ${parts[0]}`);
      console.log(`Key ID: ${parts[1]}`);
    } else {
      console.log('❌ Неверный формат AWS_ACCESS_KEY_ID. Ожидается "tenant_id:key_id"');
    }
  }
  
  // Проверка переменных для Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('\n🔐 Supabase переменные:');
  console.log(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓ Установлен' : '❌ Не установлен'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✓ Установлен' : '❌ Не установлен'}`);
}

// Запуск проверки
if (require.main === module) {
  checkEnv();
  console.log('\n✅ Проверка переменных окружения завершена');
}

export { checkEnv };