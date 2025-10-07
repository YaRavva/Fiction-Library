import { config } from 'dotenv';
import { TelegramSyncService } from '@/lib/telegram/sync';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Переводит технические коды причин пропуска в человекочитаемые сообщения на русском языке
 * @param reason Технический код причины пропуска
 * @returns Человекочитаемое сообщение на русском языке
 */
function translateSkipReason(reason: string): string {
  switch (reason) {
    case 'book_not_found':
      return 'Книга не найдена';
    case 'book_not_imported':
      return 'Книга не импортирована';
    case 'already_processed':
      return 'Уже обработан';
    case 'book_already_has_file':
      return 'У книги уже есть файл';
    case 'book_already_has_file_in_books_table':
      return 'У книги уже есть файл (в таблице books)';
    default:
      return reason || 'Не указана';
  }
}

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
        // Используем функцию перевода для причины пропуска
        const reasonText = translateSkipReason(result.reason as string);
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