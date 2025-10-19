import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testApiFixes() {
  console.log('🚀 Тестирование исправлений API...');
  
  try {
    // Тест 1: Проверка импорта TelegramMetadataService
    const { TelegramMetadataService } = await import('../lib/telegram/metadata-service');
    console.log('✅ TelegramMetadataService импортирован успешно');
    
    // Тест 2: Проверка импорта TelegramService
    const { TelegramService } = await import('../lib/telegram/client');
    console.log('✅ TelegramService импортирован успешно');
    
    // Тест 3: Проверка импорта FileProcessingService
    const { FileProcessingService } = await import('../lib/telegram/file-processing-service');
    console.log('✅ FileProcessingService импортирован успешно');
    
    console.log('\n🎉 Все тесты пройдены успешно! Импорты работают корректно.');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testApiFixes();