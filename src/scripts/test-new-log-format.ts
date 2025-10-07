import { downloadMissingFilesAsync } from './download-files-async';

/**
 * Тестовый скрипт для проверки нового формата лога обработки файлов
 */
async function testNewLogFormat() {
  try {
    console.log('🚀 Тестирование нового формата лога обработки файлов');
    console.log('==============================================');
    
    // Тестируем с небольшим лимитом для демонстрации
    const result = await downloadMissingFilesAsync(3, (progress, message) => {
      // Очищаем консоль для лучшего отображения
      console.clear();
      
      console.log('🚀 Тестирование нового формата лога обработки файлов');
      console.log('==============================================');
      console.log(`📈 Прогресс: ${progress}%`);
      console.log('');
      console.log(message);
    });
    
    console.log('\n🎉 Тест завершен!');
    console.log('\n📊 Финальный отчет:');
    console.log(result.report);
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    await testNewLogFormat();
  })();
}