#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function bindFileToBook() {
  console.log('=== Привязка файла 1039.zip к книге ===');
  
  // Создание клиента Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ ОШИБКА: Не установлены переменные окружения Supabase');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    const bookId = '1039';
    const fileName = '1039.zip';
    
    // Проверяем, что файл существует локально (мы его скачали ранее)
    const localFilePath = `./${fileName}`;
    if (!fs.existsSync(localFilePath)) {
      console.error(`❌ ОШИБКА: Локальный файл ${fileName} не найден`);
      return;
    }
    
    // Получаем размер файла
    const fileStats = fs.statSync(localFilePath);
    const fileSize = fileStats.size;
    console.log(`Размер файла: ${fileSize} байт`);
    
    console.log(`\n1. Поиск книги с telegram_file_id ${bookId}...`);
    let { data: book, error: searchError } = await supabase
      .from('books')
      .select('*')
      .eq('telegram_file_id', bookId)
      .single();
    
    if (!book || searchError) {
      console.error('❌ ОШИБКА: Книга не найдена');
      if (searchError) console.error(searchError.message);
      return;
    }
    
    console.log('✅ Найдена книга:');
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  ID: ${book.id}`);
    
    // Обновляем информацию о файле книги
    console.log('\n2. Обновление информации о файле книги...');
    
    const updateData = {
      file_url: `https://s3.cloud.ru/books/${fileName}`,
      file_size: fileSize,
      file_format: 'zip',
      storage_path: `books/${fileName}`
    };
    
    const { data: updatedBook, error: updateError } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', book.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ ОШИБКА при обновлении информации о файле:');
      console.error(updateError.message);
      return;
    }
    
    console.log('✅ Информация о файле успешно обновлена:');
    console.log(`  File URL: ${updatedBook.file_url}`);
    console.log(`  File Size: ${updatedBook.file_size}`);
    console.log(`  File Format: ${updatedBook.file_format}`);
    console.log(`  Storage Path: ${updatedBook.storage_path}`);
    
    console.log('\n🎉 Файл успешно привязан к книге!');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск привязки
if (require.main === module) {
  bindFileToBook()
    .then(() => {
      console.log('\n✅ Привязка завершена');
    })
    .catch((error) => {
      console.error('\n❌ Привязка завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { bindFileToBook };