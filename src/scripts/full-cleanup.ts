/**
 * Скрипт для полной очистки файлов и записей, которые не связаны с книгами
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function fullCleanup() {
  console.log('🧹 Полная очистка файлов и записей, не связанных с книгами\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем список всех файлов в Storage
    console.log('📂 Получение списка всех файлов в Storage...');
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('books')
      .list('', { limit: 1000 }); // Проверяем до 1000 файлов
      
    if (storageError) {
      console.log('❌ Ошибка при получении списка файлов:', storageError.message);
      return;
    }
    
    if (!storageFiles || storageFiles.length === 0) {
      console.log('✅ Нет файлов в Storage');
      return;
    }
    
    console.log(`✅ Найдено ${storageFiles.length} файлов в Storage`);
    
    let deletedFiles = 0;
    let deletedRecords = 0;
    
    // Обрабатываем каждый файл
    for (const file of storageFiles) {
      // Извлекаем ID файла (убираем расширение)
      const fileId = file.name.replace(/\.[^/.]+$/, "");
      
      // Проверяем, есть ли книга с таким telegram_file_id
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id')
        .eq('telegram_file_id', fileId);
        
      if (booksError) {
        console.log(`  ❌ Ошибка при поиске книги для файла ${file.name}: ${booksError.message}`);
        continue;
      }
      
      // Если книга не найдена, удаляем файл и запись в telegram_processed_messages
      if (!books || books.length === 0) {
        console.log(`  🗑️  Файл ${file.name} не связан с книгой, удаляем...`);
        
        // Удаляем файл из Storage
        const { error: removeError } = await supabase
          .storage
          .from('books')
          .remove([file.name]);
          
        if (removeError) {
          console.log(`    ❌ Ошибка при удалении файла ${file.name}: ${removeError.message}`);
        } else {
          console.log(`    ✅ Файл ${file.name} удален`);
          deletedFiles++;
          
          // Удаляем запись в telegram_processed_messages
          console.log(`    🗑️  Удаление записи в telegram_processed_messages для файла ${fileId}...`);
          const { error: deleteRecordError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('telegram_file_id', fileId);
            
          if (deleteRecordError) {
            console.log(`      ❌ Ошибка при удалении записи для файла ${fileId}: ${deleteRecordError.message}`);
          } else {
            console.log(`      ✅ Запись для файла ${fileId} удалена`);
            deletedRecords++;
          }
        }
      } else {
        console.log(`  ✅ Файл ${file.name} связан с книгой`);
      }
    }
    
    console.log(`\n✅ Полная очистка завершена!`);
    console.log(`   Удалено файлов: ${deletedFiles}`);
    console.log(`   Удалено записей: ${deletedRecords}`);
    
    // Также проверяем записи в telegram_processed_messages, которые не имеют соответствующих файлов
    console.log('\n🔍 Проверка записей в telegram_processed_messages без файлов...');
    const { data: allRecords, error: allRecordsError } = await supabase
      .from('telegram_processed_messages')
      .select('*');
      
    if (allRecordsError) {
      console.log('❌ Ошибка при получении записей:', allRecordsError.message);
      return;
    }
    
    if (!allRecords || allRecords.length === 0) {
      console.log('✅ Нет записей в telegram_processed_messages');
      return;
    }
    
    console.log(`✅ Найдено ${allRecords.length} записей в telegram_processed_messages`);
    
    let orphanedRecords = 0;
    
    for (const record of allRecords) {
      // Проверяем, есть ли файл с таким telegram_file_id
      if (record.telegram_file_id) {
        const { data: files, error: filesError } = await supabase
          .storage
          .from('books')
          .list('', { 
            search: `${record.telegram_file_id}.` // Ищем файлы, начинающиеся с этого ID
          });
          
        if (filesError) {
          console.log(`  ❌ Ошибка при поиске файла для записи ${record.id}: ${filesError.message}`);
          continue;
        }
        
        // Если файл не найден, удаляем запись
        if (!files || files.length === 0) {
          console.log(`  🗑️  Запись ${record.id} не имеет соответствующего файла, удаляем...`);
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (deleteError) {
            console.log(`    ❌ Ошибка при удалении записи ${record.id}: ${deleteError.message}`);
          } else {
            console.log(`    ✅ Запись ${record.id} удалена`);
            orphanedRecords++;
          }
        }
      }
    }
    
    console.log(`\n✅ Проверка записей без файлов завершена!`);
    console.log(`   Удалено orphaned записей: ${orphanedRecords}`);
    console.log(`\n📊 Общая статистика:`);
    console.log(`   Удалено файлов: ${deletedFiles}`);
    console.log(`   Удалено записей в telegram_processed_messages: ${deletedRecords + orphanedRecords}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
fullCleanup().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});