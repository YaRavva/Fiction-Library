import { config } from 'dotenv';
import { downloadMissingFiles } from './download-files';

// Загружаем переменные окружения из .env файла
config();

async function main() {
  const limit = 10;
  console.log(`🚀 Запуск загрузки файлов с лимитом: ${limit}`);
  
  try {
    // Проверим, установлены ли необходимые переменные окружения
    const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.warn(`⚠️  Отсутствуют необходимые переменные окружения: ${missingEnvVars.join(', ')}`);
      console.log('Пожалуйста, убедитесь, что они указаны в вашем .env файле.');
      process.exit(1);
    }
    
    console.log('✅ Все необходимые переменные окружения загружены');
    
    const result = await downloadMissingFiles(limit);
    console.log('\n📊 Результаты загрузки:');
    console.log(result.report);
  } catch (error) {
    console.error('❌ Ошибка при запуске загрузки файлов:', error);
    process.exit(1);
  }
}

main();