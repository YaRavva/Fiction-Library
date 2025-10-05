/**
 * Скрипт для очистки некорректных записей в telegram_processed_messages
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function cleanupProcessedMessages() {
  console.log('🧹 Очистка некорректных записей в telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Находим записи с book_id = null
    console.log('🔍 Поиск записей с book_id = null...');
    const { data: invalidRecords, error: fetchError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .is('book_id', null);
      
    if (fetchError) {
      console.log('❌ Ошибка при поиске записей:', fetchError.message);
      return;
    }
    
    if (!invalidRecords || invalidRecords.length === 0) {
      console.log('✅ Нет записей с book_id = null');
      return;
    }
    
    console.log(`✅ Найдено ${invalidRecords.length} записей с book_id = null:`);
    for (const record of invalidRecords) {
      console.log(`  - Message ID: ${record.message_id}`);
      console.log(`    Telegram File ID: ${record.telegram_file_id}`);
      console.log(`    Processed At: ${record.processed_at}`);
    }
    
    // Удаляем эти записи
    console.log('\n🗑️  Удаление некорректных записей...');
    const { error: deleteError } = await supabase
      .from('telegram_processed_messages')
      .delete()
      .is('book_id', null);
      
    if (deleteError) {
      console.log('❌ Ошибка при удалении записей:', deleteError.message);
      return;
    }
    
    console.log(`✅ Удалено ${invalidRecords.length} записей`);
    
    // Также удаляем файлы из Storage, которые не связаны с книгами
    console.log('\n📂 Поиск файлов в Storage, которые не связаны с книгами...');
    
    // Получаем список файлов в Storage
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('books')
      .list('', { limit: 100 }); // Проверяем до 100 файлов
      
    if (storageError) {
      console.log('❌ Ошибка при получении списка файлов:', storageError.message);
      return;
    }
    
    if (!storageFiles || storageFiles.length === 0) {
      console.log('✅ Нет файлов в Storage');
      return;
    }
    
    let deletedFiles = 0;
    let deletedRecords = 0;
    console.log(`✅ Найдено ${storageFiles.length} файлов в Storage:`);
    
    for (const file of storageFiles) {
      // Проверяем, есть ли книга с таким telegram_file_id
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id')
        .eq('telegram_file_id', file.name.replace(/\.[^/.]+$/, "")); // Убираем расширение файла
        
      if (booksError) {
        console.log(`  ❌ Ошибка при поиске книги для файла ${file.name}: ${booksError.message}`);
      } else if (!books || books.length === 0) {
        // Файл не связан с книгой, удаляем его
        console.log(`  🗑️  Удаление файла ${file.name}, не связанного с книгой...`);
        const { error: removeError } = await supabase
          .storage
          .from('books')
          .remove([file.name]);
          
        if (removeError) {
          console.log(`    ❌ Ошибка при удалении файла ${file.name}: ${removeError.message}`);
        } else {
          console.log(`    ✅ Файл ${file.name} удален`);
          deletedFiles++;
          
          // Также удаляем запись в telegram_processed_messages для этого файла
          const fileId = file.name.replace(/\.[^/.]+$/, ""); // Убираем расширение файла
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
    
    console.log(`\n✅ Очистка завершена! Удалено ${deletedFiles} файлов из Storage и ${deletedRecords} записей из базы данных.`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
cleanupProcessedMessages().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});