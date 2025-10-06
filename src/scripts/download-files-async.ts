import { TelegramSyncService } from '../lib/telegram/sync';

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
        const message = `${processedFilesHistory}\n📥 Загрузка файла ${processedFiles + 1}/${totalFiles}: ${file.filename || 'Без имени'} (ID: ${file.messageId})`;
        
        if (progressCallback) {
          progressCallback(progress, message);
        }
        
        console.log(`📥 Загрузка файла ${processedFiles + 1}/${totalFiles}: ${file.filename || 'Без имени'} (ID: ${file.messageId})`);
        
        // Обрабатываем файл
        const result = await syncService.processSingleFileById(file.messageId as number);
        results.push(result);
        
        if (result.success !== false) {
          successCount++;
          // Добавляем успешно обработанный файл в историю
          processedFilesHistory += `${processedFilesHistory ? ' ' : ''}✅ ${file.filename || 'Без имени'}`;
          console.log(`✅ Файл ${file.filename || 'Без имени'} успешно загружен`);
        } else {
          failedCount++;
          // Добавляем файл с ошибкой в историю
          processedFilesHistory += `${processedFilesHistory ? ' ' : ''}❌ ${file.filename || 'Без имени'}`;
          console.log(`❌ Ошибка загрузки файла ${file.filename || 'Без имени'}: ${result.error}`);
        }
        
        processedFiles++;
        
        // Отправляем промежуточный результат
        if (progressCallback) {
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${processedFiles}/${totalFiles}`;
          progressCallback(intermediateProgress, statusMessage, result);
        }
        
        console.log(`📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${processedFiles}/${totalFiles}`);
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
        processedFilesHistory += `${processedFilesHistory ? ' ' : ''}❌ ${file.filename || 'Без имени'}`;
        
        console.log(`❌ Ошибка загрузки файла ${file.filename || 'Без имени'}: ${errorMessage}`);
        
        // Отправляем промежуточный результат
        if (progressCallback) {
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${processedFiles}/${totalFiles}`;
          progressCallback(intermediateProgress, statusMessage, result);
        }
        
        console.log(`📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${processedFiles}/${totalFiles}`);
      }
    }
    
    // Финальный прогресс
    const finalMessage = `${processedFilesHistory}\n🏁 Завершено: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${totalFiles}`;
    if (progressCallback) {
      progressCallback(100, finalMessage);
    }
    
    console.log(`🏁 Завершено: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${totalFiles}`);
    
    // Формируем отчет об операции
    let report = `🚀 Асинхронная загрузка файлов завершена (лимит: ${limit})\n\n`;
    report += `${processedFilesHistory}\n`;
    report += `\n📊 Финальные результаты:\n`;
    report += ` ✅ Успешно: ${successCount}\n`;
    report += ` ❌ Ошибки: ${failedCount}\n`;
    report += ` 📚 Всего: ${totalFiles}\n`;
    
    return {
      success: true,
      message: finalMessage,
      files,
      results,
      actions: [
        `Обработано файлов: ${totalFiles}`,
        `Успешно: ${successCount}`,
        `С ошибками: ${failedCount}`
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