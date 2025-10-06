import { config } from 'dotenv';
import { TelegramSyncService } from '@/lib/telegram/sync';

// Загружаем переменные окружения
config({ path: '.env' });

async function testFileDownload() {
  console.log('🚀 Начинаем тестовую загрузку файла с правильной логикой (лимит 1)...');
  
  try {
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Скачиваем и обрабатываем 1 файл
    console.log('📥 Загружаем 1 файл из Telegram...');
    const results = await syncService.downloadAndProcessFilesDirectly(1);
    
    console.log('\n📊 Результаты тестовой загрузки:');
    console.log(`Обработано файлов: ${results.length}`);
    
    results.forEach((result: any, index: number) => {
      console.log(`\nФайл ${index + 1}:`);
      console.log(`  ID сообщения: ${result.messageId}`);
      console.log(`  Имя файла: ${result.filename || 'Не указано'}`);
      
      if (result.skipped) {
        console.log(`  Статус: ⚠️  Пропущен`);
        const reasonText = result.reason === 'book_not_found' ? 'Книга не найдена' : 
                          result.reason === 'already_processed' ? 'Уже обработан' : 
                          result.reason === 'book_not_imported' ? 'Книга не импортирована' : 
                          result.reason === 'book_already_has_file' ? 'У книги уже есть файл' : 
                          result.reason || 'Не указана';
        console.log(`  Причина: ${reasonText}`);
      } else if (result.success === false) {
        console.log(`  Статус: ❌ Ошибка`);
        console.log(`  Ошибка: ${result.error || 'Не указана'}`);
      } else {
        console.log(`  Статус: ✅ Успешно`);
        console.log(`  Размер файла: ${result.fileSize || 'Не указан'} байт`);
        console.log(`  URL файла: ${result.fileUrl || 'Не указан'}`);
        console.log(`  ID книги: ${result.bookId || 'Не указан'}`);
      }
    });
    
    console.log('\n✅ Тестовая загрузка завершена!');
    
    // Завершаем работу сервиса
    await syncService.shutdown();
  } catch (error) {
    console.error('❌ Ошибка при тестовой загрузке файла:', error);
  }
}

// Выполняем тестовую загрузку
testFileDownload();