import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function linkBookToFile() {
  console.log('🔗 Связывание книги с файлом');
  
  try {
    // Получаем настройки Supabase из переменных окружения
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Не найдены настройки Supabase в переменных окружения');
      process.exit(1);
    }
    
    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // ID сообщений
    const metadataMessageId = '4866'; // ID сообщения в публичном канале (метаданные)
    const fileMessageId = '4378';     // ID сообщения в приватном канале (файл)
    
    console.log(`🔗 Связывание message_id=${metadataMessageId} с файлом message_id=${fileMessageId}`);
    
    // Проверяем существование записи в telegram_processed_messages
    console.log('🔍 Проверка существования записи в telegram_processed_messages...');
    const { data: existingRecord, error: selectError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', metadataMessageId)
      .single();
    
    if (selectError) {
      console.error('❌ Ошибка при поиске записи:', selectError);
      process.exit(1);
    }
    
    if (!existingRecord) {
      console.error(`❌ Запись с message_id=${metadataMessageId} не найдена`);
      process.exit(1);
    }
    
    console.log(`✅ Найдена запись:`);
    console.log(`  Message ID: ${existingRecord.message_id}`);
    console.log(`  Book ID: ${existingRecord.book_id}`);
    console.log(`  Telegram file ID: ${existingRecord.telegram_file_id || 'не задан'}`);
    
    // Обновляем запись, добавляя telegram_file_id
    console.log(`🔄 Обновление записи с telegram_file_id=${fileMessageId}...`);
    const { data: updatedRecord, error: updateError } = await supabase
      .from('telegram_processed_messages')
      .update({ 
        telegram_file_id: fileMessageId,
        processed_at: new Date().toISOString()
      })
      .eq('message_id', metadataMessageId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Ошибка при обновлении записи:', updateError);
      process.exit(1);
    }
    
    console.log(`✅ Запись успешно обновлена:`);
    console.log(`  Message ID: ${updatedRecord.message_id}`);
    console.log(`  Book ID: ${updatedRecord.book_id}`);
    console.log(`  Telegram file ID: ${updatedRecord.telegram_file_id}`);
    console.log(`  Processed at: ${updatedRecord.processed_at}`);
    
    // Теперь пробуем загрузить файл снова
    console.log('\n📥 Попытка загрузки файла...');
    console.log('Для загрузки файла запустите:');
    console.log('npx tsx src/scripts/test-improved-download.ts');
    
  } catch (error) {
    console.error('❌ Ошибка при связывании книги с файлом:', error);
    process.exit(1);
  }
}

linkBookToFile();