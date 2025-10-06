import { downloadMissingFiles } from './download-files';

async function main() {
  const limit = 10;
  console.log(`🚀 Запуск загрузки файлов с лимитом: ${limit}`);
  
  try {
    // Проверим, установлены ли необходимые переменные окружения
    const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.warn(`⚠️  Отсутствуют необходимые переменные окружения: ${missingEnvVars.join(', ')}`);
      console.log('Пожалуйста, установите их в вашем .env файле или в переменных окружения системы.');
      console.log('Пример:');
      console.log('TELEGRAM_API_ID=your_api_id');
      console.log('TELEGRAM_API_HASH=your_api_hash');
      console.log('TELEGRAM_SESSION=your_session_string');
      process.exit(1);
    }
    
    const result = await downloadMissingFiles(limit);
    console.log('\n📊 Результаты загрузки:');
    console.log(result.report);
  } catch (error) {
    console.error('❌ Ошибка при запуске загрузки файлов:', error);
    if (error instanceof Error && error.message.includes('environment variables')) {
      console.log('\n💡 Решение:');
      console.log('1. Убедитесь, что переменные окружения TELEGRAM_API_ID, TELEGRAM_API_HASH и TELEGRAM_SESSION установлены');
      console.log('2. Эти переменные должны содержать данные вашего Telegram API');
      console.log('3. TELEGRAM_SESSION должен содержать строку сессии Telegram');
    }
    process.exit(1);
  }
}

main();