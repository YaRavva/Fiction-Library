/**
 * Скрипт для диагностики проблемы с привязкой файлов к книгам
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function diagnoseBookLinking() {
  console.log('🔍 Диагностика проблемы с привязкой файлов к книгам\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Проверим несколько последних записей в telegram_processed_messages
    console.log('📋 Проверка последних записей в telegram_processed_messages...');
    const { data: processedMessages, error: processedMessagesError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(5);
      
    if (processedMessagesError) {
      console.log('❌ Ошибка при получении записей:', processedMessagesError.message);
      return;
    }
    
    if (!processedMessages || processedMessages.length === 0) {
      console.log('ℹ️  Нет записей в telegram_processed_messages');
      return;
    }
    
    console.log(`✅ Найдено ${processedMessages.length} записей:`);
    for (const msg of processedMessages) {
      console.log(`  - Message ID: ${msg.message_id}`);
      console.log(`    Book ID: ${msg.book_id}`);
      console.log(`    Telegram File ID: ${msg.telegram_file_id}`);
      console.log(`    Processed At: ${msg.processed_at}`);
      
      // Получаем информацию о книге
      if (msg.book_id) {
        const { data: book, error: bookError } = await supabase
          .from('books')
          .select('title, author, file_url, telegram_file_id')
          .eq('id', msg.book_id)
          .single();
          
        if (bookError) {
          console.log(`    ❌ Ошибка при получении информации о книге: ${bookError.message}`);
        } else if (book) {
          console.log(`    📚 Книга: "${book.title}" автора ${book.author}`);
          console.log(`    📎 File URL: ${book.file_url || 'Нет'}`);
          console.log(`    📱 Telegram File ID: ${book.telegram_file_id || 'Нет'}`);
          
          // Проверяем соответствие telegram_file_id
          if (book.telegram_file_id && book.telegram_file_id === msg.telegram_file_id) {
            console.log(`    ✅ Telegram File ID соответствует`);
          } else if (book.telegram_file_id && book.telegram_file_id !== msg.telegram_file_id) {
            console.log(`    ⚠️  Несоответствие Telegram File ID`);
          } else {
            console.log(`    ℹ️  Нет Telegram File ID в записи книги`);
          }
        }
      }
      console.log('');
    }
    
    // Проверим файлы в Storage, которые не связаны с книгами
    console.log('📂 Проверка файлов в Storage, которые не связаны с книгами...');
    
    // Получаем список файлов в Storage
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('books')
      .list('', { limit: 10 });
      
    if (storageError) {
      console.log('❌ Ошибка при получении списка файлов:', storageError.message);
      return;
    }
    
    if (!storageFiles || storageFiles.length === 0) {
      console.log('ℹ️  Нет файлов в Storage');
      return;
    }
    
    console.log(`✅ Найдено ${storageFiles.length} файлов в Storage:`);
    for (const file of storageFiles) {
      console.log(`  - ${file.name} (${file.id})`);
      
      // Проверяем, есть ли книга с таким telegram_file_id
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id, title, author')
        .eq('telegram_file_id', file.name.replace(/\.[^/.]+$/, "")); // Убираем расширение файла
        
      if (booksError) {
        console.log(`    ❌ Ошибка при поиске книги: ${booksError.message}`);
      } else if (books && books.length > 0) {
        console.log(`    ✅ Связана с книгой: "${books[0].title}" автора ${books[0].author}`);
      } else {
        console.log(`    ⚠️  Не связана с книгой`);
      }
      console.log('');
    }
    
    console.log('✅ Диагностика завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
diagnoseBookLinking().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});