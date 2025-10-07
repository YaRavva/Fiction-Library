/**
 * Тестовый скрипт для проверки исправления проблемы с ID сообщения
 */

import { config } from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function testMessageIdFix() {
  console.log('🚀 Тестирование исправления проблемы с ID сообщения');
  
  try {
    // Импортируем TelegramSyncService
    const { TelegramSyncService } = await import('../lib/telegram/sync');
    
    // Создаем экземпляр сервиса
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Telegram клиент инициализирован');
    
    // Тестируем с конкретным ID сообщения
    const testMessageId = 4379;
    console.log(`\n🧪 Тестирование с ID сообщения: ${testMessageId}`);
    
    // Обрабатываем файл
    console.log(`📥 Обрабатываем файл из сообщения ${testMessageId}...`);
    const result = await syncService.processSingleFileById(testMessageId);
    
    console.log(`📝 Результат:`);
    console.log(`   Message ID из результата: ${result.messageId}`);
    console.log(`   Filename: ${result.filename}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Skipped: ${result.skipped}`);
    
    if (result.messageId === testMessageId) {
      console.log('✅ Исправление работает корректно - ID сообщения совпадает');
    } else {
      console.log('❌ Исправление не работает - ID сообщения не совпадает');
      console.log(`   Ожидаемый ID: ${testMessageId}`);
      console.log(`   Фактический ID: ${result.messageId}`);
    }
    
    // Отключаем клиент
    await syncService.shutdown();
    console.log('🔌 Telegram клиент отключен');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
testMessageIdFix().catch(console.error);