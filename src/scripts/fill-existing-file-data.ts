/**
 * Скрипт для заполнения данных по уже существующему файлу 4379.zip
 * Автор: Вилма Кадлечкова
 * Название: цикл Мицелий
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function fillExistingFileData() {
  console.log('📝 Заполнение данных по уже существующему файлу 4379.zip\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Ищем книгу по автору и названию
    console.log('🔍 Поиск книги по автору и названию...');
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .ilike('author', '%Вилма Кадлечкова%')
      .ilike('title', '%цикл Мицелий%')
      .single();
      
    if (bookError) {
      console.log('❌ Ошибка при поиске книги:', bookError.message);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    console.log(`✅ Найдена книга: "${book.title}" автора ${book.author}`);
    console.log(`   ID книги: ${book.id}`);
    console.log(`   File URL: ${book.file_url}`);
    console.log(`   Telegram File ID: ${book.telegram_file_id}`);
    console.log(`   Storage Path: ${book.storage_path}\n`);
    
    // Проверяем, есть ли запись в telegram_processed_messages для message_id 4379
    console.log('🔍 Проверка записи в telegram_processed_messages для message_id 4379...');
    const { data: processedMessage, error: processedMessageError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', '4379')
      .single();
      
    if (processedMessageError && processedMessageError.code !== 'PGRST116') {
      console.log('❌ Ошибка при поиске записи в telegram_processed_messages:', processedMessageError.message);
      return;
    }
    
    if (processedMessage) {
      console.log(`✅ Найдена запись в telegram_processed_messages:`);
      console.log(`   ID: ${processedMessage.id}`);
      console.log(`   Message ID: ${processedMessage.message_id}`);
      console.log(`   Book ID: ${processedMessage.book_id}`);
      console.log(`   Telegram File ID: ${processedMessage.telegram_file_id}`);
      
      // Обновляем запись, если telegram_file_id еще не установлен
      if (!processedMessage.telegram_file_id) {
        console.log('\n✏️  Обновление записи в telegram_processed_messages...');
        const { error: updateError } = await supabase
          .from('telegram_processed_messages')
          .update({
            telegram_file_id: '4379',
            processed_at: new Date().toISOString()
          })
          .eq('id', processedMessage.id);
          
        if (updateError) {
          console.log('❌ Ошибка при обновлении записи:', updateError.message);
        } else {
          console.log('✅ Запись успешно обновлена');
        }
      } else {
        console.log('ℹ️  Запись уже содержит telegram_file_id, обновление не требуется');
      }
    } else {
      console.log('ℹ️  Запись в telegram_processed_messages не найдена');
      console.log('➕ Создание новой записи...');
      
      // Создаем новую запись в telegram_processed_messages
      const { error: insertError } = await supabase
        .from('telegram_processed_messages')
        .insert({
          message_id: '4379',
          channel: 'Архив для фантастики',
          book_id: book.id,
          telegram_file_id: '4379',
          processed_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.log('❌ Ошибка при создании записи:', insertError.message);
      } else {
        console.log('✅ Новая запись успешно создана');
      }
    }
    
    // Проверяем файл в Storage
    console.log('\n🔍 Проверка файла в Storage...');
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('books')
      .download('4379.zip');
      
    if (fileError) {
      console.log('❌ Файл не найден в Storage:', fileError.message);
    } else {
      console.log(`✅ Файл найден в Storage (${fileData.size} байт)`);
    }
    
    console.log('\n✅ Заполнение данных завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
fillExistingFileData().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});