import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

async function syncMetadata() {
  console.log('🚀 Синхронизация метаданных из публичного канала (увеличенный лимит)');
  
  try {
    // Проверим, установлены ли необходимые переменные окружения
    const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.warn(`⚠️  Отсутствуют необходимые переменные окружения: ${missingEnvVars.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✅ Все необходимые переменные окружения загружены');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Синхронизируем метаданные с большим лимитом
    console.log('📥 Синхронизация метаданных (лимит: 100)...');
    const result = await syncService.syncBooks(100);
    
    console.log('\n📊 Результаты синхронизации:');
    console.log(`   Обработано: ${result.processed}`);
    console.log(`   Добавлено: ${result.added}`);
    console.log(`   Обновлено: ${result.updated}`);
    console.log(`   Пропущено: ${result.skipped}`);
    console.log(`   Ошибок: ${result.errors}`);
    
    if (result.details && result.details.length > 0) {
      console.log('\n📋 Детали:');
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
        
        console.log(`${index + 1}. ${status} ${detail.msgId || 'Без ID'}`);
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
    
  } catch (error) {
    console.error('❌ Ошибка при синхронизации метаданных:', error);
    process.exit(1);
  }
}

syncMetadata();