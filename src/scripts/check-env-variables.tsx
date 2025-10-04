// Загружаем переменные окружения из .env файла
import dotenv from 'dotenv';
dotenv.config();

// Проверяем переменные окружения
console.log('=== ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ===\n');

// Telegram API
console.log('TELEGRAM_API_ID:', process.env.TELEGRAM_API_ID ? '✅ Установлен' : '❌ Не установлен');
console.log('TELEGRAM_API_HASH:', process.env.TELEGRAM_API_HASH ? '✅ Установлен' : '❌ Не установлен');

// Supabase
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Установлен' : '❌ Не установлен');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Установлен' : '❌ Не установлен');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Установлен' : '❌ Не установлен');

console.log('\n=== ПРОВЕРКА ЗАВЕРШЕНА ===');