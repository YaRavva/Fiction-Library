/**
 * Тестовый скрипт для проверки исправлений в sync.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function testSyncFix() {
  console.log('🧪 Тестирование исправлений в sync.ts\n');
  
  try {
    // Получаем экземпляр сервиса синхронизации
    console.log('1️⃣  Инициализация сервиса синхронизации...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('    ✅ Сервис синхронизации инициализирован\n');
    
    // Тестируем загрузку файлов с лимитом 1
    console.log('2️⃣  Тест загрузки файлов с лимитом 1...');
    const results = await syncService.downloadAndProcessFilesDirectly(1);
    console.log('    ✅ Тест завершен успешно');
    console.log(`    📊 Результаты: ${results.length} файлов обработано`);
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск скрипта
testSyncFix().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});