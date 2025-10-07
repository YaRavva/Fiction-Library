/**
 * Скрипт для загрузки единичного файла из Telegram по ID сообщения
 * с полным логированием и обработкой ошибок
 *
 * Использование:
 * npx tsx src/scripts/download-single-file.ts <messageId>
 * Пример: npx tsx src/scripts/download-single-file.ts 4379
 */

// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

import { TelegramSyncService } from '../lib/telegram/sync';
import { createClient } from '@supabase/supabase-js';

/**
 * Загружает и обрабатывает единичный файл из Telegram по ID сообщения
 * @param messageId ID сообщения с файлом в Telegram
 */
export async function downloadSingleFile(messageId: number) {
  console.log(`🚀 Начинаем загрузку файла из сообщения ${messageId}`);
  
  // Проверяем, что переменные окружения загружены
  if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH || !process.env.TELEGRAM_SESSION) {
    console.error('❌ Ошибка: Не все необходимые переменные окружения загружены');
    console.error('Проверьте, что файл .env существует и содержит переменные:');
    console.error('  - TELEGRAM_API_ID');
    console.error('  - TELEGRAM_API_HASH');
    console.error('  - TELEGRAM_SESSION');
    process.exit(1);
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Ошибка: Не все необходимые переменные окружения Supabase загружены');
    console.error('Проверьте, что файл .env содержит переменные:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  let syncService: TelegramSyncService | null = null;
  
  try {
    // Получаем экземпляр сервиса синхронизации
    syncService = await TelegramSyncService.getInstance();
    console.log('✅ Telegram клиент инициализирован');
    
    // Обрабатываем файл
    console.log(`📥 Обрабатываем файл из сообщения ${messageId}...`);
    const result = await syncService.processSingleFileById(messageId);
    
    const success = result.success !== false;
    const skipped = result.skipped === true;
    
    // Выводим результат обработки
    if (skipped) {
      console.log(`⚠️ Файл пропущен: ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
      console.log(`   Причина: ${result.reason || 'Неизвестная причина'}`);
      
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
      report += `Причина: ${result.reason || 'Неизвестная причина'}\n`;
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
        ? `Файл ${result.filename || 'Без имени'} пропущен: ${result.reason || 'Неизвестная причина'}` 
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
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Необходимо указать ID сообщения');
    console.error('Использование: npx tsx src/scripts/download-single-file.ts <messageId>');
    console.error('Пример: npx tsx src/scripts/download-single-file.ts 4379');
    process.exit(1);
  }
  
  const messageId = parseInt(args[0], 10);
  if (isNaN(messageId)) {
    console.error('❌ Неверный формат ID сообщения');
    console.error('ID должен быть числом');
    process.exit(1);
  }
  
  // Запускаем загрузку файла
  (async () => {
    const result = await downloadSingleFile(messageId);
    console.log('\n' + result.report);
    
    // Завершаем процесс с кодом в зависимости от результата
    process.exit(result.success ? 0 : 1);
  })().catch(error => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
  });
}