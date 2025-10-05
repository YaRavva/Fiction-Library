/**
 * Скрипт для очистки лишних записей в telegram_processed_messages
 * Удаляет записи, которые не соответствуют файлам в Storage
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function cleanupExcessRecords() {
  console.log('🧹 Очистка лишних записей в telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем список всех файлов в Storage
    console.log('📂 Получение списка файлов в Storage...');
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('books')
      .list('', { limit: 1000 });
      
    if (storageError) {
      console.log('❌ Ошибка при получении списка файлов:', storageError.message);
      return;
    }
    
    const fileIds = storageFiles?.map(file => file.name.replace(/\.[^/.]+$/, "")) || [];
    console.log(`✅ Найдено файлов в Storage: ${fileIds.length}`);
    console.log(`   Файлы: ${fileIds.join(', ')}`);
    
    // Получаем все записи в telegram_processed_messages с telegram_file_id
    console.log('\n📝 Получение записей с telegram_file_id...');
    const { data: recordsWithFileId, error: recordsError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id')
      .not('telegram_file_id', 'is', null);
      
    if (recordsError) {
      console.log('❌ Ошибка при получении записей:', recordsError.message);
      return;
    }
    
    console.log(`✅ Найдено записей с telegram_file_id: ${recordsWithFileId?.length || 0}`);
    
    // Удаляем записи, для которых нет файлов в Storage
    let deletedRecords = 0;
    
    if (recordsWithFileId) {
      for (const record of recordsWithFileId) {
        const fileId = record.telegram_file_id;
        if (fileId && !fileIds.includes(fileId)) {
          console.log(`  🗑️  Удаление записи для отсутствующего файла ${fileId}...`);
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
    
    // Получаем все записи в telegram_processed_messages без telegram_file_id
    console.log('\n📝 Получение записей без telegram_file_id...');
    const { data: recordsWithoutFileId, error: recordsWithoutFileIdError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id')
      .is('telegram_file_id', null);
      
    if (recordsWithoutFileIdError) {
      console.log('❌ Ошибка при получении записей без telegram_file_id:', recordsWithoutFileIdError.message);
      return;
    }
    
    console.log(`✅ Найдено записей без telegram_file_id: ${recordsWithoutFileId?.length || 0}`);
    
    // Для записей без telegram_file_id проверяем, есть ли соответствующие книги
    let deletedMetadataRecords = 0;
    
    if (recordsWithoutFileId) {
      for (const record of recordsWithoutFileId) {
        if (record.book_id) {
          // Проверяем, существует ли книга
          const { data: book, error: bookError } = await supabase
            .from('books')
            .select('id')
            .eq('id', record.book_id)
            .single();
            
          if (bookError && bookError.code !== 'PGRST116') { // PGRST116 - запись не найдена
            console.log(`  ❌ Ошибка при проверке книги ${record.book_id}: ${bookError.message}`);
            continue;
          }
          
          if (!book) {
            console.log(`  🗑️  Удаление записи для несуществующей книги ${record.book_id}...`);
            const { error: deleteError } = await supabase
              .from('telegram_processed_messages')
              .delete()
              .eq('id', record.id);
              
            if (deleteError) {
              console.log(`    ❌ Ошибка при удалении: ${deleteError.message}`);
            } else {
              console.log(`    ✅ Запись удалена`);
              deletedMetadataRecords++;
            }
          }
        }
      }
    }
    
    // Удаляем дубликаты по message_id (оставляем только одну запись)
    console.log('\n🔍 Поиск дубликатов по message_id...');
    const { data: allRecords, error: allRecordsError } = await supabase
      .from('telegram_processed_messages')
      .select('id, message_id, telegram_file_id, book_id, processed_at')
      .order('message_id', { ascending: true });
      
    if (allRecordsError) {
      console.log('❌ Ошибка при получении всех записей:', allRecordsError.message);
      return;
    }
    
    let deletedDuplicates = 0;
    
    if (allRecords) {
      const groupedByMessageId: Record<string, any[]> = {};
      
      // Группируем записи по message_id
      for (const record of allRecords) {
        if (record.message_id) {
          if (!groupedByMessageId[record.message_id]) {
            groupedByMessageId[record.message_id] = [];
          }
          groupedByMessageId[record.message_id].push(record);
        }
      }
      
      // Удаляем дубликаты (оставляем только одну запись по каждому message_id)
      for (const [messageId, records] of Object.entries(groupedByMessageId)) {
        if (records.length > 1) {
          console.log(`  ⚠️  Найдено ${records.length} дубликатов для message_id ${messageId}`);
          
          // Сортируем по дате обработки (новые первыми)
          records.sort((a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime());
          
          // Удаляем все кроме первой записи
          for (let i = 1; i < records.length; i++) {
            const record = records[i];
            console.log(`    🗑️  Удаление дубликата ID ${record.id}...`);
            const { error: deleteError } = await supabase
              .from('telegram_processed_messages')
              .delete()
              .eq('id', record.id);
              
            if (deleteError) {
              console.log(`      ❌ Ошибка при удалении: ${deleteError.message}`);
            } else {
              console.log(`      ✅ Дубликат удален`);
              deletedDuplicates++;
            }
          }
        }
      }
    }
    
    console.log('\n📊 Статистика очистки:');
    console.log(`   Удалено записей без файлов: ${deletedRecords}`);
    console.log(`   Удалено записей с несуществующими книгами: ${deletedMetadataRecords}`);
    console.log(`   Удалено дубликатов: ${deletedDuplicates}`);
    console.log(`   Всего удалено: ${deletedRecords + deletedMetadataRecords + deletedDuplicates}`);
    
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
cleanupExcessRecords().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});