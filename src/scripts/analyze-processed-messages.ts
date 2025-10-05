/**
 * Скрипт для анализа несоответствия между книгами и записями в telegram_processed_messages
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function analyzeProcessedMessages() {
  console.log('🔍 Анализ несоответствия между книгами и записями в telegram_processed_messages\n');
  
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
    
    // Проверяем, есть ли книги без записей в telegram_processed_messages
    console.log('\n🔍 Поиск книг без записей в telegram_processed_messages...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_file_id');
      
    if (booksError) {
      console.log('❌ Ошибка при получении книг:', booksError.message);
      return;
    }
    
    let booksWithoutRecords = 0;
    let booksWithMultipleRecords = 0;
    
    for (const book of books) {
      if (book.telegram_file_id) {
        // Проверяем, есть ли запись в telegram_processed_messages для этого файла
        const { data: records, error: recordsError } = await supabase
          .from('telegram_processed_messages')
          .select('id')
          .eq('telegram_file_id', book.telegram_file_id);
          
        if (recordsError) {
          console.log(`  ❌ Ошибка при поиске записей для книги ${book.id}: ${recordsError.message}`);
          continue;
        }
        
        if (!records || records.length === 0) {
          console.log(`  ⚠️  Книга без записи: "${book.title}" автора ${book.author} (ID: ${book.id})`);
          booksWithoutRecords++;
        } else if (records.length > 1) {
          console.log(`  ⚠️  Книга с несколькими записями: "${book.title}" автора ${book.author} (${records.length} записей)`);
          booksWithMultipleRecords++;
        }
      }
    }
    
    console.log(`\n📊 Книги без записей: ${booksWithoutRecords}`);
    console.log(`📊 Книги с несколькими записями: ${booksWithMultipleRecords}`);
    
    // Проверяем, есть ли записи без книг
    console.log('\n🔍 Поиск записей без книг...');
    const { data: records, error: recordsError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id');
      
    if (recordsError) {
      console.log('❌ Ошибка при получении записей:', recordsError.message);
      return;
    }
    
    let recordsWithoutBooks = 0;
    let recordsWithInvalidBookId = 0;
    
    for (const record of records) {
      if (record.book_id) {
        // Проверяем, существует ли книга с таким ID
        const { data: book, error: bookError } = await supabase
          .from('books')
          .select('id')
          .eq('id', record.book_id)
          .single();
          
        if (bookError && bookError.code !== 'PGRST116') { // PGRST116 - запись не найдена
          console.log(`  ❌ Ошибка при поиске книги для записи ${record.id}: ${bookError.message}`);
          continue;
        }
        
        if (!book) {
          console.log(`  ⚠️  Запись с несуществующей книгой: ID записи ${record.id}, Book ID ${record.book_id}`);
          recordsWithInvalidBookId++;
        }
      } else {
        console.log(`  ⚠️  Запись без book_id: ID записи ${record.id}, Telegram File ID ${record.telegram_file_id || 'Нет'}`);
        recordsWithoutBooks++;
      }
    }
    
    console.log(`\n📊 Записи без book_id: ${recordsWithoutBooks}`);
    console.log(`📊 Записи с несуществующими book_id: ${recordsWithInvalidBookId}`);
    
    // Проверяем дубликаты по book_id
    console.log('\n🔍 Поиск дубликатов по book_id...');
    const bookIdCounts: Record<string, number> = {};
    for (const record of records) {
      if (record.book_id) {
        if (!bookIdCounts[record.book_id]) {
          bookIdCounts[record.book_id] = 0;
        }
        bookIdCounts[record.book_id]++;
      }
    }
    
    let duplicateBookIds = 0;
    for (const [bookId, count] of Object.entries(bookIdCounts)) {
      if (count > 1) {
        console.log(`  ⚠️  Book ID ${bookId} связан с ${count} записями`);
        duplicateBookIds++;
      }
    }
    
    console.log(`\n📊 Книги, связанные с несколькими записями: ${duplicateBookIds}`);
    
    // Итоговая статистика
    console.log('\n📈 Итоговая статистика:');
    console.log(`   Всего книг: ${booksCount}`);
    console.log(`   Всего записей: ${recordsCount}`);
    console.log(`   Книг без записей: ${booksWithoutRecords}`);
    console.log(`   Книг с несколькими записями: ${booksWithMultipleRecords}`);
    console.log(`   Записей без book_id: ${recordsWithoutBooks}`);
    console.log(`   Записей с несуществующими book_id: ${recordsWithInvalidBookId}`);
    console.log(`   Книг, связанных с несколькими записями: ${duplicateBookIds}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
analyzeProcessedMessages().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});