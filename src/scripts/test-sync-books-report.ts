import { config } from 'dotenv';
import { join } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function testSyncBooksReport() {
  try {
    console.log('🔍 Тестирование синхронизации книг с улучшенным отчетом\n');
    
    // Initialize Telegram sync service
    console.log('🔐 Инициализация сервиса синхронизации Telegram...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Сервис инициализирован');
    
    // Test sync with a small limit
    console.log('\n🚀 Запуск синхронизации книг (лимит: 5)...');
    const result = await syncService.syncBooks(5);
    
    console.log('\n📊 РЕЗУЛЬТАТЫ СИНХРОНИЗАЦИИ:');
    console.log(`   ========================================`);
    console.log(`   Обработано: ${result.processed}`);
    console.log(`   Добавлено: ${result.added}`);
    console.log(`   Обновлено: ${result.updated}`);
    console.log(`   Пропущено: ${result.skipped}`);
    console.log(`   Ошибок: ${result.errors}`);
    
    if (result.details && result.details.length > 0) {
      console.log('\n📋 ДЕТАЛИ:');
      result.details.forEach((detail: any, index: number) => {
        let status = '✅';
        if (detail.status === 'error') {
          status = '❌';
        } else if (detail.status === 'skipped') {
          status = 'ℹ️';
        } else if (detail.status === 'updated') {
          status = '🔄';
        } else if (detail.status === 'added') {
          status = '🆕';
        }
        
        console.log(`${index + 1}. ${status} Сообщение ${detail.msgId || 'Без ID'}`);
        if (detail.bookTitle && detail.bookAuthor) {
          console.log(`   Книга: "${detail.bookTitle}" автора ${detail.bookAuthor}`);
        }
        if (detail.reason) {
          console.log(`   Причина: ${detail.reason}`);
        }
        if (detail.error) {
          console.log(`   Ошибка: ${detail.error}`);
        }
        console.log('---');
      });
    }
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании синхронизации:', error);
    process.exit(1);
  }
}

testSyncBooksReport();