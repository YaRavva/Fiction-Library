/**
 * Скрипт для регулярного обслуживания таблицы telegram_processed_messages
 * Удаляет дубликаты и записи без соответствующих файлов
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function maintainProcessedMessages() {
  console.log('🔧 Регулярное обслуживание таблицы telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Статистика
    let stats = {
      totalRecords: 0,
      duplicateGroups: 0,
      deletedDuplicates: 0,
      orphanedRecords: 0,
      deletedOrphaned: 0,
      recordsWithoutBookId: 0,
      deletedWithoutBookId: 0
    };
    
    // Получаем все записи
    console.log('🔍 Получение всех записей из telegram_processed_messages...');
    const { data: allRecords, error: allRecordsError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .order('telegram_file_id', { ascending: true });
      
    if (allRecordsError) {
      console.log('❌ Ошибка при получении записей:', allRecordsError.message);
      return;
    }
    
    stats.totalRecords = allRecords?.length || 0;
    console.log(`✅ Получено ${stats.totalRecords} записей`);
    
    if (!allRecords || allRecords.length === 0) {
      console.log('✅ Нет записей для обработки');
      return;
    }
    
    // Группируем записи по telegram_file_id
    const recordsByFileId: Record<string, any[]> = {};
    for (const record of allRecords) {
      if (record.telegram_file_id) {
        if (!recordsByFileId[record.telegram_file_id]) {
          recordsByFileId[record.telegram_file_id] = [];
        }
        recordsByFileId[record.telegram_file_id].push(record);
      }
    }
    
    // Обрабатываем дубликаты
    console.log('\n🔍 Обработка дубликатов...');
    const duplicates = Object.entries(recordsByFileId).filter(([_, records]) => records.length > 1);
    stats.duplicateGroups = duplicates.length;
    
    for (const [fileId, records] of duplicates) {
      console.log(`  📁 Telegram File ID: ${fileId} (${records.length} записей)`);
      
      // Проверяем наличие файла в Storage
      const fileName = `${fileId}.zip`;
      const { data: storageFiles, error: storageError } = await supabase
        .storage
        .from('books')
        .list('', { search: fileName });
        
      const fileExists = !storageError && storageFiles && storageFiles.length > 0;
      
      if (!fileExists) {
        // Файл отсутствует, удаляем все записи
        console.log(`    ⚠️  Файл отсутствует, удаление всех записей...`);
        for (const record of records) {
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (!deleteError) {
            stats.deletedDuplicates++;
          }
        }
      } else {
        // Файл существует, оставляем только одну запись (самую новую)
        console.log(`    ✅ Файл существует, оставляем одну запись...`);
        // Сортируем по дате обработки (новые первыми)
        records.sort((a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime());
        
        // Удаляем все кроме первой записи
        for (let i = 1; i < records.length; i++) {
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', records[i].id);
            
          if (!deleteError) {
            stats.deletedDuplicates++;
          }
        }
      }
    }
    
    // Проверяем записи без book_id
    console.log('\n🔍 Проверка записей без book_id...');
    const recordsWithoutBookId = allRecords.filter(record => !record.book_id);
    stats.recordsWithoutBookId = recordsWithoutBookId.length;
    
    for (const record of recordsWithoutBookId) {
      // Проверяем, есть ли файл в Storage
      if (record.telegram_file_id) {
        const fileName = `${record.telegram_file_id}.zip`;
        const { data: storageFiles, error: storageError } = await supabase
          .storage
          .from('books')
          .list('', { search: fileName });
          
        const fileExists = !storageError && storageFiles && storageFiles.length > 0;
        
        if (!fileExists) {
          // Файл отсутствует, удаляем запись
          console.log(`  🗑️  Удаление записи ${record.id} без book_id и файла...`);
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (!deleteError) {
            stats.deletedWithoutBookId++;
          }
        }
      }
    }
    
    // Проверяем записи без файлов в Storage
    console.log('\n🔍 Проверка записей без файлов в Storage...');
    for (const [fileId, records] of Object.entries(recordsByFileId)) {
      // Проверяем наличие файла в Storage
      const fileName = `${fileId}.zip`;
      const { data: storageFiles, error: storageError } = await supabase
        .storage
        .from('books')
        .list('', { search: fileName });
        
      const fileExists = !storageError && storageFiles && storageFiles.length > 0;
      
      if (!fileExists) {
        // Файл отсутствует, удаляем все записи с этим fileId
        console.log(`  🗑️  Удаление записей для отсутствующего файла ${fileId}...`);
        for (const record of records) {
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (!deleteError) {
            stats.deletedOrphaned++;
          }
        }
      }
    }
    
    // Выводим статистику
    console.log('\n📊 Статистика обслуживания:');
    console.log(`   Всего записей: ${stats.totalRecords}`);
    console.log(`   Групп дубликатов: ${stats.duplicateGroups}`);
    console.log(`   Удалено дубликатов: ${stats.deletedDuplicates}`);
    console.log(`   Записей без book_id: ${stats.recordsWithoutBookId}`);
    console.log(`   Удалено записей без book_id: ${stats.deletedWithoutBookId}`);
    console.log(`   Удалено orphaned записей: ${stats.deletedOrphaned}`);
    console.log(`   Всего удалено записей: ${stats.deletedDuplicates + stats.deletedWithoutBookId + stats.deletedOrphaned}`);
    
    console.log('\n✅ Обслуживание завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
maintainProcessedMessages().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});