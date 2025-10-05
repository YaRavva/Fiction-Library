/**
 * Быстрый анализ несоответствия между книгами и записями в telegram_processed_messages
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function quickAnalysis() {
  console.log('🔍 Быстрый анализ несоответствия между книгами и записями\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем количество книг в базе
    console.log('📚 Получение количества книг...');
    const { count: booksCount, error: booksCountError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
      
    if (booksCountError) {
      console.log('❌ Ошибка при подсчете книг:', booksCountError.message);
      return;
    }
    
    console.log(`✅ Количество книг в базе: ${booksCount || 0}`);
    
    // Получаем количество записей в telegram_processed_messages
    console.log('\n📝 Получение количества записей в telegram_processed_messages...');
    const { count: recordsCount, error: recordsCountError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
      
    if (recordsCountError) {
      console.log('❌ Ошибка при подсчете записей:', recordsCountError.message);
      return;
    }
    
    console.log(`✅ Количество записей в telegram_processed_messages: ${recordsCount || 0}`);
    
    // Анализируем соотношение
    console.log('\n📊 Анализ соотношения:');
    console.log(`   Книг: ${booksCount || 0}`);
    console.log(`   Записей: ${recordsCount || 0}`);
    console.log(`   Разница: ${(recordsCount || 0) - (booksCount || 0)}`);
    
    // Проверим несколько записей без book_id
    console.log('\n🔍 Проверка записей без book_id (первые 10)...');
    const { data: recordsWithoutBookId, error: recordsWithoutBookIdError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id, processed_at')
      .is('book_id', null)
      .limit(10);
      
    if (recordsWithoutBookIdError) {
      console.log('❌ Ошибка при получении записей без book_id:', recordsWithoutBookIdError.message);
      return;
    }
    
    console.log(`✅ Найдено записей без book_id: ${recordsWithoutBookId?.length || 0}`);
    
    if (recordsWithoutBookId && recordsWithoutBookId.length > 0) {
      console.log('Примеры записей без book_id:');
      for (const record of recordsWithoutBookId) {
        console.log(`  - ID: ${record.id}`);
        console.log(`    Message ID: ${record.message_id}`);
        console.log(`    Telegram File ID: ${record.telegram_file_id || 'Нет'}`);
        console.log(`    Processed At: ${record.processed_at}`);
        console.log('');
      }
    }
    
    // Проверим несколько записей с book_id
    console.log('\n🔍 Проверка записей с book_id (первые 10)...');
    const { data: recordsWithBookId, error: recordsWithBookIdError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id, processed_at')
      .not('book_id', 'is', null)
      .limit(10);
      
    if (recordsWithBookIdError) {
      console.log('❌ Ошибка при получении записей с book_id:', recordsWithBookIdError.message);
      return;
    }
    
    console.log(`✅ Найдено записей с book_id: ${recordsWithBookId?.length || 0}`);
    
    if (recordsWithBookId && recordsWithBookId.length > 0) {
      console.log('Примеры записей с book_id:');
      for (const record of recordsWithBookId) {
        console.log(`  - ID: ${record.id}`);
        console.log(`    Message ID: ${record.message_id}`);
        console.log(`    Telegram File ID: ${record.telegram_file_id || 'Нет'}`);
        console.log(`    Book ID: ${record.book_id}`);
        console.log(`    Processed At: ${record.processed_at}`);
        console.log('');
      }
    }
    
    console.log('✅ Быстрый анализ завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
quickAnalysis().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});