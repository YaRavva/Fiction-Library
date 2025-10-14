#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Скрипт для скачивания всех файлов из Supabase Storage и сохранения их локально
 */

async function downloadAllFilesLocally() {
  console.log('🚀 Начинаем скачивание всех файлов из Supabase Storage');
  
  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('Требуются переменные:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  // Создаем директорию для сохранения файлов
  const downloadDir = path.join(process.cwd(), 'local-backup');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  
  console.log(`\n📂 Директория для сохранения файлов: ${downloadDir}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('\n📚 Получаем список всех книг с файлами из базы данных...');
    
    // Получаем все книги, у которых есть файлы
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url, storage_path, file_format, file_size')
      .not('file_url', 'is', null)
      .order('created_at', { ascending: true });
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError.message);
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг с файлами`);
    
    if (books.length === 0) {
      console.log('ℹ️  Нет книг с файлами для скачивания');
      return;
    }
    
    // Счетчики для статистики
    let downloadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log('\n📥 Начинаем скачивание файлов...');
    
    // Обрабатываем каждую книгу по одной
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const progress = `${i + 1}/${books.length}`;
      
      // Форматированный вывод информации о книге
      const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)}MB` : 'N/A';
      console.log(`\n[${progress}] ${book.author} - ${book.title} | ${fileSize}`);
      
      // Проверяем, есть ли storage_path
      if (!book.storage_path) {
        console.log(`  ⚠️  Отсутствует storage_path, пропускаем`);
        skippedCount++;
        continue;
      }
      
      try {
        // Проверяем, существует ли файл уже локально
        const localFilePath = path.join(downloadDir, book.storage_path);
        const localDir = path.dirname(localFilePath);
        
        // Создаем директорию, если она не существует
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        
        // Пропускаем, если файл уже существует
        if (fs.existsSync(localFilePath)) {
          console.log(`  ⚠️  Файл уже существует локально, пропускаем`);
          skippedCount++;
          continue;
        }
        
        console.log(`  📥 Скачиваем файл из Supabase Storage...`);
        
        // Скачиваем файл из Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.storage_path);
        
        if (downloadError) {
          console.log(`  ❌ Ошибка при скачивании файла: ${downloadError.message}`);
          errorCount++;
          continue;
        }
        
        if (!fileData) {
          console.log(`  ❌ Файл не найден в Supabase Storage`);
          errorCount++;
          continue;
        }
        
        console.log(`  ✅ Файл успешно скачан (${fileData.size} байт)`);
        
        // Сохраняем файл локально
        const arrayBuffer = await fileData.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        
        fs.writeFileSync(localFilePath, fileBuffer);
        console.log(`  💾 Файл сохранен локально: ${localFilePath}`);
        
        downloadedCount++;
        
        // Добавляем небольшую задержку между файлами для стабильности
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.log(`  ❌ Ошибка при обработке книги: ${error.message}`);
        errorCount++;
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги скачивания:');
    console.log(`  ✅ Успешно скачано: ${downloadedCount} файлов`);
    console.log(`  ⚠️  Пропущено: ${skippedCount} файлов`);
    console.log(`  ❌ Ошибок: ${errorCount} файлов`);
    console.log(`  📚 Всего обработано: ${books.length} файлов`);
    console.log(`  📂 Файлы сохранены в: ${downloadDir}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Скачивание успешно завершено!');
    } else {
      console.log(`\n⚠️  Скачивание завершено с ${errorCount} ошибками`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка во время скачивания:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск скачивания
if (require.main === module) {
  downloadAllFilesLocally()
    .then(() => {
      console.log('\n✅ Скрипт скачивания завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт скачивания завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { downloadAllFilesLocally };