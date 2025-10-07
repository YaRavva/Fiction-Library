import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

import { downloadMissingFilesAsync } from './download-files-async';

async function downloadFiles() {
  console.log('🚀 Запуск улучшенной загрузки отсутствующих файлов из Telegram');
  
  try {
    // Check if required environment variables are set
    const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.error(`❌ Отсутствуют необходимые переменные окружения: ${missingEnvVars.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✅ Все необходимые переменные окружения загружены');
    
    // Download missing files with a limit of 10
    const result = await downloadMissingFilesAsync(10);
    
    console.log('\n📊 Результаты загрузки:');
    console.log(`   Сообщение: ${result.message}`);
    
    if (result.files && result.files.length > 0) {
      console.log(`   Файлов для обработки: ${result.files.length}`);
    }
    
    if (result.actions && result.actions.length > 0) {
      result.actions.forEach((action: string, index: number) => {
        console.log(`   ${index + 1}. ${action}`);
      });
    }
    
    if (result.results && result.results.length > 0) {
      console.log('\n📋 Детали:');
      result.results.forEach((detail: any, index: number) => {
        let status = '✅';
        if (detail.success === false) {
          status = '❌';
        } else if (detail.skipped) {
          status = 'ℹ️';
        } else {
          status = '📥';
        }
        
        console.log(`${index + 1}. ${status} ${detail.messageId || 'Без ID'}`);
        if (detail.filename) {
          console.log(`   Файл: ${detail.filename}`);
        }
        if (detail.bookTitle && detail.bookAuthor) {
          console.log(`   Книга: "${detail.bookTitle}" автора ${detail.bookAuthor}`);
        }
        if (detail.reason) {
          console.log(`   Причина: ${detail.reason}`);
        }
        if (detail.error) {
          console.log(`   Ошибка: ${detail.error}`);
        }
        console.log('---');
      });
    }
    
    console.log(`\n📋 Отчет:`);
    console.log(result.report);
    
  } catch (error) {
    console.error('❌ Ошибка при загрузке файлов:', error);
    process.exit(1);
  }
}

downloadFiles();