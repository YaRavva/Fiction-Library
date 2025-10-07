import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

async function simulateSync() {
  try {
    console.log('🔍 Имитация процесса синхронизации...\n');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Выполняем синхронизацию с небольшим лимитом для тестирования
    console.log('🚀 Запуск синхронизации (лимит: 10)...');
    const results = await syncService.syncBooks(10);
    
    console.log('\n📊 Результаты синхронизации:');
    console.log(`   📚 Обработано: ${results.processed}`);
    console.log(`   ➕ Добавлено: ${results.added}`);
    console.log(`   🔄 Обновлено: ${results.updated}`);
    console.log(`   ⚠️ Пропущено: ${results.skipped}`);
    console.log(`   ❌ Ошибок: ${results.errors}`);
    
    // Выводим детали
    console.log('\n📋 Детали:');
    results.details.forEach((detail: any) => {
      console.log(`   ${JSON.stringify(detail)}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    // Отключаемся от Telegram
    const syncService = await TelegramSyncService.getInstance();
    await syncService.shutdown();
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  simulateSync();
}