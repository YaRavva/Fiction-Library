import { downloadMissingFiles, processFiles } from './download-files';

/**
 * Скрипт для пакетной обработки файлов с отображением прогресса
 * @param limit Количество файлов для обработки (по умолчанию 10)
 */
export async function processFilesBatch(limit: number = 10) {
  try {
    console.log(`🚀 Начинаем пакетную обработку файлов (лимит: ${limit})`);
    
    // Получаем список файлов для обработки
    const listResult = await downloadMissingFiles(limit);
    
    if (!listResult.success) {
      throw new Error(listResult.message);
    }
    
    if (!listResult.files || listResult.files.length === 0) {
      console.log('ℹ️  Нет файлов для обработки');
      return {
        success: true,
        message: 'Нет файлов для обработки',
        files: [],
        results: [],
        report: 'Нет файлов для обработки'
      };
    }
    
    console.log(`✅ Получен список из ${listResult.files.length} файлов для обработки`);
    
    // Обрабатываем файлы по одному
    const processResult = await processFiles(listResult.files);
    
    return {
      success: processResult.success,
      message: processResult.message,
      files: listResult.files,
      results: processResult.results,
      report: processResult.report
    };
  } catch (error) {
    console.error('❌ Ошибка пакетной обработки файлов:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка',
      files: [],
      results: [],
      report: `Ошибка пакетной обработки файлов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 10;
    const result = await processFilesBatch(limit);
    console.log(result.report);
  })();
}