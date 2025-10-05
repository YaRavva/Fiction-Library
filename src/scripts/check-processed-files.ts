/**
 * Скрипт для проверки записей с заполненным telegram_file_id
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function checkProcessedFiles() {
  console.log('📋 Проверка записей с заполненным telegram_file_id\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем записи с заполненным telegram_file_id
    console.log('🔍 Получение записей с заполненным telegram_file_id...');
    const { data: records, error } = await supabase
      .from('telegram_processed_messages')
      .select('message_id, telegram_file_id, processed_at, book_id')
      .not('telegram_file_id', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.log('❌ Ошибка при получении записей:', error.message);
      return;
    }
    
    console.log(`✅ Найдено ${records.length} записей с заполненным telegram_file_id:\n`);
    
    // Для каждой записи получаем информацию о книге
    for (const record of records) {
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('title, author')
        .eq('id', record.book_id)
        .single();
        
      if (bookError) {
        console.log(`❌ Ошибка при получении информации о книге ${record.book_id}:`, bookError.message);
        continue;
      }
      
      console.log(`📝 Message ID: ${record.message_id}`);
      console.log(`   Telegram File ID: ${record.telegram_file_id}`);
      console.log(`   Книга: "${book.title}" автора ${book.author}`);
      console.log(`   Обработано: ${record.processed_at}`);
      console.log('');
    }
    
    // Получаем общую статистику
    console.log('📊 Общая статистика:');
    const { count: totalCount, error: countError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
      
    if (!countError) {
      console.log(`   Всего обработанных сообщений: ${totalCount}`);
    }
    
    const { count: withFileIdCount, error: withFileIdCountError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true })
      .not('telegram_file_id', 'is', null);
      
    if (!withFileIdCountError) {
      console.log(`   Сообщений с заполненным telegram_file_id: ${withFileIdCount}`);
      if (totalCount && totalCount > 0) {
        const percentage = ((withFileIdCount || 0) / totalCount * 100).toFixed(2);
        console.log(`   Процент заполненных записей: ${percentage}%`);
      }
    }
    
    console.log('\n✅ Проверка завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
checkProcessedFiles().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});