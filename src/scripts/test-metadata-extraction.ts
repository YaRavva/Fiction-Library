import dotenv from 'dotenv';
dotenv.config();

import { TelegramFileService } from '../lib/telegram/file-service';

async function testMetadataExtraction() {
  console.log('🚀 Тестируем извлечение метаданных из имен файлов...\n');
  
  // Тестовые данные
  const testCases = [
    'Ольга_Голотвина_Великий_Грайан_.zip',
    'Вилма_Кадлечкова_Мицелий.zip',
    'Ольга Голотвина - Великий Грайан.zip',
    'Вилма Кадлечкова - Мицелий.zip'
  ];
  
  for (const filename of testCases) {
    console.log(`\n📁 Файл: ${filename}`);
    
    // Извлекаем метаданные
    const metadata = TelegramFileService.extractMetadataFromFilename(filename);
    console.log(`  📊 Извлеченные метаданные: author="${metadata.author}", title="${metadata.title}"`);
  }
  
  console.log('\n✅ Тестирование извлечения метаданных завершено!');
}

// Запускаем тест
testMetadataExtraction().catch(console.error);