import { config } from 'dotenv';
import { linkExistingBooks } from './link-existing-books';
import { fixDuplicates } from './fix-duplicates';
import { fullSync } from './full-sync';

// Загружаем переменные окружения из .env файла
config();

async function resolveMissingBooks() {
  try {
    console.log('🚀 Решение проблемы с недостающими книгами\n');
    
    // Шаг 1: Связываем существующие книги с сообщениями Telegram
    console.log('Шаг 1: Связывание существующих книг с сообщениями Telegram');
    console.log('=====================================================');
    await linkExistingBooks();
    
    // Шаг 2: Обрабатываем дубликаты
    console.log('\nШаг 2: Обработка дубликатов книг');
    console.log('================================');
    await fixDuplicates();
    
    // Шаг 3: Выполняем полную синхронизацию
    console.log('\nШаг 3: Полная синхронизация с Telegram');
    console.log('=====================================');
    await fullSync();
    
    console.log('\n✅ Все задачи выполнены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  resolveMissingBooks();
}