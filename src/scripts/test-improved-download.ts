import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

async function testImprovedDownload() {
  console.log('🚀 Тестирование улучшенной системы загрузки файлов');
  
  try {
    // Проверим, установлены ли необходимые переменные окружения
    const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.warn(`⚠️  Отсутствуют необходимые переменные окружения: ${missingEnvVars.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✅ Все необходимые переменные окружения загружены');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Тестируем загрузку файлов с маленьким лимитом
    console.log('📥 Тестовая загрузка файлов (лимит: 3)...');
    const results = await syncService.downloadAndProcessFilesDirectly(3);
    
    console.log('\n📊 Результаты тестовой загрузки:');
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    results.forEach((result: any, index: number) => {
      let status = '✅';
      if (result.skipped) {
        status = 'ℹ️';
        skippedCount++;
      } else if (!result.success) {
        status = '❌';
        failedCount++;
      } else {
        successCount++;
      }
      
      console.log(`${index + 1}. ${status} ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
      if (result.skipped) {
        const reason = result.reason || 'Неизвестная причина';
        const reasonText = reason === 'book_not_found' ? 'Книга не найдена' : 
                          reason === 'already_processed' ? 'Уже обработан' : 
                          reason === 'book_not_imported' ? 'Книга не импортирована' : reason;
        console.log(`   Причина: ${reasonText}`);
      } else if (!result.success && result.error) {
        console.log(`   Ошибка: ${result.error}`);
      }
    });
    
    console.log(`\n📈 Статистика:`);
    console.log(`   Успешно: ${successCount}`);
    console.log(`   Пропущено: ${skippedCount}`);
    console.log(`   Ошибок: ${failedCount}`);
    console.log(`   Всего: ${results.length}`);
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании загрузки файлов:', error);
    process.exit(1);
  }
}

testImprovedDownload();