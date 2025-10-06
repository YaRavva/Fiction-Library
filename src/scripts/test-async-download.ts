import { downloadMissingFilesAsync } from './download-files-async';

async function testAsyncDownload() {
  try {
    console.log('🚀 Тестирование асинхронной загрузки файлов...');
    
    // Тестируем асинхронную загрузку с отображением прогресса
    const result = await downloadMissingFilesAsync(5, (progress, message, result) => {
      console.log(`[${progress}%] ${message}`);
      
      // Если есть результат, выводим дополнительную информацию
      if (result && result.bookTitle && result.bookAuthor) {
        console.log(`      Книга: ${result.bookAuthor} - ${result.bookTitle}`);
      }
    });
    
    console.log('\n✅ Тестирование завершено!');
    console.log('\n📊 Итоговый отчет:');
    console.log(result.report);
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    await testAsyncDownload();
  })();
}