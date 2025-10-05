/**
 * Тестовый скрипт для проверки всех исправлений
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function testFixes() {
  console.log('🧪 Тестирование всех исправлений\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем экземпляр сервиса синхронизации
    console.log('🔧 Получение экземпляра сервиса синхронизации...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Сервис синхронизации получен\n');
    
    // Тестируем обработку одного файла
    console.log('🚀 Тест обработки 1 файла...');
    const results = await syncService.downloadAndProcessFilesDirectly(1);
    
    console.log(`\n📊 Результаты обработки:`);
    console.log(`   Всего обработано: ${results.length}`);
    
    for (const result of results) {
      console.log(`   - Message ID: ${result.messageId}`);
      console.log(`     Успешно: ${result.success ? 'Да' : 'Нет'}`);
      console.log(`     Пропущено: ${result.skipped ? 'Да' : 'Нет'}`);
      if (result.filename) console.log(`     Имя файла: ${result.filename}`);
      if (result.error) console.log(`     Ошибка: ${result.error}`);
      if (result.reason) {
        const reasonText = result.reason === 'book_not_found' ? 'Книга не найдена' : 
                          result.reason === 'already_processed' ? 'Уже обработан' : result.reason;
        console.log(`     Причина: ${reasonText}`);
      }
      
      // Проверяем запись в telegram_processed_messages
      if (result.messageId && !result.skipped) {
        console.log(`     🔍 Проверка записи в telegram_processed_messages...`);
        const { data: processedMessages, error: processedMessagesError } = await supabase
          .from('telegram_processed_messages')
          .select('*')
          .eq('message_id', String(result.messageId));
          
        if (processedMessagesError) {
          console.log(`       ❌ Ошибка: ${processedMessagesError.message}`);
        } else if (processedMessages && processedMessages.length > 0) {
          const msg = processedMessages[0];
          console.log(`       ✅ Запись найдена:`);
          console.log(`         Book ID: ${msg.book_id || 'Нет'}`);
          console.log(`         Telegram File ID: ${msg.telegram_file_id || 'Нет'}`);
          
          // Проверяем книгу
          if (msg.book_id) {
            const { data: book, error: bookError } = await supabase
              .from('books')
              .select('title, author, file_url, telegram_file_id')
              .eq('id', msg.book_id)
              .single();
              
            if (bookError) {
              console.log(`         ❌ Ошибка при получении книги: ${bookError.message}`);
            } else if (book) {
              console.log(`         📚 Книга: "${book.title}" автора ${book.author}`);
              console.log(`         📎 File URL: ${book.file_url ? 'Есть' : 'Нет'}`);
              console.log(`         📱 Telegram File ID: ${book.telegram_file_id ? 'Есть' : 'Нет'}`);
            }
          }
        } else {
          console.log(`       ⚠️  Запись не найдена`);
        }
      }
      console.log('');
    }
    
    console.log('✅ Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
testFixes().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});