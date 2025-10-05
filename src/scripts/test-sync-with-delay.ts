import { config } from 'dotenv';
import { resolve } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testSyncWithDelay() {
  try {
    console.log('🚀 Тестовая синхронизация книг из Telegram с задержкой');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Синхронизируем 3 книги
    console.log('📥 Начинаем синхронизацию 3 книг...');
    const results = await syncService.syncBooks(3);
    
    console.log('✅ Результаты синхронизации:');
    console.log(`  Обработано: ${results.processed}`);
    console.log(`  Добавлено: ${results.added}`);
    console.log(`  Обновлено: ${results.updated}`);
    console.log(`  Пропущено: ${results.skipped}`);
    console.log(`  Ошибок: ${results.errors}`);
    
    // Выводим детали
    for (const detail of results.details) {
      console.log(`  Деталь: ${JSON.stringify(detail)}`);
    }
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
  } finally {
    // Принудительно завершаем процесс через 2 секунды
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 2000);
  }
}

testSyncWithDelay();