import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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
      return 'Книга не найдена в базе данных';
    case 'book_not_imported':
      return 'Книга не импортирована из публичного канала';
    case 'already_processed':
      return 'Файл уже был загружен ранее';
    case 'book_already_has_file':
      return 'У книги уже есть загруженный файл';
    case 'book_already_has_file_in_books_table':
      return 'У книги уже есть файл в таблице books';
    default:
      return reason || 'Неизвестная причина';
  }
}

/**
 * Загружает и обрабатывает один файл из Telegram по ID сообщения
 * @param messageId ID сообщения с файлом в Telegram
 * @returns Результат обработки файла
 */
export async function downloadSingleFile(messageId: number) {
  let syncService: TelegramSyncService | null = null;
  
  try {
    console.log(`🚀 Начинаем загрузку файла из Telegram (ID сообщения: ${messageId})`);
    
    // Получаем экземпляр сервиса синхронизации
    syncService = await TelegramSyncService.getInstance();
    
    // Обрабатываем файл
    console.log('📥 Обрабатываем файл...');
    const result = await syncService.processSingleFileById(messageId);
    
    const success = result.success !== false;
    const skipped = result.skipped === true;
    
    // Выводим результат обработки
    if (skipped) {
      console.log(`⚠️ Файл пропущен: ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
      // Используем функцию перевода для причины пропуска
      const translatedReason = translateSkipReason(result.reason as string);
      console.log(`   Причина: ${translatedReason}`);
      
      if (result.bookTitle && result.bookAuthor) {
        console.log(`   Книга: ${result.bookAuthor} - ${result.bookTitle}`);
      }
    } else if (success) {
      console.log(`✅ Файл успешно обработан: ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
      
      if (result.bookTitle && result.bookAuthor) {
        console.log(`   Книга: ${result.bookAuthor} - ${result.bookTitle}`);
      }
      
      if (result.fileSize) {
        // Форматируем размер файла
        const fileSize = typeof result.fileSize === 'number' ? 
          `${Math.round(result.fileSize / 1024)} КБ` : 
          result.fileSize;
        console.log(`   Размер файла: ${fileSize}`);
      }
      
      // Проверяем формат файла
      if (result.filename) {
        const ext = path.extname(result.filename as string).toLowerCase();
        if (ext === '.fb2' || ext === '.zip') {
          console.log(`   Формат файла: ${ext.substring(1).toUpperCase()}`);
        } else {
          console.log(`   Формат файла: ${ext.substring(1).toUpperCase()} (нестандартный формат)`);
        }
      }
      
      if (result.fileUrl) {
        console.log(`   URL файла: ${result.fileUrl}`);
      }
    } else {
      console.log(`❌ Ошибка обработки файла: ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
      console.log(`   Ошибка: ${result.error || 'Неизвестная ошибка'}`);
    }
    
    // Формируем отчет
    let report = `Результат загрузки файла:\n`;
    report += `Файл: ${result.filename || 'Без имени'} (ID: ${result.messageId})\n`;
    report += `Статус: ${skipped ? 'Пропущен' : success ? 'Успешно' : 'Ошибка'}\n`;
    
    if (skipped) {
      // Используем функцию перевода для причины пропуска
      const translatedReason = translateSkipReason(result.reason as string);
      report += `Причина: ${translatedReason}\n`;
    } else if (!success && result.error) {
      report += `Ошибка: ${result.error}\n`;
    }
    
    if (result.bookTitle && result.bookAuthor) {
      report += `Книга: ${result.bookAuthor} - ${result.bookTitle}\n`;
    }
    
    if (result.fileSize) {
      // Форматируем размер файла
      const fileSize = typeof result.fileSize === 'number' ? 
        `${Math.round(result.fileSize / 1024)} КБ` : 
        result.fileSize;
      report += `Размер файла: ${fileSize}\n`;
    }
    
    // Проверяем формат файла
    if (result.filename) {
      const ext = path.extname(result.filename as string).toLowerCase();
      if (ext === '.fb2' || ext === '.zip') {
        report += `Формат файла: ${ext.substring(1).toUpperCase()}\n`;
      } else {
        report += `Формат файла: ${ext.substring(1).toUpperCase()} (нестандартный формат)\n`;
      }
    }
    
    if (result.fileUrl) {
      report += `URL файла: ${result.fileUrl}\n`;
    }
    
    // Если обработка прошла успешно, проверяем запись в базе данных
    if (success && !skipped && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('\n🔍 Проверяем запись в базе данных...');
      
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Проверяем запись в таблице books
        const { data: book, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('telegram_file_id', messageId.toString())
          .single();
          
        if (bookError) {
          console.warn('⚠️ Ошибка при получении записи книги:', bookError.message);
        } else if (book) {
          console.log('✅ Найдена запись книги в базе данных:');
          console.log(`   ID: ${book.id}`);
          console.log(`   Название: ${book.title}`);
          console.log(`   Автор: ${book.author}`);
          console.log(`   URL файла: ${book.file_url}`);
          console.log(`   Путь хранения: ${book.storage_path}`);
          console.log(`   Формат: ${book.file_format}`);
          
          // Форматируем размер файла
          if (book.file_size) {
            const fileSize = typeof book.file_size === 'number' ? 
              `${Math.round(book.file_size / 1024)} КБ` : 
              book.file_size;
            console.log(`   Размер: ${fileSize}`);
          }
          
          console.log(`   Telegram ID: ${book.telegram_file_id}`);
          
          report += `\nЗапись в базе данных:\n`;
          report += `ID: ${book.id}\n`;
          report += `Название: ${book.title}\n`;
          report += `Автор: ${book.author}\n`;
          report += `URL файла: ${book.file_url}\n`;
          report += `Путь хранения: ${book.storage_path}\n`;
          report += `Формат: ${book.file_format}\n`;
          
          // Форматируем размер файла
          if (book.file_size) {
            const fileSize = typeof book.file_size === 'number' ? 
              `${Math.round(book.file_size / 1024)} КБ` : 
              book.file_size;
            report += `Размер: ${fileSize}\n`;
          }
          
          report += `Telegram ID: ${book.telegram_file_id}\n`;
        } else {
          console.warn('⚠️ Запись книги не найдена в базе данных');
        }
        
        // Проверяем запись в таблице telegram_processed_messages
        const { data: processedMessage, error: processedError } = await supabase
          .from('telegram_processed_messages')
          .select('*')
          .eq('telegram_file_id', messageId.toString())
          .single();
          
        if (processedError) {
          console.warn('⚠️ Ошибка при получении записи в telegram_processed_messages:', processedError.message);
        } else if (processedMessage) {
          console.log('✅ Найдена запись в telegram_processed_messages:');
          console.log(`   ID: ${processedMessage.id}`);
          console.log(`   Book ID: ${processedMessage.book_id}`);
          console.log(`   Telegram File ID: ${processedMessage.telegram_file_id}`);
          console.log(`   Processed At: ${processedMessage.processed_at}`);
          
          report += `\nЗапись в telegram_processed_messages:\n`;
          report += `ID: ${processedMessage.id}\n`;
          report += `Book ID: ${processedMessage.book_id}\n`;
          report += `Telegram File ID: ${processedMessage.telegram_file_id}\n`;
          report += `Processed At: ${processedMessage.processed_at}\n`;
        } else {
          console.warn('⚠️ Запись в telegram_processed_messages не найдена');
        }
      } catch (dbError) {
        console.warn('⚠️ Ошибка при проверке записи в базе данных:', dbError);
      }
    }
    
    return {
      success: skipped || success,
      message: skipped 
        ? `Файл ${result.filename || 'Без имени'} пропущен: ${translateSkipReason(result.reason as string)}` 
        : success 
          ? `Файл ${result.filename || 'Без имени'} успешно обработан` 
          : `Ошибка обработки файла: ${result.error}`,
      result,
      report
    };
  } catch (error) {
    console.error('❌ Ошибка загрузки файла:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
      result: null,
      report: `Ошибка загрузки файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  } finally {
    // Завершаем работу клиента
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🔌 Telegram клиент отключен');
      } catch (shutdownError) {
        console.warn('⚠️ Ошибка при отключении Telegram клиента:', shutdownError);
      }
    }
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  const args = process.argv.slice(2);
  const messageId = args[0] ? parseInt(args[0], 10) : 0;
  
  if (!messageId || isNaN(messageId)) {
    console.error('❌ Пожалуйста, укажите ID сообщения с файлом');
    console.log('Использование: npx tsx src/scripts/download-single-file.ts <messageId>');
    console.log('Пример: npx tsx src/scripts/download-single-file.ts 12345');
    process.exit(1);
  }
  
  downloadSingleFile(messageId)
    .then((result) => {
      console.log('\n📋 Отчет:');
      console.log(result.report);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка выполнения скрипта:', error);
      process.exit(1);
    });
}