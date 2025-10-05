import { config } from 'dotenv';
import { resolve } from 'path';
import { syncBooks } from './sync-books';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
console.log('Путь к .env файлу:', envPath);
config({ path: envPath });

async function testSyncBooks() {
  console.log('🚀 Запуск теста синхронизации книг...');
  
  // Проверяем, что необходимые переменные установлены
  const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Отсутствуют необходимые переменные окружения:', missingEnvVars);
    console.log('Проверьте файл .env в корне проекта');
    return;
  }
  
  console.log('✅ Все необходимые переменные окружения найдены');
  console.log('TELEGRAM_API_ID:', process.env.TELEGRAM_API_ID);
  console.log('TELEGRAM_FILES_CHANNEL:', process.env.TELEGRAM_FILES_CHANNEL);
  
  try {
    const result = await syncBooks(5); // Тестируем с маленьким лимитом
    console.log('✅ Результат синхронизации:', result);
    
    // Принудительно завершаем скрипт через 1 секунду после завершения синхронизации
    // Это необходимо из-за известной проблемы с GramJS, которая не освобождает соединения
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('❌ Ошибка при тестировании синхронизации:', error);
    // Принудительно завершаем скрипт и в случае ошибки
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

testSyncBooks();