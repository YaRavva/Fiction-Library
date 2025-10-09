#!/usr/bin/env node
/**
 * Скрипт для быстрого обновления индекса сообщений Telegram
 * 
 * Получает последние 100 сообщений из Telegram, выясняет, не появилось ли новых постов
 * и если да, то дописывает новые в telegram_messages_index.
 */

import dotenv from 'dotenv';
import { BookWormService } from '../lib/telegram/book-worm-service';

// Загружаем переменные окружения
dotenv.config();

// Экспортируем функцию для использования в API
export async function runQuickIndexUpdate() {
  console.log('🚀 Начинаем быстрое обновление индекса сообщений Telegram...\n');
  
  try {
    // Создаем экземпляр сервиса
    const bookWorm = new BookWormService();
    
    // Проверяем наличие новых сообщений
    console.log('Проверяем наличие новых сообщений...');
    const hasNewMessages = await bookWorm.checkForNewMessages();
    
    if (hasNewMessages.hasNewMessages) {
      console.log('Найдены новые сообщения. Выполняем индексацию...');
      // Выполняем индексацию только новых сообщений
      const indexResult = await bookWorm.advancedIndexMessages(100);
      console.log(`\n✅ Индексация завершена:`);
      console.log(`   Проиндексировано сообщений: ${indexResult.indexed}`);
      console.log(`   Ошибок: ${indexResult.errors}`);
      
      return {
        success: true,
        indexedCount: indexResult.indexed,
        errorCount: indexResult.errors,
        newMessagesFound: true
      };
    } else {
      console.log('Новых сообщений не найдено.');
      return {
        success: true,
        indexedCount: 0,
        errorCount: 0,
        newMessagesFound: false
      };
    }
  } catch (error) {
    console.error('❌ Ошибка при быстром обновлении индекса:', error);
    throw error;
  }
}

// Если скрипт запущен напрямую, выполняем быстрое обновление
if (require.main === module) {
  runQuickIndexUpdate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}