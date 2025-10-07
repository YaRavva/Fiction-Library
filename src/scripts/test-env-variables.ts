/**
 * Тестовый скрипт для проверки загрузки переменных окружения
 */

import { config } from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

console.log('🔍 Проверка переменных окружения:');
console.log('TELEGRAM_API_ID:', process.env.TELEGRAM_API_ID ? 'Загружена' : 'Не загружена');
console.log('TELEGRAM_API_HASH:', process.env.TELEGRAM_API_HASH ? 'Загружена' : 'Не загружена');
console.log('TELEGRAM_SESSION:', process.env.TELEGRAM_SESSION ? 'Загружена' : 'Не загружена');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Загружена' : 'Не загружена');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Загружена' : 'Не загружена');

if (process.env.TELEGRAM_API_ID) {
  console.log(`✅ TELEGRAM_API_ID: ${process.env.TELEGRAM_API_ID}`);
}

if (process.env.TELEGRAM_API_HASH) {
  console.log(`✅ TELEGRAM_API_HASH: ${process.env.TELEGRAM_API_HASH.substring(0, 5)}...`);
}

if (process.env.TELEGRAM_SESSION) {
  console.log(`✅ TELEGRAM_SESSION: ${process.env.TELEGRAM_SESSION.substring(0, 20)}...`);
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(`✅ SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
}