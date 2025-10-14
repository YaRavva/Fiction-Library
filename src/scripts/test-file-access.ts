#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testFileAccess() {
  console.log('=== Тестирование доступа к файлу книги ===');
  
  // Создание клиента Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ ОШИБКА: Не установлены переменные окружения Supabase');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    const messageId = '1039'; // Это telegram_file_id
    
    console.log(`\n1. Поиск записи в telegram_processed_messages с telegram_file_id = ${messageId}...`);
    let { data: processedMessage, error: searchError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('telegram_file_id', messageId)
      .single();
    
    if (processedMessage && !searchError) {
      console.log('✅ Найдена запись в telegram_processed_messages:');
      console.log(`  ID: ${processedMessage.id}`);
      console.log(`  Book ID: ${processedMessage.book_id}`);
      console.log(`  Message ID: ${processedMessage.message_id}`);
      
      // Получаем информацию о книге
      console.log('\n2. Получение информации о книге...');
      let { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', processedMessage.book_id)
        .single();
      
      if (book && !bookError) {
        console.log('✅ Найдена книга:');
        console.log(`  Название: ${book.title}`);
        console.log(`  Автор: ${book.author}`);
        console.log(`  ID: ${book.id}`);
        console.log(`  File URL: ${book.file_url}`);
        console.log(`  File Size: ${book.file_size}`);
        console.log(`  File Format: ${book.file_format}`);
        console.log(`  Telegram File ID: ${book.telegram_file_id}`);
        console.log(`  Storage Path: ${book.storage_path}`);
        
        // Проверяем доступ к файлу по URL
        if (book.file_url) {
          console.log('\n3. Проверка доступа к файлу по URL...');
          try {
            const response = await fetch(book.file_url, {
              method: 'HEAD' // Используем HEAD запрос для проверки доступности без загрузки всего файла
            });
            
            console.log(`Статус ответа: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
              console.log('✅ Файл доступен по URL');
              
              // Получаем размер файла из заголовков
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                console.log(`Размер файла (из заголовков): ${contentLength} байт`);
                
                // Сравниваем с размером в базе данных
                if (book.file_size && parseInt(contentLength) === book.file_size) {
                  console.log('✅ Размер файла совпадает с записью в базе данных');
                } else {
                  console.log('⚠️  Размер файла не совпадает с записью в базе данных');
                }
              }
              
              // Проверяем Content-Type
              const contentType = response.headers.get('content-type');
              if (contentType) {
                console.log(`Content-Type: ${contentType}`);
              }
              
            } else {
              console.log('❌ Файл недоступен по URL');
              console.log('Возможно, файл еще не загружен в хранилище или есть проблемы с доступом');
            }
          } catch (fetchError: any) {
            console.error('❌ Ошибка при проверке доступа к файлу:', fetchError.message);
          }
        } else {
          console.log('❌ URL файла не указан в записи книги');
        }
      } else {
        console.error('❌ ОШИБКА: Книга не найдена');
        if (bookError) console.error(bookError.message);
        return;
      }
    } else {
      console.log('❌ Запись в telegram_processed_messages не найдена');
      if (searchError) console.error(searchError.message);
      return;
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск тестирования
if (require.main === module) {
  testFileAccess()
    .then(() => {
      console.log('\n✅ Тестирование завершено');
    })
    .catch((error) => {
      console.error('\n❌ Тестирование завершено с ошибкой:', error);
      process.exit(1);
    });
}

export { testFileAccess };