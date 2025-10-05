/**
 * Проверка записей, созданных при синхронизации метаданных
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function checkMetadataRecords() {
  console.log('🔍 Проверка записей, созданных при синхронизации метаданных\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Проверяем записи без telegram_file_id
    console.log('🔍 Проверка записей без telegram_file_id...');
    const { data: recordsWithoutFileId, error: recordsWithoutFileIdError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id, processed_at')
      .is('telegram_file_id', null)
      .limit(20);
      
    if (recordsWithoutFileIdError) {
      console.log('❌ Ошибка при получении записей без telegram_file_id:', recordsWithoutFileIdError.message);
      return;
    }
    
    console.log(`✅ Найдено записей без telegram_file_id: ${recordsWithoutFileId?.length || 0}`);
    
    if (recordsWithoutFileId && recordsWithoutFileId.length > 0) {
      console.log('Примеры записей без telegram_file_id:');
      for (const record of recordsWithoutFileId) {
        console.log(`  - ID: ${record.id}`);
        console.log(`    Message ID: ${record.message_id}`);
        console.log(`    Book ID: ${record.book_id}`);
        console.log(`    Processed At: ${record.processed_at}`);
        
        // Проверяем информацию о книге
        if (record.book_id) {
          const { data: book, error: bookError } = await supabase
            .from('books')
            .select('title, author, telegram_post_id')
            .eq('id', record.book_id)
            .single();
            
          if (!bookError && book) {
            console.log(`    Книга: "${book.title}" автора ${book.author}`);
            console.log(`    Telegram Post ID: ${book.telegram_post_id || 'Нет'}`);
          }
        }
        console.log('');
      }
    }
    
    // Проверяем записи с telegram_file_id
    console.log('\n🔍 Проверка записей с telegram_file_id...');
    const { data: recordsWithFileId, error: recordsWithFileIdError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id, processed_at')
      .not('telegram_file_id', 'is', null)
      .limit(20);
      
    if (recordsWithFileIdError) {
      console.log('❌ Ошибка при получении записей с telegram_file_id:', recordsWithFileIdError.message);
      return;
    }
    
    console.log(`✅ Найдено записей с telegram_file_id: ${recordsWithFileId?.length || 0}`);
    
    if (recordsWithFileId && recordsWithFileId.length > 0) {
      console.log('Примеры записей с telegram_file_id:');
      for (const record of recordsWithFileId) {
        console.log(`  - ID: ${record.id}`);
        console.log(`    Message ID: ${record.message_id}`);
        console.log(`    Telegram File ID: ${record.telegram_file_id}`);
        console.log(`    Book ID: ${record.book_id}`);
        console.log(`    Processed At: ${record.processed_at}`);
        
        // Проверяем информацию о книге
        if (record.book_id) {
          const { data: book, error: bookError } = await supabase
            .from('books')
            .select('title, author, telegram_file_id')
            .eq('id', record.book_id)
            .single();
            
          if (!bookError && book) {
            console.log(`    Книга: "${book.title}" автора ${book.author}`);
            console.log(`    Telegram File ID в книге: ${book.telegram_file_id || 'Нет'}`);
          }
        }
        console.log('');
      }
    }
    
    // Подсчитываем общее количество записей без telegram_file_id
    console.log('\n📊 Подсчет общего количества записей без telegram_file_id...');
    const { count: countWithoutFileId, error: countError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true })
      .is('telegram_file_id', null);
      
    if (countError) {
      console.log('❌ Ошибка при подсчете записей без telegram_file_id:', countError.message);
      return;
    }
    
    console.log(`✅ Общее количество записей без telegram_file_id: ${countWithoutFileId || 0}`);
    
    console.log('\n✅ Проверка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
checkMetadataRecords().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});