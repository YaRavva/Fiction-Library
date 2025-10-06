import { TelegramSyncService } from '../lib/telegram/sync';

async function testFileProcessing() {
  try {
    console.log('🚀 Тестирование нового подхода к обработке файлов...');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Тестируем получение списка файлов
    console.log('📥 Получаем список файлов для обработки...');
    const files = await syncService.getFilesToProcess(5);
    
    console.log(`✅ Получено ${files.length} файлов для обработки:`);
    files.forEach((file: any, index: number) => {
      console.log(`  ${index + 1}. ${file.filename || 'Без имени'} (ID: ${file.messageId})`);
    });
    
    if (files.length > 0) {
      // Тестируем обработку первого файла
      console.log('\n🔄 Тестируем обработку первого файла...');
      const firstFile = files[0];
      const result = await syncService.processSingleFileById(firstFile.messageId as number);
      
      const success = result.success !== false;
      console.log(`${success ? '✅' : '❌'} Обработка файла завершена: ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
      
      if (result.bookTitle && result.bookAuthor) {
        console.log(`📘 Книга: ${result.bookAuthor} - ${result.bookTitle}`);
      }
      
      if (result.fileSize) {
        console.log(`📏 Размер файла: ${result.fileSize} байт`);
      }
      
      if (result.fileUrl) {
        console.log(`🔗 URL файла: ${result.fileUrl}`);
      }
      
      if (!success && result.error) {
        console.log(`❌ Ошибка: ${result.error}`);
      }
    }
    
    console.log('\n✅ Тестирование завершено успешно!');
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    await testFileProcessing();
  })();
}