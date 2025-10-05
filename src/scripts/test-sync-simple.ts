import { config } from 'dotenv';
import { resolve } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testSync() {
  try {
    console.log('🚀 Тестовая синхронизация книг из Telegram');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Синхронизируем 5 книг
    console.log('📥 Начинаем синхронизацию 5 книг...');
    const results = await syncService.syncBooks(5);
    
    console.log('✅ Результаты синхронизации:');
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
  }
}

testSync();