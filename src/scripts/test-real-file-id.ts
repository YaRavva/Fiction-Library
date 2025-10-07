/**
 * Тестовый скрипт для проверки загрузки файла с реальным ID из базы данных
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function testRealFileId() {
  console.log('🚀 Поиск реального ID файла для тестирования...');
  
  try {
    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Ищем записи в telegram_processed_messages с не-null telegram_file_id
    const { data: records, error } = await supabase
      .from('telegram_processed_messages')
      .select('telegram_file_id, book_id')
      .not('telegram_file_id', 'is', null)
      .limit(5);
      
    if (error) {
      console.error('❌ Ошибка при получении записей:', error.message);
      return;
    }
    
    if (!records || records.length === 0) {
      console.log('⚠️ Записи с telegram_file_id не найдены');
      return;
    }
    
    console.log(`✅ Найдено ${records.length} записей с telegram_file_id:`);
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. File ID: ${record.telegram_file_id}, Book ID: ${record.book_id}`);
    });
    
    // Берем первый ID для тестирования
    const testFileId = parseInt(records[0].telegram_file_id, 10);
    console.log(`\n🧪 Тестирование с File ID: ${testFileId}`);
    
    // Запускаем скрипт загрузки единичного файла
    const { downloadSingleFile } = await import('./download-single-file');
    const result = await downloadSingleFile(testFileId);
    console.log('\n' + result.report);
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
testRealFileId().catch(console.error);