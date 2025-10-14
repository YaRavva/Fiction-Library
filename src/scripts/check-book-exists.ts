#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkBookExists() {
  console.log('=== Проверка наличия книги в базе данных ===');
  
  // Создание клиента Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ ОШИБКА: Не установлены переменные окружения Supabase');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Поиск книги с ID 1039 (предполагаем, что ID книги соответствует имени файла без расширения)
    const bookId = '1039';
    
    console.log(`\n1. Поиск книги с ID ${bookId}...`);
    
    // Сначала попробуем найти по ID (если это UUID)
    let { data: bookById, error: idError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
    
    if (bookById && !idError) {
      console.log('✅ Найдена книга по ID:');
      console.log(`  Название: ${bookById.title}`);
      console.log(`  Автор: ${bookById.author}`);
      console.log(`  ID: ${bookById.id}`);
      return;
    }
    
    // Если не нашли по ID, попробуем найти по telegram_file_id
    console.log(`2. Поиск книги по telegram_file_id ${bookId}...`);
    let { data: bookByTelegramId, error: telegramError } = await supabase
      .from('books')
      .select('*')
      .eq('telegram_file_id', bookId)
      .single();
    
    if (bookByTelegramId && !telegramError) {
      console.log('✅ Найдена книга по telegram_file_id:');
      console.log(`  Название: ${bookByTelegramId.title}`);
      console.log(`  Автор: ${bookByTelegramId.author}`);
      console.log(`  ID: ${bookByTelegramId.id}`);
      console.log(`  Telegram File ID: ${bookByTelegramId.telegram_file_id}`);
      return;
    }
    
    // Если не нашли, попробуем найти по названию или другим полям
    console.log(`3. Поиск книги по названию или другим полям...`);
    let { data: books, error: searchError } = await supabase
      .from('books')
      .select('*')
      .ilike('title', `%${bookId}%`)
      .limit(5);
    
    if (books && books.length > 0 && !searchError) {
      console.log(`✅ Найдено ${books.length} книг по поиску "${bookId}":`);
      books.forEach((book, index) => {
        console.log(`  ${index + 1}. ${book.title} - ${book.author} (ID: ${book.id})`);
      });
      return;
    }
    
    console.log('❌ Книга не найдена в базе данных');
    console.log('Возможно, нужно создать новую запись о книге');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск проверки
if (require.main === module) {
  checkBookExists()
    .then(() => {
      console.log('\n✅ Проверка завершена');
    })
    .catch((error) => {
      console.error('\n❌ Проверка завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { checkBookExists };