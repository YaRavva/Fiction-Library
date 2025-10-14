#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function fixFileUrlAndTest() {
  console.log('=== Исправление URL файла и тестирование доступа ===');
  
  // Создание клиента Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены переменные окружения Supabase');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const messageId = '1039'; // Это telegram_file_id
    const fileName = '1039.zip';
    
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
        console.log(`  Текущий File URL: ${book.file_url}`);
        
        // Исправляем URL файла на правильный Cloud.ru S3 URL
        console.log('\n3. Исправление URL файла на Cloud.ru S3...');
        
        const correctFileUrl = `https://s3.cloud.ru/books/${fileName}`;
        const updateData = {
          file_url: correctFileUrl,
          storage_path: `books/${fileName}`
        };
        
        const { data: updatedBook, error: updateError } = await supabase
          .from('books')
          .update(updateData)
          .eq('id', book.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ ОШИБКА при обновлении URL файла:');
          console.error(updateError.message);
          return;
        }
        
        console.log('✅ URL файла успешно обновлен:');
        console.log(`  Новый File URL: ${updatedBook.file_url}`);
        console.log(`  Storage Path: ${updatedBook.storage_path}`);
        
        // Проверяем доступ к файлу по правильному URL
        console.log('\n4. Проверка доступа к файлу по правильному URL...');
        try {
          const response = await fetch(correctFileUrl, {
            method: 'HEAD' // Используем HEAD запрос для проверки доступности без загрузки всего файла
          });
          
          console.log(`Статус ответа: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            console.log('✅ Файл доступен по правильному URL Cloud.ru S3');
            
            // Получаем размер файла из заголовков
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              console.log(`Размер файла (из заголовков): ${contentLength} байт`);
            }
            
            // Проверяем Content-Type
            const contentType = response.headers.get('content-type');
            if (contentType) {
              console.log(`Content-Type: ${contentType}`);
            }
            
            console.log('\n🎉 Файл успешно привязан к книге и доступен по URL!');
            console.log('Теперь можно проверить кнопки "Читать" и "Скачать" в интерфейсе.');
            
          } else {
            console.log('❌ Файл недоступен по URL');
            console.log('Возможно, есть проблемы с доступом или файл не загружен в хранилище');
          }
        } catch (fetchError: any) {
          console.error('❌ Ошибка при проверке доступа к файлу:', fetchError.message);
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

// Запуск скрипта
if (require.main === module) {
  fixFileUrlAndTest()
    .then(() => {
      console.log('\n✅ Скрипт завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { fixFileUrlAndTest };