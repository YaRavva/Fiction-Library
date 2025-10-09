#!/usr/bin/env node
/**
 * Скрипт для индексации сообщений из Telegram в базу данных
 * 
 * Этот скрипт получает список постов из Telegram и заносит их в базу данных
 * для быстрого поиска книг.
 */

import dotenv from 'dotenv';
import { BookWormService } from '../lib/telegram/book-worm-service';

// Загружаем переменные окружения
dotenv.config();

// Экспортируем функцию для использования в API
export async function runIndexTelegramPosts() {
  console.log('🚀 Начинаем индексацию сообщений из Telegram...\n');
  
  try {
    // Создаем экземпляр сервиса
    const bookWorm = new BookWormService();
    
    // Выполняем индексацию сообщений
    console.log('Выполняем индексацию сообщений...');
    const indexResult = await bookWorm.advancedIndexMessages(100);
    console.log(`\n✅ Индексация завершена:`);
    console.log(`   Проиндексировано сообщений: ${indexResult.indexed}`);
    console.log(`   Ошибок: ${indexResult.errors}`);
    
    return {
      success: true,
      indexedCount: indexResult.indexed,
      errorCount: indexResult.errors
    };
  } catch (error) {
    console.error('❌ Ошибка при индексации:', error);
    throw error;
  }
}

// Если скрипт запущен напрямую, выполняем индексацию
if (require.main === module) {
  runIndexTelegramPosts()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}