import { config } from 'dotenv';
import { TelegramSyncService } from '@/lib/telegram/sync';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Тестовый скрипт для проверки загрузки файлов с лимитом
 * 
 * Использование:
 * npx tsx src/scripts/test-download-files-with-limit.ts [limit]
 * 
 * Пример:
 * npx tsx src/scripts/test-download-files-with-limit.ts 5
 */

async function testDownloadFilesWithLimit() {
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0]) : 5;

  console.log(`🚀 Тестирование загрузки файлов с лимитом: ${limit}\n`);

  try {
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    console.log(`📥 Начинаем загрузку файлов...`);
    const results = await syncService.downloadAndProcessFilesDirectly(limit);
    
    console.log(`\n✅ Загрузка завершена. Результаты:`);
    console.log(`Обработано файлов: ${results.length}`);
    
    const successCount = results.filter((r: any) => r.success !== false && !r.skipped).length;
    const skippedCount = results.filter((r: any) => r.skipped).length;
    const failedCount = results.filter((r: any) => r.success === false).length;
    
    console.log(`Успешно: ${successCount}`);
    console.log(`Пропущено: ${skippedCount}`);
    console.log(`С ошибками: ${failedCount}`);
    
    if (results.length > 0) {
      console.log(`\nДетали:`);
      
      // Сначала показываем успешные загрузки
      const successfulResults = results.filter((r: any) => r.success !== false && !r.skipped);
      if (successfulResults.length > 0) {
        console.log(`\n✅ Успешно загружено (${successfulResults.length}):`);
        successfulResults.forEach((result: any, index: number) => {
          console.log(`${index + 1}. 📄 ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
          
          if (result.bookTitle && result.bookAuthor) {
            console.log(`   📚 ${result.bookAuthor} - ${result.bookTitle}`);
          } else if (result.bookTitle) {
            console.log(`   📚 ${result.bookTitle}`);
          } else if (result.bookAuthor) {
            console.log(`   📚 ${result.bookAuthor}`);
          }
          
          if (result.fileSize) {
            const sizeInKB = Math.round((result.fileSize as number) / 1024);
            console.log(`   📦 Размер: ${sizeInKB} KB`);
          }
        });
      }
      
      // Затем показываем пропущенные файлы
      const skippedResults = results.filter((r: any) => r.skipped);
      if (skippedResults.length > 0) {
        console.log(`\n⚠️ Пропущено (${skippedResults.length}):`);
        skippedResults.forEach((result: any, index: number) => {
          console.log(`${index + 1}. 📄 ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
          
          if (result.bookTitle && result.bookAuthor) {
            console.log(`   📚 ${result.bookAuthor} - ${result.bookTitle}`);
          } else if (result.bookTitle) {
            console.log(`   📚 ${result.bookTitle}`);
          } else if (result.bookAuthor) {
            console.log(`   📚 ${result.bookAuthor}`);
          }
          
          if (result.reason) {
            const reasonText = result.reason === 'book_not_found' ? 'Книга не найдена' : 
                              result.reason === 'already_processed' ? 'Файл уже загружен ранее' : 
                              result.reason === 'book_not_imported' ? 'Книга не импортирована' : 
                              result.reason === 'book_already_has_file' ? 'У книги уже есть файл' : 
                              result.reason === 'book_already_has_file_in_books_table' ? 'У книги уже есть файл (в таблице books)' : result.reason;
            console.log(`   ⚠️ Причина: ${reasonText}`);
          }
          
          if (result.searchTerms && result.searchTerms.length > 0) {
            console.log(`   🔍 Поисковые термины: ${result.searchTerms.join(', ')}`);
          }
        });
      }
      
      // Наконец показываем файлы с ошибками
      const failedResults = results.filter((r: any) => r.success === false);
      if (failedResults.length > 0) {
        console.log(`\n❌ С ошибками (${failedResults.length}):`);
        failedResults.forEach((result: any, index: number) => {
          console.log(`${index + 1}. 📄 ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
          if (result.error) {
            console.log(`   ❌ Ошибка: ${result.error}`);
          }
        });
      }
    }
    
    console.log(`\n✅ Тест завершен успешно!`);
    
    // Завершаем работу сервиса
    await syncService.shutdown();
  } catch (error) {
    console.error('❌ Ошибка при тестировании загрузки файлов:', error);
    process.exit(1);
  }
}

// Выполняем тест
testDownloadFilesWithLimit();