import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

async function fullSync() {
  try {
    console.log('🔍 Полная синхронизация с Telegram...\n');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Выполняем полную синхронизацию
    // Сначала сбросим указатель последнего обработанного сообщения, 
    // чтобы начать синхронизацию с самого начала
    console.log('🔄 Сбрасываем указатель последнего обработанного сообщения...');
    
    // Выполняем синхронизацию с большим лимитом
    console.log('🚀 Запуск полной синхронизации (лимит: 5000)...');
    const results = await syncService.syncBooks(5000);
    
    console.log('\n📊 Результаты полной синхронизации:');
    console.log(`   📚 Обработано: ${results.processed}`);
    console.log(`   ➕ Добавлено: ${results.added}`);
    console.log(`   🔄 Обновлено: ${results.updated}`);
    console.log(`   ⚠️ Пропущено: ${results.skipped}`);
    console.log(`   ❌ Ошибок: ${results.errors}`);
    
    // Выводим сводку по деталям
    const addedBooks = results.details.filter((d: any) => d.status === 'added').length;
    const updatedBooks = results.details.filter((d: any) => d.status === 'updated').length;
    const skippedBooks = results.details.filter((d: any) => d.status === 'skipped').length;
    const errorBooks = results.details.filter((d: any) => d.status === 'error').length;
    
    console.log('\n📋 Сводка по деталям:');
    console.log(`   ➕ Добавлено книг: ${addedBooks}`);
    console.log(`   🔄 Обновлено книг: ${updatedBooks}`);
    console.log(`   ⚠️ Пропущено книг: ${skippedBooks}`);
    console.log(`   ❌ Ошибок: ${errorBooks}`);
    
    // Показываем несколько добавленных книг
    const addedDetails = results.details.filter((d: any) => d.status === 'added');
    if (addedDetails.length > 0) {
      console.log('\n📋 Несколько добавленных книг:');
      addedDetails.slice(0, 10).forEach((detail: any) => {
        console.log(`   ✅ ${detail.bookAuthor} - ${detail.bookTitle}`);
      });
    }
    
    // Показываем несколько обновленных книг
    const updatedDetails = results.details.filter((d: any) => d.status === 'updated');
    if (updatedDetails.length > 0) {
      console.log('\n📋 Несколько обновленных книг:');
      updatedDetails.slice(0, 10).forEach((detail: any) => {
        console.log(`   🔄 ${detail.bookAuthor} - ${detail.bookTitle}`);
      });
    }
    
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
  fullSync();
}

// Экспортируем функцию для использования в других скриптах
export { fullSync };
