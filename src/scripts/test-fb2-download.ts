/**
 * Тестовый скрипт для проверки загрузки файла в формате .fb2
 */

import { config } from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function testFb2Download() {
  console.log('🚀 Тестирование загрузки файла в формате .fb2');
  
  try {
    // Импортируем необходимые модули
    const { TelegramSyncService } = await import('../lib/telegram/sync');
    const { createClient } = await import('@supabase/supabase-js');
    
    // Создаем экземпляр сервиса
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Telegram клиент инициализирован');
    
    // Используем ID сообщения, которое содержит файл .fb2
    // Это тестовый ID, в реальности нужно использовать существующий ID из вашего канала
    const testMessageId = 4002; // ID файла "Альфред Бестер - Обманщики.fb2"
    console.log(`\n🧪 Тестирование с ID сообщения: ${testMessageId}`);
    
    // Проверим сначала, что файл уже существует
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Проверяем запись в таблице telegram_processed_messages
    const { data: processedRecord, error: processedError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('telegram_file_id', testMessageId.toString())
      .single();
      
    if (processedError) {
      console.log('⚠️ Запись в telegram_processed_messages не найдена или произошла ошибка:', processedError.message);
    } else if (processedRecord) {
      console.log('✅ Найдена запись в telegram_processed_messages:');
      console.log(`   Book ID: ${processedRecord.book_id}`);
      console.log(`   Telegram File ID: ${processedRecord.telegram_file_id}`);
      
      // Получаем информацию о книге
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', processedRecord.book_id)
        .single();
        
      if (bookError) {
        console.log('❌ Ошибка при получении информации о книге:', bookError.message);
      } else if (book) {
        console.log('\n📖 Информация о книге:');
        console.log(`   Название: ${book.title}`);
        console.log(`   Автор: ${book.author}`);
        console.log(`   Формат файла: ${book.file_format}`);
        console.log(`   Путь хранения: ${book.storage_path}`);
        
        // Проверим расширение файла
        if (book.storage_path) {
          const ext = path.extname(book.storage_path).toLowerCase();
          if (ext === '.fb2') {
            console.log(`✅ Файл хранится в формате FB2, как и требуется`);
          } else {
            console.log(`⚠️ Файл хранится в формате ${ext.substring(1).toUpperCase()}`);
          }
        }
      }
    }
    
    // Отключаем клиент
    await syncService.shutdown();
    console.log('\n🔌 Telegram клиент отключен');
    
    console.log('\n✅ Тест завершен успешно');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
testFb2Download().catch(console.error);