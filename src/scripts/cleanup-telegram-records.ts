/**
 * Скрипт для очистки записей в telegram_processed_messages
 * Оставляет только записи, соответствующие файлам в Storage
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function cleanupTelegramRecords() {
  console.log('🧹 Очистка записей в telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем список файлов в Storage (без служебных файлов)
    console.log('📂 Получение списка файлов в Storage...');
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('books')
      .list('', { limit: 100 });
      
    if (storageError) {
      console.log('❌ Ошибка при получении списка файлов:', storageError.message);
      return;
    }
    
    // Фильтруем служебные файлы
    const actualFiles = storageFiles?.filter(file => !file.name.startsWith('.')) || [];
    const fileIds = actualFiles.map(file => file.name.replace(/\.[^/.]+$/, ""));
    
    console.log(`✅ Найдено реальных файлов в Storage: ${actualFiles.length}`);
    console.log(`   Файлы: ${fileIds.join(', ')}`);
    
    // Получаем все записи в telegram_processed_messages
    console.log('\n📝 Получение всех записей в telegram_processed_messages...');
    const { data: allRecords, error: allRecordsError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id');
      
    if (allRecordsError) {
      console.log('❌ Ошибка при получении записей:', allRecordsError.message);
      return;
    }
    
    console.log(`✅ Всего записей: ${allRecords?.length || 0}`);
    
    let deletedRecords = 0;
    
    // Удаляем записи, которые не соответствуют файлам в Storage
    if (allRecords) {
      for (const record of allRecords) {
        let shouldKeep = false;
        
        // Для записей с telegram_file_id проверяем соответствие файлам
        if (record.telegram_file_id) {
          if (fileIds.includes(record.telegram_file_id)) {
            shouldKeep = true;
          }
        } 
        // Для записей без telegram_file_id проверяем, есть ли книга
        else if (record.book_id) {
          // Проверяем, существует ли книга
          const { data: book, error: bookError } = await supabase
            .from('books')
            .select('id, telegram_file_id')
            .eq('id', record.book_id)
            .single();
            
          if (!bookError && book) {
            // Если у книги есть telegram_file_id и он соответствует файлу в Storage, оставляем запись
            if (book.telegram_file_id && fileIds.includes(book.telegram_file_id)) {
              shouldKeep = true;
            }
          }
        }
        
        // Если запись не должна сохраняться, удаляем её
        if (!shouldKeep) {
          console.log(`  🗑️  Удаление записи ID ${record.id}...`);
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (deleteError) {
            console.log(`    ❌ Ошибка при удалении: ${deleteError.message}`);
          } else {
            console.log(`    ✅ Запись удалена`);
            deletedRecords++;
          }
        }
      }
    }
    
    console.log('\n📊 Статистика очистки:');
    console.log(`   Удалено записей: ${deletedRecords}`);
    
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
    
    console.log('\n✅ Очистка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
cleanupTelegramRecords().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});