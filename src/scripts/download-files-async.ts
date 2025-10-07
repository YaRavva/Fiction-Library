import { TelegramSyncService } from '../lib/telegram/sync';

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
 * Асинхронно загружает отсутствующие файлы книг с отображением прогресса
 * @param limit Количество файлов для загрузки (по умолчанию 50)
 * @param progressCallback Функция обратного вызова для отображения прогресса
 */
export async function downloadMissingFilesAsync(
  limit: number = 50, 
  progressCallback?: (progress: number, message: string, result?: any) => void
) {
  try {
    console.log(`🚀 Запуск асинхронной загрузки отсутствующих файлов из Telegram (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем список файлов для обработки
    if (progressCallback) {
      progressCallback(0, '📥 Получение списка файлов для загрузки...');
    }
    
    const files = await syncService.getFilesToProcess(limit);
    
    if (files.length === 0) {
      const message = '✅ Нет файлов для загрузки';
      console.log(message);
      if (progressCallback) {
        progressCallback(100, message);
      }
      return {
        success: true,
        message,
        files: [],
        results: [],
        report: message
      };
    }
    
    const totalFiles = files.length;
    let processedFiles = 0;
    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    
    // Для отслеживания истории обработанных файлов
    let processedFilesHistory = '';
    
    if (progressCallback) {
      progressCallback(0, `📥 Найдено ${totalFiles} файлов для загрузки. Начинаем загрузку...`);
    }
    
    console.log(`📥 Найдено ${totalFiles} файлов для загрузки. Начинаем загрузку...`);
    
    // Обрабатываем каждый файл по одному
    for (const file of files) {
      try {
        const progress = Math.round((processedFiles / totalFiles) * 100);
        const message = `${processedFilesHistory}${processedFilesHistory ? '\n' : ''}📥 Загрузка файла ${processedFiles + 1}/${totalFiles}: ${file.filename || 'Без имени'} (ID: ${file.messageId})`;
        
        if (progressCallback) {
          progressCallback(progress, message);
        }
        
        console.log(`📥 Загрузка файла ${processedFiles + 1}/${totalFiles}: ${file.filename || 'Без имени'} (ID: ${file.messageId})`);
        
        // Обрабатываем файл
        const result = await syncService.processSingleFileById(file.messageId as number);
        results.push(result);
        
        if (result.skipped) {
          skippedCount++;
          // Добавляем пропущенный файл в историю
          const bookInfo = result.bookAuthor && result.bookTitle ? 
            `${result.bookAuthor} - ${result.bookTitle}` : 
            'Книга не найдена';
          const fileSize = result.fileSize && typeof result.fileSize === 'number' ? 
            `${Math.round(result.fileSize / 1024)} КБ` : 
            'размер неизвестен';
          const fileInfo = result.filename ? 
            `${result.filename} (${fileSize})` : 
            'Файл без имени';
          // Используем функцию перевода для причины пропуска
          const translatedReason = translateSkipReason(result.reason as string);
          processedFilesHistory += `${processedFilesHistory ? '\n' : ''}⚠️ ${bookInfo}, ${fileInfo}, Пропущено: ${translatedReason}`;
          console.log(`⚠️ Файл ${file.filename || 'Без имени'} пропущен: ${translatedReason}`);
        } else if (result.success !== false) {
          successCount++;
          // Добавляем успешно обработанный файл в историю
          const bookInfo = result.bookAuthor && result.bookTitle ? 
            `${result.bookAuthor} - ${result.bookTitle}` : 
            'Книга без названия';
          const fileSize = result.fileSize && typeof result.fileSize === 'number' ? 
            `${Math.round(result.fileSize / 1024)} КБ` : 
            'размер неизвестен';
          const fileInfo = result.filename ? 
            `${result.filename} (${fileSize})` : 
            'Файл без имени';
          processedFilesHistory += `${processedFilesHistory ? '\n' : ''}✅ ${bookInfo}, ${fileInfo}, Файл успешно обработан и привязан к книге`;
          console.log(`✅ Файл ${file.filename || 'Без имени'} успешно загружен и привязан к книге`);
        } else {
          failedCount++;
          // Добавляем файл с ошибкой в историю
          const fileSize = result.fileSize && typeof result.fileSize === 'number' ? 
            `${Math.round(result.fileSize / 1024)} КБ` : 
            'размер неизвестен';
          const fileInfo = result.filename ? 
            `${result.filename} (${fileSize})` : 
            'Файл без имени';
          processedFilesHistory += `${processedFilesHistory ? '\n' : ''}❌ ${fileInfo}, Ошибка: ${result.error || 'Неизвестная ошибка'}`;
          console.log(`❌ Ошибка загрузки файла ${file.filename || 'Без имени'}: ${result.error}`);
        }
        
        processedFiles++;
        
        // Отправляем промежуточный результат
        if (progressCallback) {
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${processedFiles}/${totalFiles}`;
          progressCallback(intermediateProgress, statusMessage, result);
        }
        
        console.log(`📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${processedFiles}/${totalFiles}`);
      } catch (error) {
        failedCount++;
        processedFiles++;
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        const result = {
          messageId: file.messageId,
          filename: file.filename,
          success: false,
          error: errorMessage
        };
        results.push(result);
        
        // Добавляем файл с ошибкой в историю
        const fileSize = file.fileSize && typeof file.fileSize === 'number' ? 
          `${Math.round(file.fileSize / 1024)} КБ` : 
          'размер неизвестен';
        const fileInfo = file.filename ? 
          `${file.filename} (${fileSize})` : 
          'Файл без имени';
        processedFilesHistory += `${processedFilesHistory ? '\n' : ''}❌ ${fileInfo}, Ошибка: ${errorMessage}`;
        
        console.log(`❌ Ошибка загрузки файла ${file.filename || 'Без имени'}: ${errorMessage}`);
        
        // Отправляем промежуточный результат
        if (progressCallback) {
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${processedFiles}/${totalFiles}`;
          progressCallback(intermediateProgress, statusMessage, result);
        }
        
        console.log(`📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${processedFiles}/${totalFiles}`);
      }
    }
    
    // Финальный прогресс
    const finalMessage = `${processedFilesHistory}\n🏁 Завершено: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${totalFiles}`;
    if (progressCallback) {
      progressCallback(100, finalMessage);
    }
    
    console.log(`🏁 Завершено: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${totalFiles}`);
    
    // Формируем отчет об операции
    let report = `🚀 Результаты загрузки файлов\n`;
    report += `📊 Статистика:\n`;
    report += `  ✅ Успешно: ${successCount}\n`;
    report += `  ❌ Ошибки: ${failedCount}\n`;
    report += `  ⚠️  Пропущено: ${skippedCount}\n`;
    report += `  📚 Всего: ${totalFiles}\n\n`;
    
    if (processedFilesHistory) {
      report += `${processedFilesHistory}\n`;
    }
    
    return {
      success: true,
      message: finalMessage,
      files,
      results,
      actions: [
        `Обработано файлов: ${totalFiles}`,
        `Успешно: ${successCount}`,
        `С ошибками: ${failedCount}`,
        `Пропущено: ${skippedCount}`
      ],
      report
    };
  } catch (error) {
    console.error('❌ Ошибка асинхронной загрузки файлов:', error);
    if (progressCallback) {
      progressCallback(100, `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
      files: [],
      results: [],
      actions: [],
      report: `❌ Ошибка асинхронной загрузки файлов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 50;
    
    // Простой callback для отображения прогресса в консоли
    const progressCallback = (progress: number, message: string, result?: any) => {
      console.log(`\n[Прогресс: ${progress}%]\n${message}`);
    };
    
    const result = await downloadMissingFilesAsync(limit, progressCallback);
    console.log('\n' + result.report);
  })();
}