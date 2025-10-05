/**
 * Финальный скрипт для очистки telegram_processed_messages
 * Оставляет только записи, соответствующие файлу 4379.zip
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function finalCleanup() {
  console.log('🧹 Финальная очистка telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Проверяем существование файла 4379.zip
    console.log('🔍 Проверка существования файла 4379.zip...');
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('books')
      .download('4379.zip');
      
    if (fileError) {
      console.log('❌ Файл 4379.zip не найден в Storage');
      return;
    }
    
    console.log('✅ Файл 4379.zip найден в Storage');
    
    // Получаем книгу, связанную с файлом 4379.zip
    console.log('\n📚 Поиск книги, связанной с файлом 4379.zip...');
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, author, telegram_file_id')
      .eq('telegram_file_id', '4379')
      .single();
      
    if (bookError) {
      console.log('❌ Ошибка при поиске книги:', bookError.message);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга, связанная с файлом 4379.zip, не найдена');
      return;
    }
    
    console.log(`✅ Найдена книга: "${book.title}" автора ${book.author}`);
    console.log(`   ID книги: ${book.id}`);
    
    // Получаем запись в telegram_processed_messages для этой книги
    console.log('\n📝 Поиск записи в telegram_processed_messages для файла 4379...');
    const { data: record, error: recordError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id')
      .eq('telegram_file_id', '4379')
      .single();
      
    if (recordError && recordError.code !== 'PGRST116') {
      console.log('❌ Ошибка при поиске записи:', recordError.message);
      return;
    }
    
    if (!record) {
      console.log('⚠️  Запись в telegram_processed_messages для файла 4379 не найдена');
      console.log('   Это нормально, если файл был загружен без создания записи');
    } else {
      console.log(`✅ Найдена запись в telegram_processed_messages:`);
      console.log(`   ID записи: ${record.id}`);
      console.log(`   Message ID: ${record.message_id}`);
      console.log(`   Book ID: ${record.book_id}`);
    }
    
    // Удаляем все записи в telegram_processed_messages, кроме той, что связана с файлом 4379
    console.log('\n🗑️  Удаление всех записей, кроме нужной...');
    const { error: deleteError } = await supabase
      .from('telegram_processed_messages')
      .delete()
      .neq('telegram_file_id', '4379');
      
    if (deleteError) {
      console.log('❌ Ошибка при удалении записей:', deleteError.message);
      return;
    }
    
    console.log('✅ Лишние записи удалены');
    
    // Проверяем итоговое количество записей
    console.log('\n🔍 Проверка итогового количества записей...');
    const { count: finalCount, error: finalCountError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
      
    if (finalCountError) {
      console.log('❌ Ошибка при подсчете итоговых записей:', finalCountError.message);
      return;
    }
    
    console.log(`✅ Итоговое количество записей: ${finalCount || 0}`);
    
    console.log('\n✅ Финальная очистка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
finalCleanup().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});