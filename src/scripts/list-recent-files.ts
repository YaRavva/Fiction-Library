/**
 * Скрипт для получения списка последних обработанных файлов
 * из таблицы telegram_processed_messages
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function listRecentFiles(limit: number = 10) {
  console.log(`🚀 Получение последних ${limit} обработанных файлов...`);
  
  try {
    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Получаем последние обработанные файлы
    const { data: records, error } = await supabase
      .from('telegram_processed_messages')
      .select('message_id, telegram_file_id, book_id, processed_at')
      .not('telegram_file_id', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('❌ Ошибка при получении записей:', error.message);
      return;
    }
    
    if (!records || records.length === 0) {
      console.log('❌ Записи не найдены');
      return;
    }
    
    console.log(`✅ Найдено ${records.length} последних обработанных файлов:`);
    console.log('№  | Message ID | File ID  | Book ID                            | Processed At');
    console.log('---|------------|----------|------------------------------------|-------------------');
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`${(i + 1).toString().padStart(2)} | ${record.message_id.toString().padStart(10)} | ${record.telegram_file_id.toString().padStart(8)} | ${record.book_id} | ${record.processed_at}`);
      
      // Получаем информацию о книге
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('title, author')
        .eq('id', record.book_id)
        .single();
        
      if (bookError) {
        console.log(`   ❌ Ошибка при получении книги: ${bookError.message}`);
      } else if (book) {
        console.log(`   📖 ${book.author} - ${book.title}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения списка файлов:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  const limit = args.length > 0 ? parseInt(args[0], 10) : 10;
  
  if (isNaN(limit) || limit <= 0) {
    console.error('❌ Лимит должен быть положительным числом');
    console.error('Использование: npx tsx src/scripts/list-recent-files.ts [limit]');
    console.error('Пример: npx tsx src/scripts/list-recent-files.ts 20');
    process.exit(1);
  }
  
  // Запускаем получение списка
  listRecentFiles(limit);
}