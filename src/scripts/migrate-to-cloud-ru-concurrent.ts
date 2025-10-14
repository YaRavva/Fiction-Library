#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { uploadFile, createBucket } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Скрипт для параллельной миграции файлов из Supabase Storage в Cloud.ru S3
 * Использует конкурентные возможности Cloud.ru S3 для более быстрой загрузки
 * Также сохраняет локальные копии файлов
 */

// Максимальное количество одновременных загрузок
const MAX_CONCURRENT_UPLOADS = 5;

async function migrateToCloudRuConcurrent() {
  console.log('🚀 Начинаем параллельную миграцию файлов из Supabase Storage в Cloud.ru S3');
  
  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.S3_BUCKET_NAME || `books-${Date.now()}`;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('Требуются переменные:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  // Создаем директорию для локального бэкапа
  const backupDir = path.join(process.cwd(), 'local-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n🔧 Конфигурация миграции:`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Cloud.ru Bucket: ${bucketName}`);
  console.log(`Локальный бэкап: ${backupDir}`);
  console.log(`Максимум одновременных загрузок: ${MAX_CONCURRENT_UPLOADS}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('\n📚 Получаем список всех книг с файлами из базы данных...');
    
    // Получаем все книги, у которых есть файлы (без ограничения по количеству)
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url, storage_path, file_format, file_size, telegram_file_id')
      .not('file_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(10000); // Увеличиваем лимит до 10000 (или другого подходящего значения)
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError.message);
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг с файлами`);
    
    if (books.length === 0) {
      console.log('ℹ️  Нет книг с файлами для миграции');
      return;
    }
    
    // Создаем новый бакет для миграции
    console.log(`\n📦 Создаем новый бакет "${bucketName}"...`);
    try {
      await createBucket(bucketName);
      console.log(`✅ Бакет "${bucketName}" успешно создан`);
    } catch (error: any) {
      console.log(`⚠️  Бакет "${bucketName}" уже существует или ошибка при создании: ${error.message}`);
    }
    
    // Фильтруем книги, которые еще не перенесены в Cloud.ru S3
    const booksToMigrate = books.filter(book => 
      book.file_url && !book.file_url.includes('s3.cloud.ru')
    );
    
    console.log(`📋 Книг для миграции: ${booksToMigrate.length}`);
    
    if (booksToMigrate.length === 0) {
      console.log('ℹ️  Все файлы уже перенесены в Cloud.ru S3');
      return;
    }
    
    // Счетчики для статистики
    let migratedCount = 0;
    let errorCount = 0;
    
    console.log('\n🔄 Начинаем параллельную миграцию файлов...');
    
    // Обрабатываем файлы порциями для контроля нагрузки
    for (let i = 0; i < booksToMigrate.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = booksToMigrate.slice(i, i + MAX_CONCURRENT_UPLOADS);
      const batchNumber = Math.floor(i / MAX_CONCURRENT_UPLOADS) + 1;
      const totalBatches = Math.ceil(booksToMigrate.length / MAX_CONCURRENT_UPLOADS);
      
      console.log(`\n📦 Обработка пакета ${batchNumber}/${totalBatches} (${batch.length} файлов)`);
      
      // Создаем массив промисов для параллельной обработки
      const uploadPromises = batch.map(async (book) => {
        try {
          // Форматированный вывод информации о книге
          const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)}MB` : 'N/A';
          console.log(`  📥 ${book.author} - ${book.title} | ${fileSize}`);
          
          // Скачиваем файл из Supabase Storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('books')
            .download(book.storage_path);
          
          if (downloadError) {
            throw new Error(`Ошибка при скачивании файла: ${downloadError.message}`);
          }
          
          if (!fileData) {
            throw new Error('Файл не найден в Supabase Storage');
          }
          
          // Преобразуем Blob в Buffer
          const arrayBuffer = await fileData.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);
          
          // Сохраняем локальную копию файла
          const localFilePath = path.join(backupDir, book.storage_path);
          const localDir = path.dirname(localFilePath);
          
          // Создаем директорию, если она не существует
          if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
          }
          
          // Сохраняем файл локально только если он еще не существует
          if (!fs.existsSync(localFilePath)) {
            fs.writeFileSync(localFilePath, fileBuffer);
            console.log(`  💾 Локальная копия сохранена: ${localFilePath}`);
          }
          
          // Загружаем файл в Cloud.ru S3 с использованием AWS SDK
          const uploadResult = await uploadFile(bucketName, book.storage_path, fileBuffer);
          
          // Обновляем запись в базе данных
          const newFileUrl = `https://s3.cloud.ru/${bucketName}/${book.storage_path}`;
          
          const { error: updateError } = await supabase
            .from('books')
            .update({
              file_url: newFileUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', book.id);
          
          if (updateError) {
            throw new Error(`Ошибка при обновлении записи в базе данных: ${updateError.message}`);
          }
          
          return { success: true, bookId: book.id, title: book.title, author: book.author };
        } catch (error: any) {
          return { success: false, bookId: book.id, title: book.title, author: book.author, error: error.message };
        }
      });
      
      // Выполняем параллельную загрузку файлов в текущем пакете
      const results = await Promise.all(uploadPromises);
      
      // Обновляем счетчики и выводим информацию
      results.forEach(result => {
        if (result.success) {
          migratedCount++;
          console.log(`  ✅ ${result.author} - ${result.title} | Загружен и привязан`);
        } else {
          errorCount++;
          console.log(`  ❌ ${result.author} - ${result.title} | Ошибка: ${result.error}`);
        }
      });
      
      // Выводим промежуточные результаты
      console.log(`  📊 Промежуточные результаты пакета:`);
      console.log(`    ✅ Успешно: ${results.filter(r => r.success).length}`);
      console.log(`    ❌ Ошибок: ${results.filter(r => !r.success).length}`);
      
      // Добавляем небольшую задержку между пакетами для стабильности
      if (i + MAX_CONCURRENT_UPLOADS < booksToMigrate.length) {
        console.log(`  ⏳ Пауза перед следующим пакетом...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги параллельной миграции:');
    console.log(`  ✅ Успешно перенесено: ${migratedCount} файлов`);
    console.log(`  ❌ Ошибок: ${errorCount} файлов`);
    console.log(`  📚 Всего обработано: ${booksToMigrate.length} файлов`);
    console.log(`  📂 Локальный бэкап: ${backupDir}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Параллельная миграция успешно завершена!');
    } else {
      console.log(`\n⚠️  Параллельная миграция завершена с ${errorCount} ошибками`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка во время параллельной миграции:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск параллельной миграции
if (require.main === module) {
  migrateToCloudRuConcurrent()
    .then(() => {
      console.log('\n✅ Скрипт параллельной миграции завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт параллельной миграции завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { migrateToCloudRuConcurrent };