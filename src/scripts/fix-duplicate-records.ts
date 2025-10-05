/**
 * Скрипт для диагностики и исправления дублирующихся записей в telegram_processed_messages
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function fixDuplicateRecords() {
  console.log('🔍 Диагностика и исправление дублирующихся записей в telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Находим дублирующиеся записи по telegram_file_id
    console.log('🔍 Поиск дублирующихся записей по telegram_file_id...');
    
    // Сначала получим все записи с группировкой по telegram_file_id
    const { data: allRecords, error: allRecordsError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .order('telegram_file_id', { ascending: true });
      
    if (allRecordsError) {
      console.log('❌ Ошибка при получении записей:', allRecordsError.message);
      return;
    }
    
    if (!allRecords || allRecords.length === 0) {
      console.log('✅ Нет записей в telegram_processed_messages');
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
    
    // Находим дубликаты
    const duplicates = Object.entries(recordsByFileId).filter(([_, records]) => records.length > 1);
    
    console.log(`✅ Найдено ${duplicates.length} групп дублирующихся записей:`);
    
    let totalDeleted = 0;
    
    for (const [fileId, records] of duplicates) {
      console.log(`\n📁 Telegram File ID: ${fileId}`);
      console.log(`   Всего записей: ${records.length}`);
      
      // Проверяем, есть ли файл в Storage
      const fileName = `${fileId}.zip`;
      const { data: storageFiles, error: storageError } = await supabase
        .storage
        .from('books')
        .list('', { search: fileName });
        
      const fileExists = !storageError && storageFiles && storageFiles.length > 0;
      console.log(`   Файл в Storage: ${fileExists ? 'Да' : 'Нет'}`);
      
      // Сортируем записи по дате обработки (новые первыми)
      records.sort((a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime());
      
      // Оставляем только первую (самую новую) запись, остальные удаляем
      console.log(`   🗑️  Удаление дубликатов...`);
      for (let i = 1; i < records.length; i++) {
        const recordToDelete = records[i];
        console.log(`     Удаление записи ID: ${recordToDelete.id}`);
        
        const { error: deleteError } = await supabase
          .from('telegram_processed_messages')
          .delete()
          .eq('id', recordToDelete.id);
          
        if (deleteError) {
          console.log(`       ❌ Ошибка при удалении: ${deleteError.message}`);
        } else {
          console.log(`       ✅ Запись удалена`);
          totalDeleted++;
        }
      }
      
      // Если файл отсутствует в Storage, но есть записи в БД, удаляем все записи
      if (!fileExists) {
        console.log(`   ⚠️  Файл отсутствует в Storage, удаление всех записей...`);
        for (const record of records) {
          console.log(`     Удаление записи ID: ${record.id}`);
          
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (deleteError) {
            console.log(`       ❌ Ошибка при удалении: ${deleteError.message}`);
          } else {
            console.log(`       ✅ Запись удалена`);
            totalDeleted++;
          }
        }
      }
    }
    
    console.log(`\n✅ Обработка дубликатов завершена!`);
    console.log(`   Всего удалено записей: ${totalDeleted}`);
    
    // Также проверим записи без файлов в Storage
    console.log('\n🔍 Проверка записей без файлов в Storage...');
    let orphanedRecords = 0;
    
    for (const [fileId, records] of Object.entries(recordsByFileId)) {
      // Проверяем, есть ли файл в Storage
      const fileName = `${fileId}.zip`;
      const { data: storageFiles, error: storageError } = await supabase
        .storage
        .from('books')
        .list('', { search: fileName });
        
      const fileExists = !storageError && storageFiles && storageFiles.length > 0;
      
      // Если файл отсутствует, удаляем все записи
      if (!fileExists) {
        console.log(`  🗑️  Файл ${fileId}.zip отсутствует, удаление записей...`);
        for (const record of records) {
          console.log(`    Удаление записи ID: ${record.id}`);
          
          const { error: deleteError } = await supabase
            .from('telegram_processed_messages')
            .delete()
            .eq('id', record.id);
            
          if (deleteError) {
            console.log(`      ❌ Ошибка при удалении: ${deleteError.message}`);
          } else {
            console.log(`      ✅ Запись удалена`);
            orphanedRecords++;
            totalDeleted++;
          }
        }
      }
    }
    
    console.log(`\n✅ Проверка записей без файлов завершена!`);
    console.log(`   Удалено orphaned записей: ${orphanedRecords}`);
    console.log(`\n📊 Общая статистика:`);
    console.log(`   Всего удалено записей: ${totalDeleted}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
fixDuplicateRecords().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});