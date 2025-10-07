import { config } from 'dotenv';
import { join } from 'path';
import { TelegramFileService } from '../lib/telegram/file-service';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function testSingleFileProcessing() {
  try {
    console.log('🔍 Тестирование обработки одного файла из Telegram\n');
    
    // Initialize Telegram file service
    console.log('🔐 Инициализация сервиса работы с файлами Telegram...');
    const fileService = await TelegramFileService.getInstance();
    console.log('✅ Сервис инициализирован');
    
    // Test processing a specific file by ID
    const testMessageId = 4379; // Пример ID сообщения из логов
    console.log(`\n📥 Обрабатываем файл из сообщения с ID: ${testMessageId}...`);
    
    const result = await fileService.processSingleFileById(testMessageId);
    
    console.log(`✅ Результат обработки:`);
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   Filename: ${result.filename}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Skipped: ${result.skipped}`);
    
    if (result.bookTitle && result.bookAuthor) {
      console.log(`   Book: "${result.bookTitle}" by ${result.bookAuthor}`);
    }
    
    if (result.reason) {
      console.log(`   Reason: ${result.reason}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании обработки файла:', error);
    process.exit(1);
  }
}

testSingleFileProcessing();